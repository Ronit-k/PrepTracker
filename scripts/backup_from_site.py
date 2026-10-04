"""Fetch the hosted data snapshot and commit it on the GitHub runner.

Secrets are passed through environment variables, never command-line arguments.
Requires only the Python standard library; it never imports the Flask app.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backup import MAX_BACKUP_BYTES, is_data_file, validate_snapshot
from storage import atomic_file
from time_utils import IST, now_ist


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward a bearer token to another host (or to HTTP).
        return None


def backup_url(site_url):
    parts = urlsplit(site_url)
    if (parts.scheme != 'https' or not parts.hostname or parts.username or parts.password
            or parts.query or parts.fragment or parts.path not in ('', '/')):
        raise ValueError('PREPTRACKER_SITE_URL must be an HTTPS site origin, e.g. https://r0nit.pythonanywhere.com')
    return site_url.rstrip('/') + '/api/backup'


def download_snapshot(site_url, token, opener=None, sleep=time.sleep):
    url = backup_url(site_url)
    if not token or len(token) < 32 or any(c.isspace() for c in token):
        raise ValueError('Set the PREPTRACKER_BACKUP_TOKEN repository secret (at least 32 characters).')
    opener = opener or build_opener(NoRedirects)
    request = Request(url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
    # JSON escaping can be larger than the decoded data. Both sizes are capped.
    limit = MAX_BACKUP_BYTES * 6 + 1024 * 1024
    for attempt in range(3):
        try:
            with opener.open(request, timeout=45) as response:
                if response.headers.get_content_type() != 'application/json':
                    raise ValueError('The site did not return JSON. Check the URL and reload the updated web app.')
                raw = response.read(limit + 1)
            if len(raw) > limit:
                raise ValueError('Backup response is too large.')
            payload = json.loads(raw)
            validate_snapshot(payload)
            return payload
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                # Do not print response bodies, URLs containing secrets, or headers.
                raise RuntimeError(f'Backup endpoint returned HTTP {error.code}. Check the site URL, deployment, and shared token.') from None
        except (URLError, TimeoutError):
            if attempt == 2:
                raise RuntimeError('Unable to reach backup endpoint after 3 attempts.') from None
        sleep(5 * (attempt + 1))


def apply_snapshot(repo, payload):
    files = validate_snapshot(payload)  # Validate the entire snapshot before writing.
    root = Path(repo) / 'data'
    if root.is_symlink():
        raise ValueError('Refusing to write through a symlinked data directory.')
    root.mkdir(exist_ok=True)
    existing = [p for p in root.iterdir() if is_data_file(p.name)]
    if any(p.is_symlink() or not p.is_file() for p in existing):
        raise ValueError('Refusing to overwrite non-regular data files.')
    for name, content in files.items():
        path = root / name
        if not path.exists() or path.read_bytes() != content.encode('utf-8'):
            with atomic_file(path) as handle:
                handle.write(content)
    for path in existing:
        if path.name not in files:
            path.unlink()
    return len(files)


def git(repo, *args):
    result = subprocess.run(['git', *args], cwd=repo, text=True, capture_output=True,
                            timeout=90, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    if result.returncode:
        # Git output can contain remote credentials; keep the public log generic.
        raise RuntimeError(f'git {args[0]} failed. Check Actions write permissions, branch rules, and concurrent changes.')
    return result.stdout.strip()


def commit_snapshot(repo=ROOT, now=None):
    repo = Path(repo)
    paths = ['data/' + p.name for p in (repo / 'data').iterdir() if is_data_file(p.name)]
    tracked = git(repo, 'ls-files', '-z', '--', 'data/')
    paths.extend(p for p in tracked.split('\0') if p.startswith('data/') and is_data_file(p[5:]))
    paths = sorted(set(paths))
    git(repo, 'add', '-A', '--', *paths)
    if not git(repo, 'diff', '--cached', '--name-only', '--', *paths):
        return False
    instant = (now or now_ist()).astimezone(IST)
    git(repo, 'commit', '--only', '-m', f'data: sync {instant:%Y-%m-%d %H:%M:%S} IST', '--', *paths)
    return True


def push_backup(repo=ROOT):
    for attempt in range(3):
        try:
            git(repo, 'push', 'origin', 'HEAD')
            return
        except RuntimeError:
            if attempt == 2:
                raise
            # Merge concurrent code changes without force pushing. Conflicts
            # fail the run; the live site remains the authoritative data store.
            try:
                git(repo, 'pull', '--rebase', 'origin', git(repo, 'branch', '--show-current'))
            except RuntimeError:
                try:
                    git(repo, 'rebase', '--abort')
                except RuntimeError:
                    pass
                raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only', action='store_true', help='Verify authentication and snapshot without writing files')
    args = parser.parse_args()
    try:
        payload = download_snapshot(os.environ.get('PREPTRACKER_SITE_URL', ''),
                                    os.environ.get('PREPTRACKER_BACKUP_TOKEN', ''))
        files = validate_snapshot(payload)
        if args.check_only:
            print(f'Backup endpoint verified: {len(files)} data files. No files changed.')
            return
        apply_snapshot(ROOT, payload)
        if commit_snapshot():
            push_backup()
            result = f'Backed up {len(files)} data files; committed and pushed with an IST timestamp.'
        else:
            result = 'No data changes; no commit created.'
        print(result)
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as handle:
                handle.write(result + '\n')
    except (ValueError, RuntimeError, OSError) as error:
        print(f'Backup failed: {error}', file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
