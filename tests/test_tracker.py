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


def test_configured_subjects_initialize_on_wsgi_request_without_overwriting_data(client, tmp_path):
    original = question(client)
    before = Path(server.csv_path('dsa')).read_bytes()
    subjects = client.get('/api/subjects').get_json()
    assert [s['id'] for s in subjects] == ['dsa', 'sql']
    assert subjects[0]['total'] == 1
    assert subjects[1] == {'id': 'sql', 'label': 'SQL', 'language': 'sql',
                           'language_label': 'SQL', 'total': 0, 'solved': 0}
    assert client.get('/api/sql/questions').get_json() == []
    assert Path(server.csv_path('dsa')).read_bytes() == before
    assert client.get('/api/dsa/questions').get_json() == [original]
    # A new installation also works when Flask is imported by WSGI.
    server.DATA_DIR = str(tmp_path / 'new-live-directory')
    assert client.get('/api/subjects').status_code == 200
    assert Path(server.csv_path('sql')).is_file()


def test_sql_questions_topics_and_stats_are_independent(client):
    dsa = question(client, 'Joins')
    dsa_bytes = Path(server.csv_path('dsa')).read_bytes()
    code = "SELECT name, COUNT(*) AS total\nFROM employees\nGROUP BY name;\n-- हिंदी"
    payload = {'title': 'Count employees', 'topic': 'Joins', 'code': code,
               'notes': 'Group by name.\nKeep every row.', 'difficulty': 'medium',
               'link': 'https://leetcode.com/problems/combine-two-tables/',
               'video_link': 'https://example.com/sql', 'status': 'revisit'}
    added = client.post('/api/sql/questions', json=payload)
    assert added.status_code == 201
    sql = added.get_json()
    assert client.get('/api/sql/questions').get_json() == [sql]
    assert client.get('/api/sql/stats').get_json()['total_xp'] == 25
    assert client.get('/api/dashboard').get_json()['total_xp'] == 35
    assert client.put('/api/sql/questions/' + sql['id'], json={'notes': 'Updated notes'}).status_code == 200
    assert client.put('/api/sql/topics', json={'name': 'Joins', 'new_name': 'Aggregates'}).status_code == 200
    updated = client.get('/api/sql/questions').get_json()[0]
    assert updated['code'] == code
    assert updated['notes'] == 'Updated notes'
    assert updated['topic'] == 'Aggregates'
    assert client.get('/api/dsa/topics').get_json() == ['Joins']
    assert client.get('/api/dsa/questions').get_json() == [dsa]
    assert Path(server.csv_path('dsa')).read_bytes() == dsa_bytes
    assert client.delete('/api/sql/topics', json={'name': 'Aggregates', 'question_action': 'delete'}).status_code == 200
    assert client.get('/api/sql/questions').get_json() == []
    assert client.get('/api/dashboard').get_json()['total_xp'] == 10


@pytest.mark.parametrize('subject', ['dsa', 'sql'])
def test_reordering_preserves_hidden_items_and_rejects_duplicate_records(client, subject):
    questions = [client.post(f'/api/{subject}/questions', json={
        'title': name, 'topic': name, 'difficulty': 'easy',
    }).get_json() for name in ['First', 'Second', 'Third']]
    ids = [q['id'] for q in questions]
    assert client.put(f'/api/{subject}/reorder', json={'ids': [ids[2], ids[0], ids[2]]}).status_code == 200
    assert [q['id'] for q in client.get(f'/api/{subject}/questions').get_json()] == [ids[2], ids[0], ids[1]]
    assert client.put(f'/api/{subject}/topics/reorder', json={'names': ['Third', 'Third', 'First']}).status_code == 200
    assert client.get(f'/api/{subject}/topics').get_json() == ['Third', 'First', 'Second']
    assert client.put(f'/api/{subject}/topics/reorder', json={'names': [None]}).status_code == 400
    assert client.put(f'/api/{subject}/reorder', json={'ids': 'not-a-list'}).status_code == 400


def test_existing_extra_subjects_remain_visible(client):
    client.post('/api/dbms/questions', json={'title': 'Normalization', 'topic': 'Relations'})
    assert [s['id'] for s in client.get('/api/subjects').get_json()] == ['dsa', 'sql', 'dbms']
    assert client.get('/api/dashboard').get_json()['total_questions'] == 1


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
