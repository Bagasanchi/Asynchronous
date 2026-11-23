-- Initial migration for async-card-game
-- Created: 2024-01-01

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    elo INTEGER DEFAULT 1000 NOT NULL,
    games_played INTEGER DEFAULT 0 NOT NULL,
    games_won INTEGER DEFAULT 0 NOT NULL,
    current_streak INTEGER DEFAULT 0 NOT NULL,
    max_streak INTEGER DEFAULT 0 NOT NULL,
    total_play_time INTEGER DEFAULT 0 NOT NULL,
    preferences TEXT DEFAULT '{}' NOT NULL,
    statistics TEXT DEFAULT '{}' NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    last_login_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_elo_idx ON users(elo);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    game_type TEXT NOT NULL,
    status TEXT NOT NULL,
    current_player_index INTEGER DEFAULT 0 NOT NULL,
    turn_number INTEGER DEFAULT 0 NOT NULL,
    turn_phase TEXT NOT NULL,
    turn_start_time INTEGER NOT NULL,
    turn_time_limit INTEGER NOT NULL,
    max_players INTEGER NOT NULL,
    seed TEXT NOT NULL,
    rng_state TEXT NOT NULL,
    enemies_defeated INTEGER DEFAULT 0 NOT NULL,
    floor INTEGER DEFAULT 0 NOT NULL,
    act INTEGER DEFAULT 0 NOT NULL,
    ascension_level INTEGER DEFAULT 0 NOT NULL,
    modifiers TEXT DEFAULT '[]' NOT NULL,
    log TEXT DEFAULT '[]' NOT NULL,
    winner_id TEXT REFERENCES users(id),
    end_reason TEXT,
    metadata TEXT DEFAULT '{}' NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS games_status_idx ON games(status);
CREATE INDEX IF NOT EXISTS games_game_type_idx ON games(game_type);
CREATE INDEX IF NOT EXISTS games_created_at_idx ON games(created_at);
CREATE INDEX IF NOT EXISTS games_winner_id_idx ON games(winner_id);

-- Game players table
CREATE TABLE IF NOT EXISTS game_players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_index INTEGER NOT NULL,
    status TEXT NOT NULL,
    health INTEGER NOT NULL,
    max_health INTEGER NOT NULL,
    block INTEGER DEFAULT 0 NOT NULL,
    energy INTEGER NOT NULL,
    max_energy INTEGER NOT NULL,
    gold INTEGER DEFAULT 0 NOT NULL,
    deck TEXT DEFAULT '[]' NOT NULL,
    hand TEXT DEFAULT '[]' NOT NULL,
    discard_pile TEXT DEFAULT '[]' NOT NULL,
    exhaust_pile TEXT DEFAULT '[]' NOT NULL,
    relics TEXT DEFAULT '[]' NOT NULL,
    potions TEXT DEFAULT '[]' NOT NULL,
    buffs TEXT DEFAULT '[]' NOT NULL,
    turn_number INTEGER DEFAULT 0 NOT NULL,
    total_damage_dealt INTEGER DEFAULT 0 NOT NULL,
    total_damage_taken INTEGER DEFAULT 0 NOT NULL,
    total_block_gained INTEGER DEFAULT 0 NOT NULL,
    total_cards_played INTEGER DEFAULT 0 NOT NULL,
    total_gold_gained INTEGER DEFAULT 0 NOT NULL,
    connected INTEGER DEFAULT 1 NOT NULL,
    last_action_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS game_players_game_id_idx ON game_players(game_id);
