#!/usr/bin/env python3
"""Analyze ESLint JSON output and summarize lint issues."""

import json
import sys
from pathlib import Path


def load_eslint_report(path: Path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON: {exc}", file=sys.stderr)
        sys.exit(1)


def summarize(report):
    total_files = len(report)
    total_warnings = 0
    total_errors = 0

    for file_report in report:
        for message in file_report.get("messages", []):
            if message.get("severity") == 2:
                total_errors += 1
            else:
                total_warnings += 1

    print(f"Files analyzed: {total_files}")
    print(f"Errors: {total_errors}")
    print(f"Warnings: {total_warnings}")


def main(argv):
    if len(argv) != 2:
        print(f"Usage: {argv[0]} <eslint-report.json>", file=sys.stderr)
        return 1

    report_path = Path(argv[1])
    report = load_eslint_report(report_path)
    summarize(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
