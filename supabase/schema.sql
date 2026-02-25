-- ==========================================
-- TALLY IDAHO — DATABASE SCHEMA
-- ==========================================
-- Run this in the Supabase SQL editor
-- Covers Phase 1 & 2 (public data only)
-- Social features deferred to future phase
-- ==========================================


-- ==================
-- SESSIONS
-- ==================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  legiscan_session_id integer unique not null,
  year_start integer not null,
  year_end integer not null,
  name text not null,           -- e.g. '2026 Regular Session'
  session_tag text not null,    -- e.g. 'Regular Session', '1st Special Session'
  is_special boolean default false,
  is_current boolean default false,
  sine_die boolean default false, -- true = session has ended
  dataset_hash text,            -- used to avoid redundant LegiScan dataset downloads
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ==================
-- LEGISLATORS
-- ==================

create table legislators (
  id uuid primary key default gen_random_uuid(),
  legiscan_people_id integer unique not null,
  name text not null,
  first_name text,
  last_name text,
  nickname text,
  party text,                   -- 'R', 'D', 'I', 'L', etc.
  role text,                    -- 'Rep' or 'Sen'
  chamber text,                 -- 'house' or 'senate'
  district text,                -- e.g. 'HD-020A', 'SD-006'
  district_number integer,      -- numeric part of district e.g. 20
  district_seat text,           -- 'A', 'B', or null (senate)
  -- Contact
  email text,
  capitol_phone text,
  capitol_address text,
  website_url text,
  -- Social media
  twitter_handle text,
  facebook_url text,
  instagram_url text,
  -- Photo (stored in Supabase Storage, pulled from Idaho Legislature site)
  photo_url text,
  -- External IDs
  ballotpedia_url text,
  votesmart_id integer,
  -- Term info
  is_current boolean default true,  -- active in current session
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast district lookups (core feature)
create index idx_legislators_district_number on legislators(district_number);
create index idx_legislators_chamber on legislators(chamber);
create index idx_legislators_party on legislators(party);


-- ==================
-- BILLS
-- ==================

create table bills (
  id uuid primary key default gen_random_uuid(),
  legiscan_bill_id integer unique not null,
  session_id uuid references sessions(id) on delete cascade,
  bill_number text not null,    -- e.g. 'H0234', 'S1001'
  bill_type text,               -- 'B' (bill), 'R' (resolution), etc.
  chamber text,                 -- 'house' or 'senate' (originating chamber)
  -- Titles & Summaries
  title text not null,                  -- official legislative title (from LegiScan)
  description text,                     -- LegiScan description field
  plain_summary text,                   -- Statement of Purpose from Idaho Legislature site
  plain_summary_source text default 'idaho_legislature', -- where summary came from
  -- Status
  status text,                          -- current status code
  status_date date,
  last_action text,
  last_action_date date,
  completed boolean default false,      -- bill has reached final status
  -- Links
  legiscan_url text,
  state_url text,                       -- link to legislature.idaho.gov bill page
  -- Topics (from LegiScan subjects)
  subjects text[],                      -- e.g. ['CRIMES AND PUNISHMENT', 'EDUCATION']
  -- Controversy flags
  is_controversial boolean default false,
  controversy_reason text check (controversy_reason in ('close_vote', 'party_line', 'both')),
  -- Change detection
  change_hash text,                     -- from LegiScan, detect when bill data changes
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_bills_session_id on bills(session_id);
create index idx_bills_is_controversial on bills(is_controversial);
create index idx_bills_status_date on bills(status_date desc);
create index idx_bills_subjects on bills using gin(subjects);


-- ==================
-- BILL SPONSORS
-- ==================

create table bill_sponsors (
  bill_id uuid references bills(id) on delete cascade,
  legislator_id uuid references legislators(id) on delete cascade,
  sponsor_order integer,        -- 1 = primary sponsor
  sponsor_type text,            -- 'primary', 'cosponsor'
  committee_sponsor boolean default false,
  primary key (bill_id, legislator_id)
);


-- ==================
-- ROLL CALLS (votes on bills)
-- ==================

create table roll_calls (
  id uuid primary key default gen_random_uuid(),
  legiscan_roll_call_id integer unique not null,
  bill_id uuid references bills(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  date date,
  description text,
  chamber text,                 -- 'house' or 'senate'
  -- Vote counts
  yea_count integer default 0,
  nay_count integer default 0,
  absent_count integer default 0,
  nv_count integer default 0,  -- not voting
  total_count integer default 0,
  passed boolean,
  -- Controversy calculations
  vote_margin numeric(5,2),     -- abs(yea - nay) / total * 100 (as percentage)
  is_party_line boolean default false,  -- 90%+ of each party voted same way
  created_at timestamptz default now()
);

create index idx_roll_calls_bill_id on roll_calls(bill_id);
create index idx_roll_calls_date on roll_calls(date desc);
create index idx_roll_calls_is_party_line on roll_calls(is_party_line);


-- ==================
-- LEGISLATOR VOTES (individual vote records)
-- ==================

create table legislator_votes (
  roll_call_id uuid references roll_calls(id) on delete cascade,
  legislator_id uuid references legislators(id) on delete cascade,
  vote text check (vote in ('yea', 'nay', 'absent', 'not_voting')),
  primary key (roll_call_id, legislator_id)
);

create index idx_legislator_votes_legislator_id on legislator_votes(legislator_id);


-- ==================
-- LEGISLATOR SESSIONS (track which sessions a legislator served in)
-- ==================

create table legislator_sessions (
  legislator_id uuid references legislators(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  district text,                -- district they represented that session (may change)
  party text,                   -- party that session
  role text,                    -- 'Rep' or 'Sen'
  primary key (legislator_id, session_id)
);


-- ==================
-- VIEWS
-- ==================

-- Roll call summary with controversy info (useful for bill detail pages)
create view roll_call_summary as
select
  rc.id,
  rc.bill_id,
  rc.date,
  rc.chamber,
  rc.description,
  rc.yea_count,
  rc.nay_count,
  rc.absent_count,
  rc.nv_count,
  rc.total_count,
  rc.passed,
  rc.vote_margin,
  rc.is_party_line,
  b.bill_number,
  b.title,
  b.is_controversial
from roll_calls rc
join bills b on rc.bill_id = b.id;

-- Legislator vote history (for profile pages)
create view legislator_vote_history as
select
  lv.legislator_id,
  lv.vote,
  rc.id as roll_call_id,
  rc.date,
  rc.chamber,
  rc.passed,
  rc.vote_margin,
  rc.is_party_line,
  b.id as bill_id,
  b.bill_number,
  b.title,
  b.plain_summary,
  b.is_controversial,
  b.subjects,
  s.name as session_name,
  s.year_start
from legislator_votes lv
join roll_calls rc on lv.roll_call_id = rc.id
join bills b on rc.bill_id = b.id
join sessions s on b.session_id = s.id;