CREATE INDEX IF NOT EXISTS game_players_user_id_idx ON game_players(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS game_players_game_user_idx ON game_players(game_id, user_id);

-- Current enemies table
CREATE TABLE IF NOT EXISTS current_enemies (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    enemy_id TEXT NOT NULL,
    current_hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    block INTEGER DEFAULT 0 NOT NULL,
    buffs TEXT DEFAULT '[]' NOT NULL,
    intent TEXT NOT NULL,
    intent_index INTEGER DEFAULT 0 NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Matchmaking queues table
CREATE TABLE IF NOT EXISTS matchmaking_queues (
    id TEXT PRIMARY KEY,
    game_type TEXT NOT NULL,
    status TEXT NOT NULL,
    players TEXT DEFAULT '[]' NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    matched_at INTEGER,
    game_id TEXT REFERENCES games(id)
);

CREATE INDEX IF NOT EXISTS matchmaking_queues_status_idx ON matchmaking_queues(status);
CREATE INDEX IF NOT EXISTS matchmaking_queues_game_type_idx ON matchmaking_queues(game_type);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    read INTEGER DEFAULT 0 NOT NULL,
    action_url TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);

-- Clubs table
CREATE TABLE IF NOT EXISTS clubs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    owner_id TEXT NOT NULL REFERENCES users(id),
    settings TEXT DEFAULT '{}' NOT NULL,
    statistics TEXT DEFAULT '{}' NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS clubs_name_idx ON clubs(name);
CREATE INDEX IF NOT EXISTS clubs_owner_id_idx ON clubs(owner_id);

-- Club members table
CREATE TABLE IF NOT EXISTS club_members (
    id TEXT PRIMARY KEY,
    club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    joined_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    games_played INTEGER DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS club_members_club_id_idx ON club_members(club_id);
CREATE INDEX IF NOT EXISTS club_members_user_id_idx ON club_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS club_members_club_user_idx ON club_members(club_id, user_id);

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    game_type TEXT NOT NULL,
    status TEXT NOT NULL,
    format TEXT NOT NULL,
    schedule TEXT NOT NULL,
    prizes TEXT DEFAULT '[]' NOT NULL,
    settings TEXT DEFAULT '{}' NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS tournaments_status_idx ON tournaments(status);
CREATE INDEX IF NOT EXISTS tournaments_game_type_idx ON tournaments(game_type);

-- Tournament participants table
CREATE TABLE IF NOT EXISTS tournament_participants (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seed INTEGER DEFAULT 0 NOT NULL,
    status TEXT NOT NULL,
    current_round INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS tournament_participants_tournament_id_idx ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS tournament_participants_user_id_idx ON tournament_participants(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_participants_tournament_user_idx ON tournament_participants(tournament_id, user_id);

-- Tournament brackets table
CREATE TABLE IF NOT EXISTS tournament_brackets (
    id TEXT PRIMARY KEY,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    matches TEXT DEFAULT '[]' NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS tournament_brackets_tournament_id_idx ON tournament_brackets(tournament_id);

-- Daily runs table
CREATE TABLE IF NOT EXISTS daily_runs (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    game_type TEXT NOT NULL,
    seed TEXT NOT NULL,
    modifiers TEXT DEFAULT '[]' NOT NULL,
    leaderboard TEXT DEFAULT '[]' NOT NULL,
    total_participants INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_runs_date_idx ON daily_runs(date);
CREATE INDEX IF NOT EXISTS daily_runs_game_type_idx ON daily_runs(game_type);

-- Leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
    id TEXT PRIMARY KEY,
    game_type TEXT NOT NULL,
    period TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    entries TEXT DEFAULT '[]' NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS leaderboards_game_type_period_idx ON leaderboards(game_type, period, period_start);

-- Replays table
CREATE TABLE IF NOT EXISTS replays (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    players TEXT NOT NULL,
    actions TEXT NOT NULL,
    seed TEXT NOT NULL,
    winner_id TEXT NOT NULL REFERENCES users(id),
    duration INTEGER NOT NULL,
    turn_count INTEGER NOT NULL,
    version TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS replays_game_type_idx ON replays(game_type);
CREATE INDEX IF NOT EXISTS replays_winner_id_idx ON replays(winner_id);
CREATE INDEX IF NOT EXISTS replays_created_at_idx ON replays(created_at);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    game_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    rarity TEXT NOT NULL,
    criteria TEXT NOT NULL,
    reward TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS achievements_game_type_idx ON achievements(game_type);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    progress REAL DEFAULT 0 NOT NULL,
    completed INTEGER DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS user_achievements_user_id_idx ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS user_achievements_achievement_id_idx ON user_achievements(achievement_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_user_achievement_idx ON user_achievements(user_id, achievement_id);

-- Friends table
CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS friends_user_id_idx ON friends(user_id);
CREATE INDEX IF NOT EXISTS friends_friend_id_idx ON friends(friend_id);
CREATE UNIQUE INDEX IF NOT EXISTS friends_user_friend_idx ON friends(user_id, friend_id);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_messages_game_id_idx ON chat_messages(game_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);