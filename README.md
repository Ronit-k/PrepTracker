# PrepTracker

A placement preparation tracker with an Apple-inspired dark UI, built with Flask and vanilla JS.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.x-000?logo=flask)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Dashboard** — donut chart, XP rank progression, streak tracking, avg questions/day
- **Heatmap** — GitHub-style contribution calendar with scroll-to-change-year, weekday labels, full Jan–Dec view
- **Topic folders** — collapsible folders with smooth animations, drag-to-reorder questions
- **Custom dropdowns** — styled status & difficulty selectors matching the dark theme
- **Date picker** — frosted-glass calendar popup with month navigation
- **Code storage** — save C++ solutions with syntax highlighting (Highlight.js)
- **XP & ranks** — earn points for solved/revisit questions, progress through 8 ranks (Newbie → Grandmaster)
- **Auto data sync** — changes on the hosted site auto-push to GitHub
- **Multi-subject** — add multiple subjects (DSA, OS, DBMS, etc.), each with its own CSV

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Flask, CSV storage, JSON topic config |
| Frontend | Vanilla JS, CSS custom properties, backdrop-filter materials |
| Design | Apple design principles — spring transitions, translucent materials, dark theme |
| Hosting | PythonAnywhere (free tier) |

## Setup

```bash
# Clone
git clone https://github.com/Ronit-k/PrepTracker.git
cd PrepTracker

# Install
pip install flask

# Run
python server.py
```

Open [http://localhost:6969](http://localhost:6969)

## Project Structure

```
PrepTracker/
├── server.py              # Flask backend, CRUD APIs, stats, sync
├── templates/
│   └── index.html         # Single-page app shell
├── static/
│   ├── css/style.css      # All styles, CSS variables, animations
│   ├── js/app.js          # Client logic, rendering, interactions
│   └── favicon.svg        # Green checkmark favicon
├── data/                  # CSV question data + JSON topic configs
├── requirements.txt
└── README.md
```

## Screenshots

### Dashboard
Donut chart with difficulty breakdown, rank progression with XP bar, streak stats, and a full-year heatmap with scroll-to-change-year.

### Subject View
Collapsible topic folders with smooth expand/collapse animations, difficulty badges, status indicators, drag reorder, and inline notes/code viewer.

### Add Question Modal
Custom date picker, styled status dropdown, difficulty segmented control, code editor, and reference material links.
