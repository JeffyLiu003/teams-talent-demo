#!/usr/bin/env python3
"""
scan_as400_codebase.py - deterministic technical inventory scanner for
AS/400 (IBM i) source trees, used by the extract-cobol-knowledge skill.

Scans a source root, classifies members (COBOL, copybooks, DDS, CL, RPG,
SQL), and extracts structural facts: program IDs, copybook references,
file and database usage, paragraphs, PERFORM targets, CALL targets, DDS
records/fields/keys, and the program call graph. No LLM judgment is
applied; the output feeds the knowledge-extraction workflow.

Usage:
    python scan_as400_codebase.py <source_root> [--output PATH]
        [--include CBL,CPY,PF,LF,CLP] [--encoding NAME] [--format json|yaml]

Output document shape:
    meta, inventory.{programs,copybooks,files,tables}, call_graph
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

VERSION = "1.1.0"

COBOL_EXTS = {".cbl", ".cob", ".cblle", ".cobol", ".cbo", ".cob4"}
COPYBOOK_EXTS = {".cpy", ".copy"}
DDS_EXTS = {".pf", ".lf", ".dspf", ".prtf", ".dds"}
CL_EXTS = {".clp", ".cl", ".clle"}
RPG_EXTS = {".rpg", ".rpgle", ".sqlrpg", ".sqlrpgle", ".rpg3", ".rpg4"}
SQL_EXTS = {".sql"}
BINDING_EXTS = {".bnd", ".bnddir", ".srvpgm"}

ALL_EXTS = (
    COBOL_EXTS | COPYBOOK_EXTS | DDS_EXTS | CL_EXTS | RPG_EXTS | SQL_EXTS | BINDING_EXTS
)

ENCODING_CANDIDATES = (
    "utf-8",
    "utf-8-sig",
    "gb18030",
    "cp037",
    "cp500",
    "cp875",
    "cp1025",
    "cp1140",
    "latin-1",
)

# DBCS EBCDIC CCSIDs (e.g. Chinese bank source) are not available as Python
# codecs; they are decoded through the system `iconv` when it is installed.
ICONV_CANDIDATES = ("IBM-1388", "IBM-937", "IBM-935")
ICONV_THRESHOLD = 80.0

# Display-file subfile keywords: record-level markers, standalone A-spec
# keywords, and control fields (which are real fields, not markers).
SUBFILE_RECORD_KEYWORDS = {
    "SFL", "SFLCTL", "SFLCSRPRG", "SFLDROP", "SFLMODE", "SFLMSG", "SFLFIX",
    "SFLINZ", "SFLCHGINZ", "SFLFCLR",
}
SUBFILE_ALINE_KEYWORDS = {
    "SFLDSP", "SFLDSPCTL", "SFLCLR", "SFLPGMQ", "SFLDROP", "SFLMODE",
    "SFLINZ", "SFLCHGINZ", "SFLMSG", "SFLFIX", "SFLCSRPRG",
}
SUBFILE_FIELDS = {
    "SFLSIZ", "SFLPAG", "SFLEND", "SFLRCDNBR", "SFLNXTCHG", "SFLMSGID",
    "SFLMSGRCD", "SFLRNA", "SFLPAGNBR", "SFLCSRLOC", "SFLQ",
}

# Keywords used to score decoded candidates (case-insensitive match).
KEYWORDS = [
    "IDENTIFICATION", "DIVISION", "PROCEDURE", "PROGRAM-ID", "WORKING-STORAGE",
    "FILE-CONTROL", "LINKAGE", "PERFORM", "MOVE", "COPY", "CALL", "EXEC",
    "END-EXEC", "GOBACK", "PGM", "DCLF", "OVRDBF", "MONMSG", "ENDPGM",
    "CALLP", "PFILE", "COLHDG", "TEXT", "FD", "SELECT", "ASSIGN",
]

_PRINTABLE = set("".join(chr(i) for i in range(32, 127))) | {"\t", "\n", "\r"}

RE_PROGRAM_ID = re.compile(r"^\s*PROGRAM-ID\.\s*([A-Z0-9][A-Z0-9-]*)\s*\.", re.IGNORECASE)
RE_COPY = re.compile(r"^\s*COPY\s+([A-Z0-9][A-Z0-9@#$_]*)", re.IGNORECASE)
RE_SQL_INCLUDE = re.compile(r"^\s*INCLUDE\s+([A-Z0-9][A-Z0-9@#$_]*)", re.IGNORECASE)
RE_SELECT = re.compile(r"^\s*SELECT\s+([A-Z0-9][A-Z0-9-]*)\s+ASSIGN", re.IGNORECASE)
RE_ASSIGN_TO = re.compile(r"\bASSIGN\s+TO\s+(?:DATABASE-)?([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
RE_FD = re.compile(r"^\s*FD\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
RE_PROCEDURE_DIV = re.compile(r"^\s*PROCEDURE\s+DIVISION", re.IGNORECASE)
RE_PARAGRAPH = re.compile(r"^([A-Z0-9][A-Z0-9-]*)\s*\.\s*$")
RE_SECTION = re.compile(r"^([A-Z0-9][A-Z0-9-]*)\s+SECTION\.\s*$", re.IGNORECASE)
RE_PERFORM = re.compile(r"\bPERFORM\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
RE_PERFORM_THRU = re.compile(r"\bTHRU\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
INLINE_PERFORM_WORDS = {
    "UNTIL", "VARYING", "TIMES", "THRU", "THROUGH", "WITH", "TEST",
    "AFTER", "BEFORE", "FOREVER", "INLINE", "FROM", "BY", "TO",
}
RE_CALL = re.compile(
    r"\bCALL\s+(?:['\"]([^'\"]+)['\"]|([A-Z0-9][A-Z0-9-]*))", re.IGNORECASE
)
RE_EXEC_SQL = re.compile(r"\bEXEC\s+SQL", re.IGNORECASE)
RE_END_EXEC = re.compile(r"\bEND-EXEC", re.IGNORECASE)
RE_SQL_TABLE = re.compile(
    r"\b(?:FROM|INTO|UPDATE|TABLE)\s+([A-Z0-9_][A-Z0-9_./$#]*)", re.IGNORECASE
)
RE_SQL_DELETE = re.compile(r"\bDELETE\s+FROM\s+([A-Z0-9_][A-Z0-9_./$#]*)", re.IGNORECASE)

RE_LEVEL = re.compile(r"^(\d{2})\s+([A-Z0-9][A-Z0-9-]*)(.*)$")
RE_PIC = re.compile(r"\bPIC(?:TURE)?\s+([A-Z0-9()$+*.,-]+)", re.IGNORECASE)
RE_USAGE = re.compile(r"\bUSAGE\s+(\w[\w-]*)", re.IGNORECASE)
RE_OCCURS = re.compile(r"\bOCCURS\s+(\d+)", re.IGNORECASE)
RE_REDEFINES = re.compile(r"\bREDEFINES\s+([A-Z0-9-]+)", re.IGNORECASE)
RE_VALUE = re.compile(r"\bVALUE(?:S)?\s+(.+)$", re.IGNORECASE)
RE_IO_OP = re.compile(
    r"^\s*(WRITE|READ|REWRITE|DELETE)\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE
)

DDS_STOPWORDS = {
    "REF", "PFILE", "UNIQUE", "TEXT", "COLHDG", "ALIAS", "FORMAT", "EDTCDE",
    "VALUES", "RANGE", "CHECK", "CONCAT", "SST", "COMP", "BINARY", "FLOAT",
    "DATE", "TIME", "TIMESTAMP", "DEFAULT", "DESC", "ASC", "SELECT", "OMIT",
    "VARLEN", "FILLER", "INP", "OUT", "BOTH", "COM", "BLANKS", "ZEROS", "DUP",
    "ALTSEQ", "SIGNED", "PACKED", "ZONED", "CCSID", "CHRSET", "PROC",
    "JDFTVAL", "ERRMSG", "MSGCON", "TRGTFN", "MAP", "PERIOD", "DFT",
}
RE_DDS_RECORD = re.compile(r"^\s*R\s+([A-Z0-9_]+)")
RE_DDS_PFILE = re.compile(r"\bPFILE\s*\(\s*([^)]+)\s*\)", re.IGNORECASE)
RE_DDS_REF = re.compile(r"\bREF\s*\(\s*([^)]+)\s*\)", re.IGNORECASE)
RE_DDS_KEY = re.compile(r"^\s*K\s+([A-Z0-9_]+)", re.IGNORECASE)

RE_CL_DCLF = re.compile(r"^\s*DCLF\s+(\S+)", re.IGNORECASE)
RE_CL_DTAARA = re.compile(
    r"\b(DCLDTAARA|RTVDTAARA|CHGDTAARA|RCVDTAARA|SNDDTAARA)\s+(\S+)", re.IGNORECASE
)
RE_CL_CALL = re.compile(
    r"\bCALL\s+(?:PGM\s*\(\s*)?['\"]?([A-Z0-9_./]+)", re.IGNORECASE
)
RE_CL_FILE = re.compile(r"\b(?:FILE|TOFILE)\s*\(\s*([^)]+)", re.IGNORECASE)

RE_RPG_COPY = re.compile(
    r"^\s*/COPY\s+(?:[A-Z0-9_]+(?:/[A-Z0-9_]+)?,)?\s*([A-Z0-9_]+)", re.IGNORECASE
)
RE_RPG_CALL = re.compile(
    r"\bCALLP?\s+(?:['\"]([^'\"]+)['\"]|\(?([A-Z0-9_]+)\)?)", re.IGNORECASE
)
RE_RPG_FSPEC = re.compile(r"^\s*F([A-Z0-9_]{1,10})\s", re.IGNORECASE)
RE_RPG_DCLF = re.compile(r"\bDCL-F\s+([A-Z0-9_]+)", re.IGNORECASE)

RE_BND_PGM = re.compile(r"\b(?:PGM|SRVPGM)\s*\(\s*([^)]+)\s*\)", re.IGNORECASE)
RE_BND_SYMBOL = re.compile(
    r"\b(?:EXPORT|IMPORT)\s+SYMBOL\s*\(\s*['\"]?([^'\")]+)", re.IGNORECASE
)

PARAGRAPH_STOPWORDS = {
    "GOBACK", "EXIT", "STOP", "CONTINUE", "DECLARATIVES", "END-DECLARATIVES",
    "END-IF", "END-READ", "END-WRITE", "END-REWRITE", "END-DELETE",
    "END-PERFORM", "END-EVALUATE", "END-EXEC", "END-CALL", "END-STRING",
    "END-UNSTRING", "END-SEARCH", "END-ACCEPT", "END-DISPLAY",
    "END-ADD", "END-SUBTRACT", "END-MULTIPLY", "END-DIVIDE", "END-COMPUTE",
}


def printable_ratio(text: str) -> float:
    """Fraction of characters that are printable ASCII or whitespace."""
    if not text:
        return 0.0
    hits = sum(1 for ch in text if ch in _PRINTABLE)
    return hits / len(text)


def keyword_hits(text: str) -> int:
    upper = text.upper()
    return sum(upper.count(kw) for kw in KEYWORDS)


def iconv_available() -> bool:
    return shutil.which("iconv") is not None


def try_iconv(raw: bytes) -> str | None:
    """Decode DBCS EBCDIC bytes through system iconv, if available."""
    exe = shutil.which("iconv")
    if not exe:
        return None
    for ccsid in ICONV_CANDIDATES:
        try:
            proc = subprocess.run(
                [exe, "-f", ccsid, "-t", "UTF-8"],
                input=raw,
                capture_output=True,
                timeout=15,
            )
        except (OSError, subprocess.SubprocessError):
            continue
        if proc.returncode == 0 and proc.stdout:
            text = proc.stdout.decode("utf-8", errors="replace")
            if printable_ratio(text) > 0.9 and keyword_hits(text) >= 2:
                return text
    return None


def decode_source(
    raw: bytes, preferred: str = "", allow_iconv: bool = True
) -> tuple[str, str]:
    """Decode source bytes, detecting encoding when not forced."""
    if preferred:
        return preferred, raw.decode(preferred)
    best_enc, best_text, best_score = "latin-1", raw.decode("latin-1"), -1.0
    for enc in ENCODING_CANDIDATES:
        try:
            text = raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
        score = printable_ratio(text) * 100.0 + min(keyword_hits(text), 30) * 4.0
        if score > best_score:
            best_enc, best_text, best_score = enc, text, score
    if allow_iconv and best_score < ICONV_THRESHOLD:
        iconv_text = try_iconv(raw)
        if iconv_text:
            score = printable_ratio(iconv_text) * 100.0 + min(
                keyword_hits(iconv_text), 30
            ) * 4.0
            if score > best_score:
                return "iconv-ebcdic", iconv_text
    return best_enc, best_text


def comment_text(line: str) -> str | None:
    """Return comment text for a source line, or None if it is not a comment."""
    if not line.strip():
        return None
    stripped = line.strip()
    if stripped.startswith("/*"):
        return stripped[2:].strip()
    if stripped.startswith("//"):
        return stripped[2:].strip()
    if stripped.startswith("A*"):
        return stripped[2:].strip()  # DDS comment style
    if stripped.startswith("*>"):
        return stripped[2:].strip()  # free-format COBOL comment
    if stripped.startswith("*"):
        return stripped[1:].strip()  # fixed-format comment
    if len(line) >= 7 and line[6] in "*/":
        return line[7:].strip()  # fixed-format indicator area
    return None


def is_comment_line(line: str) -> bool:
    return comment_text(line) is not None


def header_comments(lines: list[str], limit: int = 12) -> list[str]:
    """Collect the leading comment block that describes the member."""
    collected: list[str] = []
    in_block = False
    for line in lines[:80]:
        if not line.strip():
            if not in_block:
                continue
        if in_block:
            content = line.strip().lstrip("*").strip().rstrip("*/").strip()
            if content:
                collected.append(content)
                if len(collected) >= limit:
                    break
            if "*/" in line:
                in_block = False
            continue
        if is_comment_line(line):
            content = comment_text(line) or ""
            if content and content.upper() not in ("PAGE", "EJECT"):
                collected.append(content)
                if len(collected) >= limit:
                    break
            if line.strip().startswith("/*") and "*/" not in line:
                in_block = True
        else:
            break
    return collected


def comment_count(lines: list[str]) -> int:
    count = 0
    in_block = False
    for line in lines:
        if in_block:
            count += 1
            if "*/" in line:
                in_block = False
            continue
        if is_comment_line(line):
            count += 1
            if line.strip().startswith("/*") and "*/" not in line:
                in_block = True
    return count


def normalize_table(name: str) -> str:
    """Strip library/owner prefixes and punctuation from a table name."""
    bare = name.replace("/", ".").split(".")[-1]
    return bare.upper()


def norm_field(name: str) -> str:
    """Normalize a field name for best-effort lineage matching."""
    return re.sub(r"[^A-Z0-9]", "", name.upper())


def parse_values(text: str) -> list[str]:
    """Parse COBOL VALUE clauses into literal value strings."""
    values: list[str] = []
    for part in text.rstrip(".").split(","):
        part = part.strip()
        if not part:
            continue
        quoted = re.findall(r"'([^']*)'|\"([^\"]*)\"", part)
        if quoted:
            values.append((quoted[0][0] or quoted[0][1]).strip())
            continue
        rng = re.match(
            r"([A-Z0-9][A-Z0-9.-]*)\s+(?:THRU|THROUGH)\s+([A-Z0-9][A-Z0-9.-]*)",
            part,
            re.IGNORECASE,
        )
        if rng:
            values.append(f"{rng.group(1).upper()} THRU {rng.group(2).upper()}")
            continue
        values.append(part.upper())
    return values


def base_record(rel_path: str, kind: str, encoding: str, lines: list[str]) -> dict:
    path = Path(rel_path)
    return {
        "name": path.stem.upper(),
        "path": rel_path,
        "type": kind,
        "encoding": encoding,
        "lines": len(lines),
        "comment_count": comment_count(lines),
        "header_comments": header_comments(lines),
    }


def analyze_cobol(rel_path: str, encoding: str, lines: list[str]) -> dict:
    rec = base_record(rel_path, "COBOL", encoding, lines)
    copybooks: list[str] = []
    sql_includes: list[str] = []
    select_names: list[str] = []
    assign_targets: list[str] = []
    paragraphs: list[str] = []
    sections: list[str] = []
    performs: list[dict] = []
    calls: list[dict] = []
    io_operations: list[dict] = []
    sql_tables: list[str] = []

    in_procedure = False
    sql_buffer: list[str] = []
    in_sql = False

    for idx, raw in enumerate(lines, start=1):
        line = raw.rstrip("\r")
        stripped = line.strip()
        upper = stripped.upper()

        if not in_sql and RE_EXEC_SQL.search(line):
            in_sql = True
            sql_buffer = [line]
            if RE_END_EXEC.search(line):
                in_sql = False
                sql_tables.extend(extract_sql_tables("\n".join(sql_buffer)))
                sql_buffer = []
            continue
        if in_sql:
            sql_buffer.append(line)
            if RE_END_EXEC.search(line):
                in_sql = False
                sql_tables.extend(extract_sql_tables("\n".join(sql_buffer)))
                sql_buffer = []
            continue

        if RE_PROCEDURE_DIV.match(stripped):
            in_procedure = True
            continue
        if not stripped or is_comment_line(line):
            continue

        if not in_procedure:
            m = RE_PROGRAM_ID.match(stripped)
            if m and not rec.get("program_id"):
                rec["program_id"] = m.group(1).upper()
            m = RE_COPY.match(stripped)
            if m:
                copybooks.append(m.group(1).upper())
            m = RE_SQL_INCLUDE.match(stripped)
            if m:
                sql_includes.append(m.group(1).upper())
            m = RE_SELECT.match(stripped)
            if m:
                select_names.append(m.group(1).upper())
            m = RE_ASSIGN_TO.search(line)
            if m:
                assign_targets.append(m.group(1).upper())
            m = RE_FD.match(stripped)
            if m:
                select_names.append(m.group(1).upper())
        else:
            m = RE_SECTION.match(stripped)
            if m:
                sections.append(m.group(1).upper())
            pm = RE_PARAGRAPH.match(stripped)
            if pm:
                para = pm.group(1).upper()
                if para not in PARAGRAPH_STOPWORDS:
                    paragraphs.append(para)

        for pm in RE_PERFORM.finditer(line):
            target = pm.group(1).upper()
            if target in INLINE_PERFORM_WORDS:
                continue
            entry = {"target": target, "line": idx}
            thru = RE_PERFORM_THRU.search(line)
            if thru:
                entry["thru"] = thru.group(1).upper()
            performs.append(entry)

        for cm in RE_CALL.finditer(line):
            literal = cm.group(1)
            identifier = cm.group(2)
            if literal:
                calls.append({"target": literal.upper(), "literal": True, "line": idx})
            elif identifier:
                calls.append({"target": identifier.upper(), "literal": False, "line": idx})

        iom = RE_IO_OP.match(stripped)
        if iom:
            io_operations.append(
                {
                    "op": iom.group(1).upper(),
                    "target": iom.group(2).upper(),
                    "line": idx,
                }
            )

    rec["copybooks"] = sorted(set(copybooks))
    rec["sql_includes"] = sorted(set(sql_includes))
    rec["files"] = sorted(set(select_names))
    rec["external_files"] = sorted(set(assign_targets))
    rec["sql_tables"] = sorted(set(sql_tables))
    rec["paragraphs"] = paragraphs
    rec["sections"] = sections
    rec["performs"] = performs
    rec["calls"] = calls
    rec["io_operations"] = io_operations
    return rec


def extract_sql_tables(block: str) -> list[str]:
    tables: list[str] = []
    for m in RE_SQL_TABLE.finditer(block):
        name = m.group(1)
        if not name.upper().startswith(":"):
            tables.append(normalize_table(name))
    for m in RE_SQL_DELETE.finditer(block):
        tables.append(normalize_table(m.group(1)))
    return tables


def analyze_copybook(rel_path: str, encoding: str, lines: list[str]) -> dict:
    rec = base_record(rel_path, "COPYBOOK", encoding, lines)
    records: list[dict] = []
    for idx, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if not stripped or is_comment_line(raw):
            continue
        m = RE_LEVEL.match(stripped)
        if not m:
            continue
        level = m.group(1)
        name = m.group(2).upper()
        rest = m.group(3)
        entry: dict = {"level": level, "name": name, "line": idx}
        pic = RE_PIC.search(rest)
        if pic:
            entry["pic"] = pic.group(1).upper().rstrip(".")
        usage = RE_USAGE.search(rest)
        if usage:
            entry["usage"] = usage.group(1).upper()
        occurs = RE_OCCURS.search(rest)
        if occurs:
            entry["occurs"] = int(occurs.group(1))
        redefines = RE_REDEFINES.search(rest)
        if redefines:
            entry["redefines"] = redefines.group(1).upper()
        value = RE_VALUE.search(rest)
        if value:
            entry["values"] = parse_values(value.group(1))
        records.append(entry)
    rec["records"] = records
    return rec


def analyze_dds(rel_path: str, encoding: str, lines: list[str]) -> dict:
    rec = base_record(rel_path, "DDS", encoding, lines)
    rec["kind"] = Path(rel_path).suffix[1:].upper() or "DDS"
    record_names: list[str] = []
    fields: list[dict] = []
    referenced: list[str] = []
    is_dspf = rec["kind"] == "DSPF"
    subfiles: list[dict] = []
    subfile_by_record: dict[str, dict] = {}
    current_record: str | None = None

    def ensure_subfile(record: str) -> dict:
        if record not in subfile_by_record:
            entry = {"record": record, "kind": "OTHER", "keywords": [], "fields": []}
            subfile_by_record[record] = entry
            subfiles.append(entry)
        return subfile_by_record[record]

    for idx, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if not stripped or is_comment_line(raw):
            continue
        m = RE_DDS_RECORD.match(stripped)
        if m:
            current_record = m.group(1).upper()
            record_names.append(current_record)
        m = RE_DDS_KEY.match(stripped)
        if m:
            fields.append({"name": m.group(1).upper(), "key": True, "line": idx})
        pfile = RE_DDS_PFILE.search(stripped)
        if pfile:
            referenced.append(normalize_table(pfile.group(1)))
        ref = RE_DDS_REF.search(stripped)
        if ref:
            referenced.append(normalize_table(ref.group(1)))

        tokens = stripped.split()
        if tokens and tokens[0].upper() == "A" and len(tokens) > 1:
            if tokens[1].upper() == "R" and len(tokens) > 2:
                current_record = tokens[2].upper()
                record_names.append(current_record)
                if is_dspf:
                    rec_kws = [
                        tok.upper()
                        for tok in tokens[3:]
                        if tok.upper() in SUBFILE_RECORD_KEYWORDS
                    ]
                    if rec_kws:
                        entry = ensure_subfile(current_record)
                        kind = "SFLCTL" if "SFLCTL" in rec_kws else (
                            "SFL" if "SFL" in rec_kws else "OTHER"
                        )
                        entry["kind"] = kind
                        entry["keywords"].extend(rec_kws)
                continue
            # Support both key styles: "A CUSTNO ... K" and "A K CUSTNO".
            if tokens[1].upper() == "K" and len(tokens) > 2:
                fields.append({"name": tokens[2].upper(), "key": True, "line": idx})
                continue
            name = tokens[1].upper()
            if name in DDS_STOPWORDS or name in ("R", "K", "S"):
                continue
            if is_dspf and name in SUBFILE_ALINE_KEYWORDS:
                if current_record:
                    entry = ensure_subfile(current_record)
                    if name not in entry["keywords"]:
                        entry["keywords"].append(name)
                continue
            if is_dspf and current_record and name in SUBFILE_FIELDS:
                entry = ensure_subfile(current_record)
                entry["fields"].append(name)
            fields.append(
                {
                    "name": name,
                    "key": any(tok.upper() == "K" for tok in tokens[2:]),
                    "line": idx,
                }
            )
            if (
                is_dspf
                and current_record
                and current_record in subfile_by_record
                and name not in SUBFILE_FIELDS
            ):
                subfile_by_record[current_record]["fields"].append(name)

    rec["records"] = record_names
    rec["fields"] = fields
    rec["referenced_files"] = sorted(set(referenced))
    if is_dspf:
        rec["subfiles"] = subfiles
    return rec


def analyze_cl(rel_path: str, encoding: str, lines: list[str]) -> dict:
    rec = base_record(rel_path, "CL", encoding, lines)
    dclf: list[str] = []
    calls: list[dict] = []
    files: list[str] = []
    data_areas: list[str] = []
    for idx, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if not stripped or stripped.startswith("/*"):
            continue
        m = RE_CL_DCLF.match(stripped)
        if m:
            dclf.append(m.group(1).upper())
        dm = RE_CL_DTAARA.search(stripped)
        if dm:
            data_areas.append(dm.group(2).upper().lstrip("&"))
        for fm in RE_CL_FILE.finditer(stripped):
            for part in fm.group(1).replace(" ", "").split(","):
                if part:
                    files.append(part.upper())
        for cm in RE_CL_CALL.finditer(stripped):
            target = cm.group(1).upper()
            if target != "PGM":
                calls.append({"target": target, "literal": True, "line": idx})
    rec["external_files"] = sorted(set(dclf + files))
    rec["data_areas"] = sorted(set(data_areas))
    rec["calls"] = calls
    return rec


def analyze_rpg(rel_path: str, encoding: str, lines: list[str]) -> dict:
    rec = base_record(rel_path, "RPG", encoding, lines)
    copybooks: list[str] = []
    calls: list[dict] = []
    files: list[str] = []
    sql_tables: list[str] = []
    sql_buffer: list[str] = []
    in_sql = False
    for idx, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if not in_sql and RE_EXEC_SQL.search(raw):
            in_sql = True
            sql_buffer = [raw]
            if RE_END_EXEC.search(raw):
                in_sql = False
                sql_tables.extend(extract_sql_tables("\n".join(sql_buffer)))
                sql_buffer = []
            continue
        if in_sql:
            sql_buffer.append(raw)
            if RE_END_EXEC.search(raw):
                in_sql = False
                sql_tables.extend(extract_sql_tables("\n".join(sql_buffer)))
                sql_buffer = []
            continue
        if not stripped or is_comment_line(raw):
            continue
        m = RE_RPG_COPY.match(stripped)
        if m:
            copybooks.append(m.group(1).upper())
        for cm in RE_RPG_CALL.finditer(stripped):
            literal = cm.group(1)
            identifier = cm.group(2)
            target = (literal or identifier or "").upper()
            if target:
                calls.append({"target": target, "literal": bool(literal), "line": idx})
        m = RE_RPG_FSPEC.match(stripped)
        if m:
            files.append(m.group(1).upper())
        m = RE_RPG_DCLF.search(stripped)
        if m:
            files.append(m.group(1).upper())
    rec["copybooks"] = sorted(set(copybooks))
    rec["external_files"] = sorted(set(files))
    rec["calls"] = calls
    rec["sql_tables"] = sorted(set(sql_tables))
    return rec


def analyze_sql(rel_path: str, encoding: str, lines: list[str]) -> dict:
    rec = base_record(rel_path, "SQL", encoding, lines)
    rec["sql_tables"] = sorted(set(extract_sql_tables("\n".join(lines))))
    return rec


def analyze_binding(rel_path: str, encoding: str, lines: list[str]) -> dict:
    """Extract members and exported symbols from binding directory source."""
    rec = base_record(rel_path, "BINDING", encoding, lines)
    rec["kind"] = Path(rel_path).suffix[1:].upper() or "BINDING"
    members: list[str] = []
    symbols: list[str] = []
    for raw in lines:
        stripped = raw.strip()
        if not stripped or stripped.startswith("/*") or is_comment_line(raw):
            continue
        for m in RE_BND_PGM.finditer(stripped):
            for part in m.group(1).replace(" ", "").split(","):
                if part:
                    members.append(part.upper())
        for m in RE_BND_SYMBOL.finditer(stripped):
            sym = m.group(1).strip().strip('"').strip("'")
            if sym:
                symbols.append(sym.upper())
    rec["members"] = sorted(set(members))
    rec["symbols"] = sorted(set(symbols))
    return rec


def classify(path: Path) -> str | None:
    ext = path.suffix.lower()
    if ext in COBOL_EXTS:
        return "COBOL"
    if ext in COPYBOOK_EXTS:
        return "COPYBOOK"
    if ext in DDS_EXTS:
        return "DDS"
    if ext in CL_EXTS:
        return "CL"
    if ext in RPG_EXTS:
        return "RPG"
    if ext in SQL_EXTS:
        return "SQL"
    if ext in BINDING_EXTS:
        return "BINDING"
    return None


def analyze(kind: str, rel_path: str, encoding: str, lines: list[str]) -> dict:
    if kind == "COBOL":
        return analyze_cobol(rel_path, encoding, lines)
    if kind == "COPYBOOK":
        return analyze_copybook(rel_path, encoding, lines)
    if kind == "DDS":
        return analyze_dds(rel_path, encoding, lines)
    if kind == "CL":
        return analyze_cl(rel_path, encoding, lines)
    if kind == "RPG":
        return analyze_rpg(rel_path, encoding, lines)
    if kind == "SQL":
        return analyze_sql(rel_path, encoding, lines)
    return analyze_binding(rel_path, encoding, lines)


def yaml_str(value) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, int):
        return str(value)
    text = str(value)
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def yaml_dump(obj, indent: int = 0) -> str:
    """Minimal block-style YAML emitter for plain data (no third-party deps)."""
    pad = " " * indent
    if isinstance(obj, dict):
        if not obj:
            return pad + "{}\n"
        lines: list[str] = []
        for key, value in obj.items():
            if isinstance(value, (dict, list)):
                lines.append(f"{pad}{key}:")
                lines.append(yaml_dump(value, indent + 2).rstrip("\n"))
            else:
                lines.append(f"{pad}{key}: {yaml_str(value)}")
        return "\n".join(lines) + "\n"
    if isinstance(obj, list):
        if not obj:
            return pad + "[]\n"
        lines = []
        for item in obj:
            if isinstance(item, (dict, list)):
                lines.append(pad + "-")
                lines.append(yaml_dump(item, indent + 2).rstrip("\n"))
            else:
                lines.append(f"{pad}- {yaml_str(item)}")
        return "\n".join(lines) + "\n"
    return pad + yaml_str(obj) + "\n"


def dedupe_edges(edges: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    result: list[dict] = []
    for edge in sorted(edges, key=lambda e: (e["caller"], e["callee"], e["line"])):
        key = (edge["caller"], edge["callee"], edge["line"])
        if key in seen:
            continue
        seen.add(key)
        result.append(edge)
    return result


def build_field_lineage(
    copybooks: list[dict], files: list[dict], programs: list[dict]
) -> list[dict]:
    """Best-effort copybook-field to DDS-field mapping by normalized name."""
    dds_map: dict[str, dict[str, str]] = {}
    for f in files:
        for fd in f.get("fields", []):
            key = norm_field(fd["name"])
            if key:
                dds_map.setdefault(f["name"], {}).setdefault(key, fd["name"])
    prog_names = {p["name"] for p in programs}
    lineage: list[dict] = []
    seen: set[tuple] = set()
    for cpy in copybooks:
        users = set(cpy.get("used_by", []))
        for rec in cpy.get("records", []):
            if rec.get("level") == "88":
                continue
            key = norm_field(rec["name"])
            if not key:
                continue
            for dds_name, field_map in dds_map.items():
                if key not in field_map:
                    continue
                dds_users = {
                    p["name"]
                    for p in programs
                    if dds_name in p.get("external_files", [])
                    or dds_name in p.get("files", [])
                    or dds_name in p.get("sql_tables", [])
                }
                shared = sorted((users & dds_users) & prog_names)
                dedupe = (cpy["name"], rec["name"], dds_name, field_map[key])
                if dedupe in seen:
                    continue
                seen.add(dedupe)
                lineage.append(
                    {
                        "copybook": cpy["name"],
                        "copybook_field": rec["name"],
                        "dds_file": dds_name,
                        "dds_field": field_map[key],
                        "shared_programs": shared,
                    }
                )
    lineage.sort(key=lambda x: (x["copybook"], x["copybook_field"], x["dds_file"]))
    return lineage


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Scan an AS/400 source tree and produce a technical inventory."
    )
    parser.add_argument("source_root", help="Root directory of the source tree")
    parser.add_argument(
        "--output",
        default="",
        help="Output file path (default <source_root>/analysis/scan-result.json)",
    )
    parser.add_argument(
        "--include",
        default="",
        help="Comma-separated member extensions to scan, e.g. CBL,CPY,PF,LF,CLP",
    )
    parser.add_argument(
        "--encoding",
        default="",
        help="Force source encoding, e.g. cp037, gb18030, utf-8",
    )
    parser.add_argument(
        "--no-iconv",
        action="store_true",
        help="Disable iconv-based decoding for DBCS EBCDIC source",
    )
    parser.add_argument("--format", choices=("json", "yaml"), default="json")
    args = parser.parse_args(argv)

    root = Path(args.source_root).resolve()
    if not root.is_dir():
        print(f"[ERROR] Source root not found: {root}", file=sys.stderr)
        return 1

    include_exts: set[str] = set()
    if args.include:
        for token in args.include.split(","):
            token = token.strip().lower()
            if token:
                include_exts.add(token if token.startswith(".") else "." + token)

    programs: list[dict] = []
    copybooks: list[dict] = []
    files: list[dict] = []
    bindings: list[dict] = []
    tables_map: dict[str, set[str]] = {}
    edges: list[dict] = []
    file_counts: dict[str, int] = {}
    iconv_used = False

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if any(part.startswith(".") for part in rel.parts[:-1]):
            continue
        kind = classify(path)
        if kind is None:
            if not include_exts:
                file_counts["OTHER"] = file_counts.get("OTHER", 0) + 1
            continue
        if include_exts and path.suffix.lower() not in include_exts:
            continue
        rel_str = rel.as_posix()
        raw = path.read_bytes()
        encoding, text = decode_source(raw, args.encoding, allow_iconv=not args.no_iconv)
        if encoding.startswith("iconv"):
            iconv_used = True
        lines = text.splitlines()
        rec = analyze(kind, rel_str, encoding, lines)
        file_counts[kind] = file_counts.get(kind, 0) + 1

        if kind == "COBOL":
            programs.append(rec)
            for tbl in rec.get("sql_tables", []):
                tables_map.setdefault(tbl, set()).add(rec["name"])
            for call in rec.get("calls", []):
                if call.get("literal"):
                    edges.append({"caller": rec["name"], "callee": call["target"], "line": call["line"]})
        elif kind == "COPYBOOK":
            copybooks.append(rec)
        elif kind == "DDS":
            files.append(rec)
        elif kind == "CL":
            programs.append(rec)
            for call in rec.get("calls", []):
                if call.get("literal"):
                    edges.append({"caller": rec["name"], "callee": call["target"], "line": call["line"]})
        elif kind == "RPG":
            programs.append(rec)
            for call in rec.get("calls", []):
                if call.get("literal"):
                    edges.append({"caller": rec["name"], "callee": call["target"], "line": call["line"]})
        elif kind == "SQL":
            programs.append(rec)
        elif kind == "BINDING":
            bindings.append(rec)

    # Resolve reverse references.
    for cpy in copybooks:
        cpy["used_by"] = sorted(
            p["name"]
            for p in programs
            if cpy["name"] in p.get("copybooks", []) or cpy["name"] in p.get("sql_includes", [])
        )
    for dds in files:
        dds["used_by"] = sorted(
            p["name"]
            for p in programs
            if dds["name"] in p.get("external_files", []) or dds["name"] in p.get("files", [])
        )
    tables = [
        {"name": name, "used_by": sorted(users)}
        for name, users in sorted(tables_map.items())
    ]
    unresolved_calls = [
        {"caller": p["name"], "target": c["target"], "line": c["line"]}
        for p in programs
        for c in p.get("calls", [])
        if not c.get("literal")
    ]
    field_lineage = build_field_lineage(copybooks, files, programs)

    result = {
        "meta": {
            "tool": "scan_as400_codebase.py",
            "version": VERSION,
            "source_root": str(root),
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "file_counts": file_counts,
            "iconv_available": iconv_available(),
            "iconv_used": iconv_used,
        },
        "inventory": {
            "programs": sorted(programs, key=lambda p: p["name"]),
            "copybooks": sorted(copybooks, key=lambda c: c["name"]),
            "files": sorted(files, key=lambda f: f["name"]),
            "tables": tables,
            "binding_dirs": sorted(bindings, key=lambda b: b["name"]),
            "unresolved_calls": unresolved_calls,
            "field_lineage": field_lineage,
        },
        "call_graph": dedupe_edges(edges),
    }

    if args.output:
        out_path = Path(args.output)
    else:
        fmt = "yaml" if args.format == "yaml" else "json"
        out_path = root / "analysis" / f"scan-result.{fmt}"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if args.format == "yaml":
        out_path.write_text(yaml_dump(result), encoding="utf-8")
    else:
        out_path.write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    print(f"[OK] Scanned {root}")
    print(f"     Programs: {len(programs)}, copybooks: {len(copybooks)}, DDS files: {len(files)}, tables: {len(tables)}, bindings: {len(bindings)}")
    print(f"     Call graph edges: {len(result['call_graph'])}, field lineage links: {len(field_lineage)}, unresolved calls: {len(unresolved_calls)}")
    print(f"     Output: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
