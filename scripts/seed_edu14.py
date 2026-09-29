"""Load demo operational data. Safe to run twice.

Default: insert missing rows only. Pass --reset to restore seed fields on
existing demo records (assignee, revision, membership window, ...).
"""

from __future__ import annotations

import argparse

from src.db.engine import session_scope
from src.db.seed import seed_from_document


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Campus 24/7 demo operational data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Overwrite existing demo rows from datasets/edu14_demo.json.",
    )
    args = parser.parse_args()
    with session_scope() as session:
        counts = seed_from_document(session, reset=args.reset)
    print("Seeded", counts, "reset=" + str(args.reset))


if __name__ == "__main__":
    main()
