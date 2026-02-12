-- Таблица уровней
CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    date_joined DATETIME DEFAULT CURRENT_TIMESTAMP,
    streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    progress TEXT,
    reason_to_learn TEXT,
    wants_to_improve TEXT, -- Хранить как JSON-строку
    topics TEXT,           -- Хранить как JSON-строку
    last_request_date DATETIME DEFAULT CURRENT_DATE,
    requests_today_podcast INTEGER DEFAULT 0,
    requests_today INTEGER DEFAULT 0,
    level_id INTEGER,
    subscription_tier TEXT,
    subscription_until DATETIME,
    last_notification_sent DATETIME,
    lexi_style TEXT DEFAULT 'futurist',
    FOREIGN KEY (level_id) REFERENCES levels(id)
);

-- Таблица сообщений
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    chat_id INTEGER NOT NULL,
    message_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

-- Индекс для быстрого поиска по telegram_id (уже создан через PRIMARY KEY)
-- Индекс для быстрого поиска по user_id в таблице messages
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Индекс для быстрого поиска по chat_id в таблице messages
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);