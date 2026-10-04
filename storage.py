"""Cross-process lock and atomic file replacement for the CSV store."""
from contextlib import contextmanager
from pathlib import Path
import fcntl
import os
import tempfile

BASE_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = BASE_DIR / '.runtime'


@contextmanager
def file_lock(path, blocking=True):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a') as handle:
        flags = fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB)
        fcntl.flock(handle, flags)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


@contextmanager
def atomic_file(path):
    """Readers see either the previous file or a complete new file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as handle:
            yield handle
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
