-- LIFELINE Supabase schema (prototype).
-- Run once in the Supabase SQL editor for a dev project.
-- Local tests never require a live project (see tests/cloud/).
--
-- RLS GUIDANCE (prototype, NOT production): the mobile/web client uses
-- ONLY the anon key, so tables need permissive prototype policies, e.g.
--   create policy "prototype open insert" on incidents for anon
--     with check (true);
--   create policy "prototype open read" on incidents for anon
--     using (true);
-- Repeat per table. Production requires authenticated roles + least
-- privilege. Never use the service-role key in client code.

create table if not exists devices (
  device_id text primary key,
  public_key text,
  last_seen timestamptz not null default now(),
  status text not null default 'ACTIVE'
);

create table if not exists incidents (
  sos_id text primary key,
  origin_device_id text not null,
  latitude double precision not null,
  longitude double precision not null,
  priority text not null,
  created_at timestamptz not null,
  status text not null default 'CREATED',
  updated_at timestamptz not null default now()
);

create table if not exists packet_hops (
  sos_id text not null references incidents (sos_id) on delete cascade,
  hop_number integer not null,
  node_id text not null,
  timestamp timestamptz not null,
  primary key (sos_id, hop_number)
);

create table if not exists acknowledgements (
  ack_id text primary key,
  sos_id text not null references incidents (sos_id) on delete cascade,
  hq_device_id text not null,
  timestamp timestamptz not null,
  status text not null default 'ACKNOWLEDGED'
);

create index if not exists packet_hops_sos_idx on packet_hops (sos_id);
create index if not exists acknowledgements_sos_idx on acknowledgements (sos_id);
create index if not exists incidents_status_idx on incidents (status);
