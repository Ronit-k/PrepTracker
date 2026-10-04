from flask import Flask, render_template, jsonify, request, g
import csv
import json
import os
import uuid
import hmac
import re
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
from config import RANKS, XP_MAP, DIFFICULTIES, PORT

from storage import atomic_file, file_lock, RUNTIME_DIR
from time_utils import today_ist
from backup import make_snapshot

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get('PREPTRACKER_DATA_DIR', os.path.join(BASE_DIR, 'data'))

CSV_FIELDS = [
    'id', 'title', 'link', 'platform', 'difficulty',
    'topic', 'status', 'notes', 'date_solved', 'date_added', 'video_link', 'code',
]


@app.before_request
def lock_data_request():
    if request.endpoint == 'export_backup':
        error = authorize_backup()
        if error:
            return error
    if request.path.startswith('/api/') and request.endpoint != 'get_config':
        lock = file_lock(RUNTIME_DIR / 'data.lock')
        lock.__enter__()
        g.data_lock = lock


@app.teardown_request
def unlock_data_request(error):
    lock = g.pop('data_lock', None)
    if lock:
        lock.__exit__(None, None, None)


def csv_path(subject):
    return os.path.join(DATA_DIR, f'{subject}.csv')


def ensure_csv(subject):
    p = csv_path(subject)
    if not os.path.exists(p):
        with open(p, 'w', newline='') as f:
            csv.DictWriter(f, fieldnames=CSV_FIELDS).writeheader()


def read_all(subject):
    ensure_csv(subject)
    with open(csv_path(subject), 'r', newline='') as f:
        return list(csv.DictReader(f))


def write_all(subject, rows):
    with atomic_file(csv_path(subject)) as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)


