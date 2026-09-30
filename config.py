SYNC_INTERVAL_HOURS = 6

PORT = 6969

RANKS = [
    (0, 'Starter', '#636366'),
    (100, 'Explorer', '#30d158'),
    (300, 'Builder', '#64d2ff'),
    (600, 'Solver', '#5e5ce6'),
    (1000, 'Warrior', '#bf5af2'),
    (2000, 'Expert', '#ff9f0a'),
    (3500, 'Master', '#ff453a'),
    (5000, 'Legend', '#ffd60a'),
]

DIFFICULTIES = [
    ('easy',       'Easy',       10,  '#30d158', 'rgba(48,209,88,0.12)'),
    ('medium',     'Medium',     25,  '#ff9f0a', 'rgba(255,159,10,0.12)'),
    ('hard',       'Hard',       50,  '#ff453a', 'rgba(255,69,58,0.12)'),
    ('gaand_faad', 'Gaand Faad', 100, '#bf5af2', 'rgba(191,90,242,0.12)'),
]

XP_MAP = {d[0]: d[2] for d in DIFFICULTIES}
