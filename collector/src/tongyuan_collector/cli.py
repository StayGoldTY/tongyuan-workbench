from __future__ import annotations

import argparse
import json
from pathlib import Path

from .pipeline import CollectorPipeline
from .settings import CollectorSettings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TongYuan local collector")
    parser.add_argument("--env-file", type=Path, default=None, help="Optional collector env file")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")

    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("discover", help="Discover configured work sources")
    subparsers.add_parser("sync", help="Collect, sanitize, and sync work sources")
    return parser


def main() -> None:
    parser = build_parser()
    arguments = parser.parse_args()
    settings = CollectorSettings.from_env(arguments.env_file)
    pipeline = CollectorPipeline(settings)

    if arguments.command == "discover":
        result = pipeline.discover()
    else:
        result = pipeline.sync()

    if arguments.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
