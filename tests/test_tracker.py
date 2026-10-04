import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from unittest.mock import patch

import pytest

import server
from time_utils import IST


@pytest.fixture
def client(tmp_path, monkeypatch):
    data = tmp_path / 'data'
    data.mkdir()
    monkeypatch.setattr(server, 'DATA_DIR', str(data))
    monkeypatch.setattr(server, 'RUNTIME_DIR', tmp_path / '.runtime')
    return server.app.test_client()


def question(client, topic='Graphs', difficulty='easy'):
    return client.post('/api/dsa/questions', json={
        'title': 'Example', 'topic': topic, 'difficulty': difficulty,
        'notes': 'Keep notes', 'code': 'int main() {}', 'status': 'revisit',
    }).get_json()


def test_ist_midnight_default_and_stats(client):
    # UTC is still October 3, but India has entered October 4.
    instant = datetime(2026, 10, 3, 19, 0, tzinfo=timezone.utc)
    with patch('time_utils.now_ist', return_value=instant.astimezone(IST)):
        q = question(client)
        assert q['date_added'] == q['date_solved'] == '2026-10-04'
        stats = client.get('/api/dashboard').get_json()
        assert stats['current_streak'] == 1
        assert stats['today_count'] == 1
        assert stats['avg_per_day'] == 1
        assert stats['total_xp'] == 10


def test_topic_rename_preserves_questions_and_rejects_collision(client):
    q = question(client)
    name = 'Trees / "BST" & DSA\'s'
    result = client.put('/api/dsa/topics', json={'name': 'Graphs', 'new_name': name})
    assert result.status_code == 200
    updated = client.get('/api/dsa/questions').get_json()[0]
    assert updated == {**q, 'topic': name}
    assert client.get('/api/dsa/topics').get_json() == [name]
    question(client, 'Arrays')
    assert client.put('/api/dsa/topics', json={'name': name, 'new_name': 'arrays'}).status_code == 409
    assert client.put('/api/dsa/topics', json={'name': name, 'new_name': ' '}).status_code == 400


def test_delete_topic_keep_or_delete(client):
    q = question(client)
    assert client.delete('/api/dsa/topics', json={'name': 'Graphs'}).status_code == 400
    assert client.delete('/api/dsa/topics', json={'name': 'Graphs', 'question_action': 'keep'}).status_code == 200
    assert client.get('/api/dsa/questions').get_json()[0] == {**q, 'topic': 'Uncategorized'}
    assert client.get('/api/dsa/topics').get_json() == ['Uncategorized']
    assert client.delete('/api/dsa/topics', json={'name': 'Uncategorized', 'question_action': 'delete'}).status_code == 200
    assert client.get('/api/dsa/questions').get_json() == []
    assert client.get('/api/dsa/topics').get_json() == []


def test_empty_topic_delete(client):
    client.post('/api/dsa/topics', json={'name': 'Empty'})
    assert client.delete('/api/dsa/topics', json={'name': 'Empty'}).status_code == 200
    assert client.delete('/api/dsa/topics', json={'name': 'Missing'}).status_code == 404


def test_browser_calendar_date_is_ist_in_other_timezones():
    import os
    import shutil
    if not shutil.which('node'):
        pytest.skip('Node is required for browser date helper verification')
    source = Path('static/js/app.js').read_text()
    helper = source[source.index('function indiaDateKey'):source.index('function indiaToday')]
    js = helper + "\nconsole.log(indiaDateKey(new Date('2026-12-31T18:31:00Z')));"
    for zone in ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']:
        result = subprocess.run(['node', '-e', js], env={**os.environ, 'TZ': zone}, text=True, capture_output=True, check=True)
        assert result.stdout.strip() == '2027-01-01'