def calc_stats(questions):
    solved = [q for q in questions if q.get('status') in ('solved', 'revisit')]
    total_xp = sum(XP_MAP.get(q.get('difficulty', ''), 0) for q in solved)

    rank_idx = 0
    for i, (threshold, _, _) in enumerate(RANKS):
        if total_xp >= threshold:
            rank_idx = i

    rank_name = RANKS[rank_idx][1]
    rank_color = RANKS[rank_idx][2]
    cur_thresh = RANKS[rank_idx][0]

    if rank_idx < len(RANKS) - 1:
        nxt_thresh = RANKS[rank_idx + 1][0]
        nxt_rank = RANKS[rank_idx + 1][1]
        progress = (total_xp - cur_thresh) / (nxt_thresh - cur_thresh)
    else:
        nxt_thresh = None
        nxt_rank = None
        progress = 1.0

    dates = sorted({q['date_solved'] for q in solved if q.get('date_solved')})

    current_streak = 0
    best_streak = 0
    if dates:
        date_set = set(dates)
        today = today_ist()
        check = today
        while check.isoformat() in date_set:
            current_streak += 1
            check -= timedelta(days=1)
        if current_streak == 0:
            check = today - timedelta(days=1)
            while check.isoformat() in date_set:
                current_streak += 1
                check -= timedelta(days=1)

        streak = 1
        best_streak = 1
        for i in range(1, len(dates)):
            d1 = datetime.fromisoformat(dates[i - 1]).date()
            d2 = datetime.fromisoformat(dates[i]).date()
            if (d2 - d1).days == 1:
                streak += 1
                best_streak = max(best_streak, streak)
            else:
                streak = 1

    heatmap = defaultdict(int)
    for q in solved:
        if q.get('date_solved'):
            heatmap[q['date_solved']] += 1

    today_str = today_ist().isoformat()
    today_count = sum(1 for q in solved if q.get('date_solved') == today_str)

    topics = defaultdict(int)
    for q in solved:
        topics[q.get('topic') or 'Other'] += 1

    avg_per_day = 0
    if dates:
        first_date = datetime.fromisoformat(dates[0]).date()
        days_span = (today_ist() - first_date).days + 1
        if days_span > 0:
            avg_per_day = round(len(solved) / days_span, 2)

    return {
        'total_solved': len(solved),
        'total_questions': len(questions),
        'total_xp': total_xp,
        'rank': rank_name,
        'rank_color': rank_color,
        'next_rank': nxt_rank,
        'current_threshold': cur_thresh,
        'next_threshold': nxt_thresh,
        'rank_progress': round(progress, 3),
        'rank_index': rank_idx,
        'current_streak': current_streak,
        'best_streak': best_streak,
        'today_count': today_count,
        **{d[0]: sum(1 for q in solved if q.get('difficulty') == d[0]) for d in DIFFICULTIES},
        'topics': dict(topics),
        'heatmap': dict(heatmap),
        'avg_per_day': avg_per_day,
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/config')
def get_config():
    return jsonify({
        'timezone': 'Asia/Kolkata',
        'today': today_ist().isoformat(),
        'difficulties': [
            {'key': k, 'label': l, 'xp': xp, 'color': c, 'bg': bg}
            for k, l, xp, c, bg in DIFFICULTIES
        ],
        'ranks': [
            {'xp': xp, 'name': n, 'color': c}
            for xp, n, c in RANKS
        ],
    })


@app.route('/api/<subject>/questions')
def get_questions(subject):
    return jsonify(read_all(subject))


@app.route('/api/<subject>/questions', methods=['POST'])
def add_question(subject):
    d = request.json
    rows = read_all(subject)
    row = {f: '' for f in CSV_FIELDS}
    row['id'] = uuid.uuid4().hex[:8]
    row['date_added'] = today_ist().isoformat()
    for k in ('title', 'link', 'platform', 'difficulty', 'topic', 'status', 'notes', 'date_solved', 'video_link', 'code'):
        if k in d:
            row[k] = d[k]
    row['status'] = row['status'] or 'solved'
    if not row['date_solved'] and row['status'] in ('solved', 'revisit'):
        row['date_solved'] = today_ist().isoformat()
    rows.append(row)
    write_all(subject, rows)
    return jsonify(row), 201


@app.route('/api/<subject>/questions/<qid>', methods=['PUT'])
def update_question(subject, qid):
    d = request.json
    rows = read_all(subject)
    for r in rows:
        if r['id'] == qid:
            for k in d:
                if k in CSV_FIELDS and k != 'id':
                    r[k] = d[k]
            break
    write_all(subject, rows)
    return jsonify({'ok': True})


@app.route('/api/<subject>/questions/<qid>', methods=['DELETE'])
def delete_question(subject, qid):
    rows = read_all(subject)
    rows = [r for r in rows if r['id'] != qid]
    write_all(subject, rows)
    return jsonify({'ok': True})


@app.route('/api/<subject>/reorder', methods=['PUT'])
def reorder_questions(subject):
    ids = (request.json or {}).get('ids', [])
    rows = read_all(subject)
    by_id = {r['id']: r for r in rows}
    ordered = [by_id[i] for i in ids if i in by_id]
    remaining = [r for r in rows if r['id'] not in {i for i in ids}]
    write_all(subject, ordered + remaining)
    return jsonify({'ok': True})


def topics_path(subject):
    return os.path.join(DATA_DIR, f'{subject}_topics.json')


def read_topics(subject):
    p = topics_path(subject)
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return []


def write_topics(subject, topics):
    with atomic_file(topics_path(subject)) as f:
        json.dump(topics, f)


@app.route('/api/<subject>/topics')
def get_topics(subject):
    saved = read_topics(subject)
    from_questions = {q.get('topic') for q in read_all(subject) if q.get('topic')}
    merged = list(dict.fromkeys(saved + sorted(from_questions - set(saved))))
    return jsonify(merged)


@app.route('/api/<subject>/topics', methods=['POST'])
def add_topic(subject):
    name = (request.json or {}).get('name', '').strip()
    if not name or len(name) > 100:
        return jsonify({'error': 'Use a topic name between 1 and 100 characters.'}), 400
    topics = list(dict.fromkeys(read_topics(subject) + [r['topic'] for r in read_all(subject) if r.get('topic')]))
    if any(t.casefold() == name.casefold() for t in topics):
        return jsonify({'error': 'A topic with that name already exists.'}), 409
    topics.append(name)
    write_topics(subject, topics)
    return jsonify({'ok': True}), 201


@app.route('/api/<subject>/topics', methods=['PUT'])
def rename_topic(subject):
    d = request.get_json() or {}
    name, new_name = d.get('name', '').strip(), d.get('new_name', '').strip()
    if not new_name or len(new_name) > 100:
        return jsonify({'error': 'Use a topic name between 1 and 100 characters.'}), 400
    rows = read_all(subject)
    topics = list(dict.fromkeys(read_topics(subject) + [r['topic'] for r in rows if r.get('topic')]))
    if name not in topics:
        return jsonify({'error': 'Topic no longer exists.'}), 404
    if new_name != name and any(t.casefold() == new_name.casefold() for t in topics if t != name):
        return jsonify({'error': 'A topic with that name already exists.'}), 409
    for row in rows:
        if row.get('topic') == name:
            row['topic'] = new_name
    write_all(subject, rows)
    write_topics(subject, [new_name if t == name else t for t in topics])
    return jsonify({'ok': True})


@app.route('/api/<subject>/topics', methods=['DELETE'])
def delete_topic(subject):
    d = request.get_json() or {}
    name = d.get('name', '').strip()
    rows = read_all(subject)
    topics = list(dict.fromkeys(read_topics(subject) + [r['topic'] for r in rows if r.get('topic')]))
    if name not in topics:
        return jsonify({'error': 'Topic no longer exists.'}), 404
    affected = [r for r in rows if r.get('topic') == name]
    mode = d.get('question_action')
    if affected and mode not in ('keep', 'delete'):
        return jsonify({'error': 'Choose whether to keep or delete the questions.'}), 400
    topics = [t for t in topics if t != name]
    if affected and mode == 'keep':
        target = 'Uncategorized' if name != 'Uncategorized' else 'Other'
        for row in affected:
            row['topic'] = target
        if target not in topics:
            topics.append(target)
    elif affected:
        rows = [r for r in rows if r.get('topic') != name]
    write_all(subject, rows)
    write_topics(subject, topics)
    return jsonify({'ok': True, 'affected': len(affected)})


@app.route('/api/<subject>/stats')
def get_stats(subject):
    return jsonify(calc_stats(read_all(subject)))


@app.route('/api/subjects')
def list_subjects():
    subs = []
    for f in sorted(os.listdir(DATA_DIR)):
        if f.endswith('.csv'):
            name = f[:-4]
            rows = read_all(name)
            solved = sum(1 for r in rows if r.get('status') in ('solved', 'revisit'))
            subs.append({'id': name, 'label': name.upper(), 'total': len(rows), 'solved': solved})
    return jsonify(subs)


@app.route('/api/dashboard')
def dashboard():
    all_questions = []
    for f in sorted(os.listdir(DATA_DIR)):
        if f.endswith('.csv'):
            name = f[:-4]
            for row in read_all(name):
                row['_subject'] = name
                all_questions.append(row)
    return jsonify(calc_stats(all_questions))


def authorize_backup():
    token = os.environ.get('PREPTRACKER_BACKUP_TOKEN', '')
    if not token:
        token_path = Path(os.environ.get('PREPTRACKER_BACKUP_TOKEN_FILE',
                                        str(Path.home() / '.config/preptracker/backup-token')))
        try:
            token = token_path.read_text().strip()
        except OSError:
            token = ''
    if not re.fullmatch(r'[A-Za-z0-9_-]{32,256}', token):
        return jsonify({'error': 'Backup token has not been configured.'}), 503
    header = request.headers.get('Authorization', '')
    supplied = header[7:] if header.startswith('Bearer ') else ''
    if not hmac.compare_digest(supplied.encode('utf-8'), token.encode('utf-8')):
        return jsonify({'error': 'Unauthorized'}), 401
    return None


@app.after_request
def prevent_backup_caching(response):
    if request.endpoint == 'export_backup':
        response.headers['Cache-Control'] = 'no-store, private'
        response.headers['Vary'] = 'Authorization'
        response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.route('/api/backup', methods=['GET'])
def export_backup():
    """The Actions runner pulls a consistent snapshot; this route never runs Git."""
    try:
        return jsonify(make_snapshot(DATA_DIR))
    except (ValueError, OSError) as error:
        app.logger.error('Backup snapshot failed: %s', error)
        return jsonify({'error': 'Unable to create a complete data snapshot; check the server error log.'}), 503


if __name__ == '__main__':
    os.makedirs(DATA_DIR, exist_ok=True)
    ensure_csv('dsa')
    print('\n  Placement Prep Tracker')
    print(f'  http://localhost:{PORT}\n')
    app.run(debug=True, port=PORT)
