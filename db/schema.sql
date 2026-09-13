-- D1 (SQLite) translation of the Supabase Postgres schema.
-- Nothing here runs until the owner signs it off.
--
-- Type mapping, once:
--   uuid          -> text          ids stay the same strings; generated in app
--                                  code with crypto.randomUUID(), not by the db
--   date          -> text          'YYYY-MM-DD'; app/utils/trips.ts already
--                                  works in this domain, so it is untouched
--   timestamptz   -> text          ISO 8601, always UTC, always Z
--   numeric(2,1)  -> real          the CHECK still enforces range and half-step
--   double prec.  -> real
--
-- RLS has no equivalent in SQLite. Every policy that used to live here now
-- lives in server/api routes. That is the migration's real cost.

PRAGMA foreign_keys = ON;

create table photos (
  id            text primary key,
  storage_path  text not null unique,
  uploaded_by   text,
  caption       text,
  trip_id       text references trips(id) on delete set null,
  created_at    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table trips (
  id              text primary key,
  slug            text not null unique,
  title           text not null,
  start_date      text not null,
  end_date        text not null,
  start_place     text,
  end_place       text,
  start_lat       real,
  start_lon       real,
  end_lat         real,
  end_lon         real,
  notes           text,
  badge_photo_id  text references photos(id) on delete set null,
  created_by      text,
  created_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (end_date >= start_date)
);

create table campsites (
  id          text not null primary key,
  trip_id     text not null references trips(id) on delete cascade,
  name        text not null,
  camped_on   text not null,
  notes       text,
  lat         real,
  lon         real,
  bankage     real check (bankage    in (0, 0.5, 1, 1.5, 2)),
  campspots   real check (campspots  in (0, 0.5, 1, 1.5, 2)),
  firewood    real check (firewood   in (0, 0.5, 1, 1.5, 2)),
  shelter     real check (shelter    in (0, 0.5, 1, 1.5, 2)),
  aesthetics  real check (aesthetics in (0, 0.5, 1, 1.5, 2)),
  score       real generated always as
                (bankage + campspots + firewood + shelter + aesthetics) stored,
  created_by  text,
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index campsites_trip_id_idx on campsites(trip_id);
create index photos_trip_id_idx    on photos(trip_id);
