from flask import Flask, render_template, jsonify, request
import csv
import json
import os
import uuid
import subprocess
import threading
import time
from datetime import datetime, timedelta
from collections import defaultdict
from config import RANKS, XP_MAP, DIFFICULTIES, SYNC_INTERVAL_HOURS, PORT

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

CSV_FIELDS = [
    'id', 'title', 'link', 'platform', 'difficulty',
    'topic', 'status', 'notes', 'date_solved', 'date_added', 'video_link', 'code',
]


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
    with open(csv_path(subject), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)
    check_and_sync()


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
        today = datetime.now().date()
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

    today_str = datetime.now().date().isoformat()
    today_count = sum(1 for q in solved if q.get('date_solved') == today_str)

    topics = defaultdict(int)
    for q in solved:
        topics[q.get('topic') or 'Other'] += 1

    avg_per_day = 0
    if dates:
        first_date = datetime.fromisoformat(dates[0]).date()
        days_span = (datetime.now().date() - first_date).days + 1
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
    row['date_added'] = datetime.now().date().isoformat()
    for k in ('title', 'link', 'platform', 'difficulty', 'topic', 'status', 'notes', 'date_solved', 'video_link', 'code'):
        if k in d:
            row[k] = d[k]
    row.setdefault('status', 'solved')
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
    with open(topics_path(subject), 'w') as f:
        json.dump(topics, f)
    check_and_sync()


@app.route('/api/<subject>/topics')
def get_topics(subject):
    saved = read_topics(subject)
    from_questions = {q.get('topic') for q in read_all(subject) if q.get('topic')}
    merged = list(dict.fromkeys(saved + sorted(from_questions - set(saved))))
    return jsonify(merged)


@app.route('/api/<subject>/topics', methods=['POST'])
def add_topic(subject):
    name = (request.json or {}).get('name', '').strip()
    if not name:
        return jsonify({'error': 'name required'}), 400
    topics = read_topics(subject)
    if name not in topics:
        topics.append(name)
        write_topics(subject, topics)
    return jsonify({'ok': True}), 201


@app.route('/api/<subject>/topics', methods=['DELETE'])
def delete_topic(subject):
    name = (request.json or {}).get('name', '').strip()
    topics = read_topics(subject)
    topics = [t for t in topics if t != name]
    write_topics(subject, topics)
    return jsonify({'ok': True})


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


def git_push_data():
    try:
        subprocess.run(['git', 'add', 'data/'], cwd=BASE_DIR,
                       capture_output=True, timeout=10)
        result = subprocess.run(
            ['git', 'status', '--porcelain', 'data/'], cwd=BASE_DIR,
            capture_output=True, text=True, timeout=10)
        if not result.stdout.strip():
            return
        subprocess.run(
            ['git', 'commit', '-m', f'data: sync {datetime.now().strftime("%Y-%m-%d %H:%M")}'],
            cwd=BASE_DIR, capture_output=True, timeout=10)
        subprocess.run(['git', 'push'], cwd=BASE_DIR,
                       capture_output=True, timeout=30)
    except Exception:
        pass


_sync_lock = threading.Lock()


def check_and_sync():
    """Sync to git if enough time has passed since last sync."""
    try:
        marker = os.path.join(BASE_DIR, '.last_sync')
        now = time.time()
        if os.path.exists(marker):
            if now - os.path.getmtime(marker) < SYNC_INTERVAL_HOURS * 3600:
                return
        with _sync_lock:
            if os.path.exists(marker):
                if time.time() - os.path.getmtime(marker) < SYNC_INTERVAL_HOURS * 3600:
                    return
            with open(marker, 'w') as f:
                f.write('')
        threading.Thread(target=git_push_data, daemon=True).start()
    except Exception:
        pass


threading.Thread(target=git_push_data, daemon=True).start()


@app.route('/api/deploy', methods=['POST'])
def deploy():
    try:
        subprocess.run(['git', 'stash'], cwd=BASE_DIR,
                       capture_output=True, timeout=10)
        r = subprocess.run(['git', 'pull', '--rebase'], cwd=BASE_DIR,
                           capture_output=True, text=True, timeout=30)
        subprocess.run(['git', 'stash', 'pop'], cwd=BASE_DIR,
                       capture_output=True, timeout=10)
        return jsonify({'ok': True, 'output': r.stdout.strip()})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/sync', methods=['POST'])
def sync():
    try:
        git_push_data()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


if __name__ == '__main__':
    os.makedirs(DATA_DIR, exist_ok=True)
    ensure_csv('dsa')
    print('\n  Placement Prep Tracker')
    print(f'  http://localhost:{PORT}\n')
    app.run(debug=True, port=PORT)
