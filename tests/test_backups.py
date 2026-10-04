from datetime import datetime
from email.message import Message
from io import BytesIO
import json
from pathlib import Path
import subprocess
from unittest.mock import patch
from urllib.error import HTTPError

import pytest

import server
from backup import make_snapshot, snapshot_digest, validate_snapshot
from scripts.backup_from_site import (NoRedirects, apply_snapshot, backup_url,
                                     commit_snapshot, download_snapshot, git, push_backup)
from scripts.generate_backup_workflow import generated_workflow, schedule_block
from time_utils import IST

TOKEN = 'test-only-secret-with-at-least-32-characters'
CSV = ('id,title,topic,difficulty,status,notes,code\r\n'
       '1,Test,Graphs,medium,revisit,"Line one\nLine two","int main() {}"\r\n')


@pytest.fixture
def data(tmp_path):
    data = tmp_path / 'live'
    data.mkdir()
    (data / 'dsa.csv').write_bytes(CSV.encode())
    (data / 'dsa_topics.json').write_text('["Graphs"]')
    return data


@pytest.fixture
def client(data, tmp_path, monkeypatch):
    monkeypatch.setattr(server, 'DATA_DIR', str(data))
    monkeypatch.setattr(server, 'RUNTIME_DIR', tmp_path / '.runtime')
    monkeypatch.setenv('PREPTRACKER_BACKUP_TOKEN', TOKEN)
    return server.app.test_client()


def test_authenticated_export_is_read_only_and_complete(client, data):
    before = {p.name: p.read_bytes() for p in data.iterdir()}
    (data / 'private.key').write_text('must not be exported')
    with patch('subprocess.run', side_effect=AssertionError('No Git in web app')):
        response = client.get('/api/backup', headers={'Authorization': f'Bearer {TOKEN}'})
    assert response.status_code == 200
    files = validate_snapshot(response.get_json())
    assert files == {name: value.decode() for name, value in before.items()}
    assert 'private.key' not in files
    assert response.headers['Cache-Control'] == 'no-store, private'
    assert response.headers['Vary'] == 'Authorization'
    assert response.get_json()['exported_at'].endswith('+05:30')
    assert {p.name: p.read_bytes() for p in data.iterdir() if p.name in before} == before


@pytest.mark.parametrize('header', ['', 'Bearer wrong', 'Basic ' + TOKEN, 'Bearer प'])
def test_export_rejects_bad_credentials(client, header):
    response = client.get('/api/backup', headers={'Authorization': header})
    assert response.status_code == 401
    assert 'files' not in response.get_json()
    assert 'no-store' in response.headers['Cache-Control']


def test_export_does_not_accept_token_in_query(client):
    assert client.get('/api/backup?token=' + TOKEN).status_code == 401


def test_missing_token_disabled_and_secret_file_supported(client, tmp_path, monkeypatch):
    monkeypatch.delenv('PREPTRACKER_BACKUP_TOKEN')
    secret = tmp_path / 'secret'
    monkeypatch.setenv('PREPTRACKER_BACKUP_TOKEN_FILE', str(secret))
    assert client.get('/api/backup').status_code == 503
    secret.write_text(TOKEN + '\n')
    assert client.get('/api/backup', headers={'Authorization': f'Bearer {TOKEN}'}).status_code == 200


def test_export_refuses_symlinks_and_missing_data(client, data, monkeypatch):
    (data / 'other.csv').symlink_to(data / 'dsa.csv')
    assert client.get('/api/backup', headers={'Authorization': f'Bearer {TOKEN}'}).status_code == 503
    monkeypatch.setattr(server, 'DATA_DIR', str(data / 'missing'))
    assert client.get('/api/backup', headers={'Authorization': f'Bearer {TOKEN}'}).status_code == 503


def test_legacy_git_mutating_web_endpoints_removed(client):
    assert client.post('/api/sync').status_code == 404
    assert client.post('/api/deploy').status_code == 404


def test_schedule_ist_deduplication_and_disabled():
    block = schedule_block(['23:45', '00:05', '12:05', '12:05'])
    assert "cron: '5 0,12 * * *'" in block
    assert "cron: '45 23 * * *'" in block
    assert block.count("timezone: 'Asia/Kolkata'") == 2
    assert '  schedule:' not in schedule_block([])
    for bad in ['24:00', '6:30', '12:60', None, '$(command)']:
        with pytest.raises(ValueError):
            schedule_block([bad])
    workflow = Path('.github/workflows/data-backup.yml').read_text()
    assert generated_workflow(workflow) == workflow


@pytest.fixture
def repo(tmp_path):
    remote = tmp_path / 'remote.git'
    repo = tmp_path / 'repo'
    subprocess.run(['git', 'init', '--bare', str(remote)], check=True, capture_output=True)
    subprocess.run(['git', 'init', '-b', 'main', str(repo)], check=True, capture_output=True)
    git(repo, 'config', 'user.name', 'Test')
    git(repo, 'config', 'user.email', 'test@example.invalid')
    (repo / 'data').mkdir()
    (repo / 'data/dsa.csv').write_text(CSV.replace('Test', 'Old'))
    (repo / 'data/old_topics.json').write_text('[]')
    (repo / 'data/.gitkeep').touch()
    (repo / 'app.txt').write_text('code')
    git(repo, 'add', '.')
    git(repo, 'commit', '-m', 'Initial')
    git(repo, 'remote', 'add', 'origin', str(remote))
    git(repo, 'push', '-u', 'origin', 'main')
    return repo


