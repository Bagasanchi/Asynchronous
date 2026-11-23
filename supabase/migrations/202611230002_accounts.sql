set local search_path to asynchronous;
create table accounts (id text primary key, username text not null unique, salt text not null, verifier text not null);
create table account_sessions (digest text primary key, account text not null references accounts(id), expires bigint not null);
create index account_sessions_expiry on account_sessions(expires);
create table login_limits (bucket text primary key, attempts integer not null, expires bigint not null);
grant select, insert on accounts to asynchronous_game;
grant select, insert, delete on account_sessions to asynchronous_game;
grant select, insert, update, delete on login_limits to asynchronous_game;
