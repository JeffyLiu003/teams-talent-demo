#!/usr/bin/env python3
"""幂等性测试：校验重复请求结果一致（输入请求JSON序列，输出对比）。"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("responses_json", help="重复请求的响应列表JSON")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    try:
        data = json.load(open(args.responses_json, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False)); sys.exit(3)
    identical = all(r == data[0] for r in data) if data else True
    print(json.dumps({"requests": len(data), "idempotent": identical}, ensure_ascii=False, indent=2))
    sys.exit(0 if identical else 2)

if __name__ == "__main__":
    main()
