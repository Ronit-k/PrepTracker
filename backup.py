"""Read-only backup format shared by Flask and the GitHub Actions client."""
import csv
import hashlib
import io
import json
from pathlib import Path
import re

from time_utils import now_ist

MAX_BACKUP_BYTES = 50 * 1024 * 1024
csv.field_size_limit(MAX_BACKUP_BYTES)
DATA_NAME = re.compile(r'[A-Za-z0-9_-]+(?:\.csv|_topics\.json)\Z')


def is_data_file(name):
    return isinstance(name, str) and DATA_NAME.fullmatch(name) is not None


def validate_files(files):
    if not isinstance(files, dict) or not any(name.endswith('.csv') for name in files if isinstance(name, str)):
        raise ValueError('Backup must contain at least one subject CSV; refusing an empty snapshot.')
    size = 0
    for name, content in files.items():
        if not is_data_file(name) or not isinstance(content, str):
            raise ValueError('Backup contains an invalid file name or file content.')
        size += len(content.encode('utf-8'))
        if size > MAX_BACKUP_BYTES:
            raise ValueError('Backup exceeds the 50 MiB limit.')
        if name.endswith('.csv'):
            reader = csv.DictReader(io.StringIO(content, newline=''), strict=True)
            required = {'id', 'title', 'topic', 'difficulty', 'status'}
            if not required.issubset(reader.fieldnames or []):
                raise ValueError(f'{name}: missing question CSV columns.')
            ids = set()
            try:
                for row in reader:
                    if None in row or None in row.values() or not row['id'] or row['id'] in ids:
                        raise ValueError(f'{name}: malformed or duplicate question row.')
                    ids.add(row['id'])
            except csv.Error:
                raise ValueError(f'{name}: invalid CSV formatting.') from None
        else:
            topics = json.loads(content)
            if not isinstance(topics, list) or not all(isinstance(t, str) for t in topics):
                raise ValueError(f'{name}: topics must be a list of names.')
    return files


def snapshot_digest(files):
    canonical = json.dumps(files, sort_keys=True, ensure_ascii=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def make_snapshot(data_dir):
    """Caller holds the same data lock as question mutations."""
    root = Path(data_dir)
    files = {}
    size = 0
    for path in sorted(root.iterdir()):
        if not is_data_file(path.name):
            continue
        if path.is_symlink() or not path.is_file():
            raise ValueError('Data backups only support regular files.')
        size += path.stat().st_size
        if size > MAX_BACKUP_BYTES:
            raise ValueError('Backup exceeds the 50 MiB limit.')
        files[path.name] = path.read_bytes().decode('utf-8')
    validate_files(files)
    return {
        'version': 1,
        'exported_at': now_ist().isoformat(),
        'timezone': 'Asia/Kolkata',
        'sha256': snapshot_digest(files),
        'files': files,
    }


def validate_snapshot(payload):
    if not isinstance(payload, dict) or payload.get('version') != 1 or payload.get('timezone') != 'Asia/Kolkata':
        raise ValueError('Unsupported backup response.')
    files = validate_files(payload.get('files'))
    if payload.get('sha256') != snapshot_digest(files):
        raise ValueError('Backup checksum does not match its files.')
    return files
