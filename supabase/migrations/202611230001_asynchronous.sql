create schema asynchronous;
revoke all on schema asynchronous from public, anon, authenticated;
create role asynchronous_game login;
grant usage on schema asynchronous to asynchronous_game;
create table asynchronous.matches (
 id uuid primary key, host text not null, guest text, mode text not null check(mode in ('duo','solo')),
 status text not null check(status in ('waiting','active','victory','defeat')),
 seat smallint not null default 0 check(seat in (0,1)), revision integer not null default 0,
 state text not null, updated bigint not null, request uuid not null, unique(host,request));
create index matches_host on asynchronous.matches(host,updated desc);
create index matches_guest on asynchronous.matches(guest,updated desc);
create index matches_updated on asynchronous.matches(updated);
create table asynchronous.devices (owner text primary key, subscription text not null);
create table asynchronous.reminders (match uuid primary key references asynchronous.matches(id),owner text not null references asynchronous.devices(owner) on delete cascade, revision integer not null, due bigint not null, attempts integer not null default 0);
grant select, insert, update on asynchronous.matches to asynchronous_game;
grant select, insert, update, delete on asynchronous.devices, asynchronous.reminders to asynchronous_game;
