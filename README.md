# PrepTracker

A dark, responsive placement-preparation tracker built with Flask, vanilla
JavaScript, and CSV storage. Hosted data saves immediately; GitHub Actions backs
it up on a configurable Indian-time schedule, including on PythonAnywhere's free
plan.

## Features

- Interactive difficulty donut, XP ranks, current/best streaks, and average questions per day.
- Full-year activity heatmap with IST dates, weekday labels, tooltips, and a mobile year picker.
- Collapsible topics with renaming, deletion, and question reordering.
- Multi-select difficulty filter: no selection means all levels; selecting all clears the filter.
- Notes, syntax-highlighted C++ solutions, problem links, and reference material.
- Configurable difficulties and ranks in `config.py`.
- Separate subject CSVs and topic JSON files for future subjects.
- Scheduled GitHub backups with IST commit messages and no empty commits.

## Local setup

Requires Python 3.9+.

```bash
git clone https://github.com/Ronit-k/PrepTracker.git
cd PrepTracker
python -m pip install -r requirements.txt
python server.py
```

Open [localhost:6969](http://localhost:6969). Local data defaults to `data/`.
No Git operations or background workers run when importing or starting Flask.

## How the free backup works

1. The website writes questions and topics to disk immediately.
2. GitHub Actions runs at the times configured in `config.py`.
3. The runner requests `GET /api/backup` over HTTPS with a shared secret.
4. The endpoint returns a consistent, read-only snapshot of subject CSVs and topic JSON files.
5. The runner validates the snapshot, updates `data/` on the repository's default
   branch, and commits/pushes only if data changed.

Example commit: `data: sync 2026-10-04 18:00:12 IST`.
The snapshot includes notes, code, topic changes, and deletions. Export timestamps
are not saved in the repo, so they cannot cause empty/pointless commits.
GitHub uses its built-in `GITHUB_TOKEN` to push; no GitHub personal access token,
SSH key, paid PythonAnywhere task, or continuously running console is needed.
The previous `/api/sync`, `/api/deploy`, and `sync_worker.py` mechanisms are retired.

## One-time PythonAnywhere + GitHub setup

These instructions use **r0nit** on PythonAnywhere and **Ronit-k/PrepTracker** on
GitHub. Follow them after this code is on the repository's default branch. Stop
if a command reports an error rather than forcing a Git reset or overwriting data.

### 1. Preserve your live data and create the shared secret

Open a **Bash console** on PythonAnywhere. Avoid adding/editing questions until
you complete this migration and reload the website.

Run this block once, **before pulling the new code**:

```bash
python3 - <<'PY'
from pathlib import Path
import os
import secrets
import shutil

project = Path.home() / 'PrepTracker'
live = Path.home() / 'preptracker-data'
if live.exists():
    raise SystemExit('preptracker-data already exists. Stop and check it; this script will not overwrite it.')
if not (project / 'data' / 'dsa.csv').is_file():
    raise SystemExit('Cannot find your current data/dsa.csv. Check the project path first.')
shutil.copytree(project / 'data', live)
for source in (project / 'data').iterdir():
    if source.is_file():
        assert source.read_bytes() == (live / source.name).read_bytes(), source.name

secret_dir = Path.home() / '.config' / 'preptracker'
secret_dir.mkdir(parents=True, exist_ok=True)
secret_dir.chmod(0o700)
secret_file = secret_dir / 'backup-token'
if not secret_file.exists():
    fd = os.open(secret_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(secrets.token_urlsafe(48) + '\n')
secret_file.chmod(0o600)
print('Live data copied and verified:', live)
print('Secret stored at:', secret_file)
PY
```

The live data will now be kept in `/home/r0nit/preptracker-data`, outside the Git
checkout. Future code pulls will not overwrite questions added since the last
backup. The original data remains in the old checkout as another copy.

### 2. Pull the updated code

Still in the PythonAnywhere console:

```bash
cd /home/r0nit/PrepTracker
git stash push -m "Live data before Actions backup migration" -- data/
git pull --ff-only
```

The stash retains any uncommitted old data. Do **not** pop it: the verified copy
in `preptracker-data` will be the live store. If the pull reports divergent
branches or local code changes, preserve them and resolve the Git state first;
do not use `reset --hard` to force the update.

### 3. Point the web app at the live data folder

Go to **Web → your r0nit.pythonanywhere.com app → WSGI configuration file**.
Ensure these lines occur **before** importing the Flask app. Keep any existing
virtual-environment setup:

```python
import os
import sys

project = "/home/r0nit/PrepTracker"
if project not in sys.path:
    sys.path.insert(0, project)

os.environ["PREPTRACKER_DATA_DIR"] = "/home/r0nit/preptracker-data"
from server import app as application
```

Save the WSGI file and click **Reload** on the Web tab. Open your site and confirm
your existing questions are present. The export endpoint automatically reads the
secret from `~/.config/preptracker/backup-token`; it is not in your repository.

### 4. Configure the GitHub variable and secret

Open [repository Actions settings](https://github.com/Ronit-k/PrepTracker/settings/secrets/actions).
Under **Settings → Secrets and variables → Actions**:

- On the **Variables** tab, add a repository variable:
  - Name: `PREPTRACKER_SITE_URL`
  - Value: `https://r0nit.pythonanywhere.com`
- On the **Secrets** tab, add a repository secret:
  - Name: `PREPTRACKER_BACKUP_TOKEN`
  - Value: the contents of the token file. Display it in your PythonAnywhere
    console with `cat ~/.config/preptracker/backup-token`, and copy only the token.
    Do not paste it into source code, a URL, a commit, or a chat.

These are two different tabs: **URL = variable**, **token = secret**.
Do not create a PAT. The workflow already requests `contents: write` for its
short-lived built-in GitHub token. Repository policies must allow Actions and
bot commits to the default branch. Branch protection rules are respected.

### 5. Run and verify the first backup

Open [Actions](https://github.com/Ronit-k/PrepTracker/actions) →
**Back up PythonAnywhere data → Run workflow → Run workflow**.
Use the default branch (`main`).

- A successful changed-data run reports that it committed and pushed.
- If the repo already matches the site, the run reports
  **No data changes; no commit created.** This is also success.
- Inspect `data/dsa.csv` and the latest commit to confirm your hosted changes are
  present, with `IST` in the commit message.
- Running it again without website changes should create no commit.

The website stays usable throughout backups. After this one-time setup you do
not need to reload PythonAnywhere for each backup or each added question.

## Choose or change the backup times

Edit `config.py` in your development checkout:

```python
GIT_SYNC_TIMES_IST = ["00:00", "06:00", "12:00", "18:00"]
```

For example, use `["09:15", "21:45"]` for twice daily. Use `[]` to disable
scheduled backups while retaining the manual **Run workflow** button.

Then regenerate the workflow and push both files:

```bash
python scripts/generate_backup_workflow.py
git add config.py .github/workflows/data-backup.yml
git commit -m "Update IST backup schedule"
git push
```

GitHub reads schedules from workflow YAML, not Python files, so regeneration is
required. Do not edit cron manually. The generator validates times, deduplicates
them, and writes `timezone: Asia/Kolkata`. No timezone conversion is needed.
The workflow checks that the generated schedule agrees with `config.py`.
Changing times only on PythonAnywhere does not change GitHub's schedule.
No PythonAnywhere reload is required for a GitHub-only schedule change.

[GitHub schedules can be delayed or occasionally dropped](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
The next successful backup includes all then-current data. Scheduled workflows
run from the default branch, and public-repository schedules can be disabled
after 60 days without repository activity; re-enable them from Actions if needed.
Standard GitHub-hosted runners are
[free for public repos](https://docs.github.com/en/actions/concepts/billing-and-usage);
private repos use the account's included minutes. This workflow runs only at your
chosen times, not every few minutes.

## Updating website code later

Once the live-data directory is configured outside the checkout:

```bash
cd /home/r0nit/PrepTracker
git pull --ff-only
```

Then click **Reload** on PythonAnywhere's Web tab. GitHub's backed-up `data/`
folder inside the checkout is separate from your live `preptracker-data` folder.
Code updates are still a deliberate pull/reload; data backups do not deploy code.
Stop any old sync workers or old scheduled Git-push tasks so that only the new
GitHub workflow performs backups.

## Backup troubleshooting

| Result | Check |
| --- | --- |
| Workflow not listed | Workflow file must be pushed to the default branch; enable Actions if prompted. |
| Job skipped | Add the **variable** `PREPTRACKER_SITE_URL` under Variables, not Secrets. |
| HTTP 404 | Pull the updated server code and reload PythonAnywhere. |
| HTTP 401 | GitHub secret must exactly match the PythonAnywhere token file. |
| HTTP 503 | Check token-file existence/permissions, live-data path, and PythonAnywhere error log. |
| Git push denied | Check workflow write permissions and branch protection; do not disable protections or force-push. |
| Schedule differs from config | Regenerate the YAML and push it with `config.py`. |
| No data changes | Successful no-op; no commit is needed. |
| Site unreachable or expired | Renew/reload the free web app if required, then rerun the workflow. |

Transient download failures retry three times. Concurrent runs are serialized;
concurrent code pushes are rebased when possible, never force-pushed. Snapshot
validation failures stop before changing checkout data. The endpoint only exports
CSV/topic JSON files and refuses symlinks, invalid data, and empty snapshots.

The bearer token protects the backup endpoint only; it does not add user login to
the rest of this personal tracker. Backups retain the repository's existing
visibility: data committed to a public repository is public.

To rotate the secret, replace the token file with a newly generated token and
update the matching GitHub secret. The server reads it on each backup request,
so token rotation needs no web reload. Alternative deployments can supply
`PREPTRACKER_BACKUP_TOKEN` or `PREPTRACKER_BACKUP_TOKEN_FILE` via the environment.

## Topics and filtering

Use **•••** beside a topic's **+** button to rename or delete it. Renaming preserves
question IDs, order, notes, code, and progress. Deletion moves questions to
**Uncategorized** by default; select **Also delete all questions** to delete the
questions and progress too.

Difficulty checkboxes start unchecked. Select one or more to filter; selecting
all or clicking **Clear selection** restores all levels.

## Project structure

```text
PrepTracker/
├── server.py                       # Flask API, IST stats, authenticated export
├── config.py                       # Difficulties, ranks, IST backup times
├── backup.py                       # Snapshot format and validation
├── storage.py                      # Process locks and atomic file writes
├── time_utils.py                   # Shared IST helpers
├── scripts/
│   ├── backup_from_site.py         # GitHub runner download/commit/push
│   └── generate_backup_workflow.py # Build the schedule from config.py
├── .github/workflows/data-backup.yml
├── templates/index.html
├── static/                         # CSS, JavaScript, favicon
├── data/                           # Local data / hosted-data backup in GitHub
├── tests/
└── requirements.txt
```

## Tests

```bash
python -m pip install pytest
python -m pytest -q tests
python scripts/generate_backup_workflow.py --check
node --check static/js/app.js
```

Tests use temporary files and local Git remotes. They do not change saved
questions, contact the live website, or push to GitHub.
