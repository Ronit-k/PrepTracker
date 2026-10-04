"""Update the workflow schedule from config.py; never edit cron by hand."""
import argparse
from collections import defaultdict
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import GIT_SYNC_TIMES_IST

START = '  # BEGIN GENERATED IST SCHEDULE'
END = '  # END GENERATED IST SCHEDULE'


def schedule_block(values):
    if not isinstance(values, (list, tuple)):
        raise ValueError('GIT_SYNC_TIMES_IST must be a list of HH:MM strings.')
    grouped = defaultdict(set)
    for value in values:
        if not isinstance(value, str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
            raise ValueError(f'Invalid IST time {value!r}; use HH:MM (00:00–23:59).')
        hour, minute = map(int, value.split(':'))
        grouped[minute].add(hour)
    lines = [START]
    if grouped:
        lines.append('  schedule:')
        for minute, hours in sorted(grouped.items()):
            lines += [f"    - cron: '{minute} {','.join(map(str, sorted(hours)))} * * *'",
                      "      timezone: 'Asia/Kolkata'"]
    else:
        lines.append('  # Scheduled backups disabled; manual Run workflow remains available.')
    return '\n'.join(lines + [END])


def generated_workflow(source, times=GIT_SYNC_TIMES_IST):
    before, rest = source.split(START, 1)
    _, after = rest.split(END, 1)
    return before + schedule_block(times) + after


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if config and workflow schedules differ')
    args = parser.parse_args()
    path = ROOT / '.github/workflows/data-backup.yml'
    source = path.read_text()
    updated = generated_workflow(source)
    if args.check:
        if source != updated:
            raise SystemExit('Schedule differs from config.py. Run python scripts/generate_backup_workflow.py and commit both files.')
        print('Workflow schedule matches config.py.')
    else:
        path.write_text(updated)
        print('Updated .github/workflows/data-backup.yml. Commit it together with config.py.')


if __name__ == '__main__':
    main()