def test_snapshot_commit_push_repeat_noop_and_deletions(data, repo):
    snapshot = make_snapshot(data)
    (repo / 'app.txt').write_text('unrelated staged code')
    git(repo, 'add', 'app.txt')
    apply_snapshot(repo, snapshot)
    assert not (repo / 'data/old_topics.json').exists()
    assert (repo / 'data/.gitkeep').exists()
    assert (repo / 'data/dsa.csv').read_bytes() == CSV.encode()
    assert commit_snapshot(repo, datetime(2026, 10, 4, 18, 1, tzinfo=IST))
    push_backup(repo)
    assert git(repo, 'log', '-1', '--format=%s') == 'data: sync 2026-10-04 18:01:00 IST'
    assert git(repo, 'diff', '--cached', '--name-only') == 'app.txt'
    assert set(git(repo, 'show', '--format=', '--name-only', 'HEAD').splitlines()) == {
        'data/dsa.csv', 'data/dsa_topics.json', 'data/old_topics.json'}
    head = git(repo, 'rev-parse', 'HEAD')
    apply_snapshot(repo, make_snapshot(data))
    assert commit_snapshot(repo) is False
    assert git(repo, 'rev-parse', 'HEAD') == head
    assert git(repo, 'rev-parse', 'HEAD') == git(repo, 'rev-parse', 'origin/main')


@pytest.mark.parametrize('files', [{}, {'../config.py': 'bad'}, {'dsa.csv': 'wrong header'},
                                     {'dsa.csv': CSV, 'dsa_topics.json': '{}'}])
def test_invalid_snapshot_cannot_change_existing_data(repo, files):
    before = (repo / 'data/dsa.csv').read_bytes()
    payload = {'version': 1, 'timezone': 'Asia/Kolkata', 'files': files, 'sha256': snapshot_digest(files)}
    with pytest.raises(ValueError):
        apply_snapshot(repo, payload)
    assert (repo / 'data/dsa.csv').read_bytes() == before


def test_checksum_rejection_and_symlink_write_protection(data, repo):
    payload = make_snapshot(data)
    payload['sha256'] = 'wrong'
    with pytest.raises(ValueError):
        apply_snapshot(repo, payload)
    payload = make_snapshot(data)
    (repo / 'data/dsa.csv').unlink()
    (repo / 'data/dsa.csv').symlink_to(repo / 'app.txt')
    with pytest.raises(ValueError):
        apply_snapshot(repo, payload)
    assert (repo / 'app.txt').read_text() == 'code'


def test_push_rebases_concurrent_code_commit_without_force(data, repo, tmp_path):
    apply_snapshot(repo, make_snapshot(data))
    assert commit_snapshot(repo)
    other = tmp_path / 'other'
    subprocess.run(['git', 'clone', '-b', 'main', str(tmp_path / 'remote.git'), str(other)], check=True, capture_output=True)
    git(other, 'config', 'user.name', 'Other')
    git(other, 'config', 'user.email', 'other@example.invalid')
    (other / 'app.txt').write_text('new remote code')
    git(other, 'add', 'app.txt')
    git(other, 'commit', '-m', 'Concurrent code change')
    git(other, 'push')
    push_backup(repo)
    assert (repo / 'app.txt').read_text() == 'new remote code'
    assert git(repo, 'rev-parse', 'HEAD') == git(repo, 'rev-parse', 'origin/main')


def test_https_only_and_no_credential_redirects():
    assert backup_url('https://r0nit.pythonanywhere.com/') == 'https://r0nit.pythonanywhere.com/api/backup'
    for url in ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?token=secret']:
        with pytest.raises(ValueError):
            backup_url(url)
    assert NoRedirects().redirect_request(None, None, 302, '', {}, 'https://other.invalid') is None


def test_transient_download_retries_without_logging_secrets(data):
    payload = json.dumps(make_snapshot(data)).encode()
    class Response(BytesIO):
        headers = Message()
        headers['Content-Type'] = 'application/json'
    class Opener:
        attempts = 0
        def open(self, request, timeout):
            assert request.get_header('Authorization') == 'Bearer ' + TOKEN
            self.attempts += 1
            if self.attempts == 1:
                raise HTTPError(request.full_url, 502, 'temporary', {}, None)
            return Response(payload)
    opener = Opener()
    assert download_snapshot('https://example.com', TOKEN, opener=opener, sleep=lambda _: None)['files']['dsa.csv'] == CSV
    assert opener.attempts == 2


def test_export_to_commit_integration(client, repo):
    # Full route -> validation -> local commit -> local remote, no production data.
    response = client.get('/api/backup', headers={'Authorization': f'Bearer {TOKEN}'})
    assert response.status_code == 200
    apply_snapshot(repo, response.get_json())
    assert commit_snapshot(repo)
    push_backup(repo)
    assert git(repo, 'show', 'origin/main:data/dsa.csv').replace('\r\n', '\n') == CSV.strip().replace('\r\n', '\n')


def test_malformed_csv_rejected_before_any_writes(repo):
    files = {'dsa.csv': 'id,title,topic,difficulty,status\n1,"unterminated,Graphs,easy,solved'}
    payload = {'version': 1, 'timezone': 'Asia/Kolkata', 'files': files, 'sha256': snapshot_digest(files)}
    before = (repo / 'data/dsa.csv').read_bytes()
    with pytest.raises(ValueError):
        apply_snapshot(repo, payload)
    assert (repo / 'data/dsa.csv').read_bytes() == before


def test_importing_web_app_never_launches_git():
    # A fresh interpreter avoids modifying the module used by other tests.
    result = subprocess.run(['python', '-c',
        "from unittest.mock import patch\nwith patch('subprocess.run', side_effect=AssertionError('unexpected Git')):\n import server"],
        text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
