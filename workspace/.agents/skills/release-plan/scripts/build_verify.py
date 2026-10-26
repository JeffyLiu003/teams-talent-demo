#!/usr/bin/env python3
"""校验制品指纹与构建记录一致性。输入JSON: {artifact:{name,sha256}, build:{sha256}}。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("verify_json", help="含artifact/build指纹的JSON")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.verify_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    a = data.get("artifact", {}).get("sha256")
    b = data.get("build", {}).get("sha256")
    match = bool(a and b and a == b)
    print(json.dumps({"artifact_sha": a, "build_sha": b, "match": match}, ensure_ascii=False, indent=2))
    sys.exit(0 if match else 2)

if __name__ == "__main__":
    main()
