create table if not exists properties (
  id text primary key,
  source_index integer not null,
  name text not null,
  area_id integer not null,
  area_name text not null,
  area_slug text not null,
  lat double precision not null,
  lng double precision not null,
  kind text not null,
  type text not null,
  tenure text not null,
  rooms integer,
  price text not null,
  price_value integer,
  price_per_room integer,
  source text not null,
  location text not null,
  url text not null,
  status text not null,
  note text,
  last_seen date not null,
  fit_score integer not null,
  confidence integer not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_area_id_idx on properties(area_id);
create index if not exists properties_status_idx on properties(status);
create index if not exists properties_fit_score_idx on properties(fit_score desc);
create index if not exists properties_price_value_idx on properties(price_value);
create index if not exists properties_url_idx on properties(url);

create table if not exists property_snapshots (
  id bigserial primary key,
  property_id text not null references properties(id) on delete cascade,
  observed_at timestamptz not null default now(),
  price text not null,
  price_value integer,
  status text not null,
  source text not null,
  url text not null,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists property_snapshots_property_id_idx on property_snapshots(property_id);
create index if not exists property_snapshots_observed_at_idx on property_snapshots(observed_at desc);

create table if not exists refresh_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'queued',
  source text,
  provider text,
  queries_run integer not null default 0,
  properties_seen integer,
  candidates_found integer not null default 0,
  candidates_new integer not null default 0,
  properties_imported integer not null default 0,
  message text
);

create table if not exists discovery_candidates (
  id text primary key,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  provider text not null,
  query text not null,
  name text not null,
  area_id integer not null,
  area_name text not null,
  area_slug text not null,
  lat double precision not null,
  lng double precision not null,
  kind text not null,
  type text not null,
  tenure text not null,
  rooms integer,
  price text not null,
  price_value integer,
  price_per_room integer,
  source text not null,
  location text not null,
  url text not null,
  status text not null,
  note text,
  fit_score integer not null,
  confidence integer not null,
  review_status text not null default 'new',
  promoted_property_id text,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists discovery_candidates_last_seen_idx on discovery_candidates(last_seen_at desc);
create index if not exists discovery_candidates_review_status_idx on discovery_candidates(review_status);
create index if not exists discovery_candidates_url_idx on discovery_candidates(url);
