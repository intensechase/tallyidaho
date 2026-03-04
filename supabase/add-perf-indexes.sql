-- ==========================================
-- PERFORMANCE INDEXES — run once in Supabase SQL editor
-- Addresses gaps identified in scalability audit (Mar 2026)
-- ==========================================

-- roll_calls: session_id used in legislator profile + district queries (batch 1 fix)
create index if not exists idx_roll_calls_session_id on roll_calls(session_id);

-- roll_calls: chamber filter pushed from JS → SQL (batch 1 fix)
create index if not exists idx_roll_calls_chamber on roll_calls(chamber);

-- Composite covers the legislator profile roll_calls lookup: session + chamber + date
create index if not exists idx_roll_calls_session_chamber_date
  on roll_calls(session_id, chamber, date desc);

-- bill_sponsors: no index on legislator_id (PK is bill_id, legislator_id — unusable for this direction)
create index if not exists idx_bill_sponsors_legislator_id on bill_sponsors(legislator_id);

-- legislator_sessions: PK leads with legislator_id; session-only queries can't use it
create index if not exists idx_legislator_sessions_session_id on legislator_sessions(session_id);

-- bills: status + completed used in listing filters; last_action_date used for ordering
create index if not exists idx_bills_status on bills(status);
create index if not exists idx_bills_completed on bills(completed);
create index if not exists idx_bills_last_action_date on bills(last_action_date desc);

-- Composite covers the bills listing page primary access pattern: session + sort + filters
create index if not exists idx_bills_session_last_action
  on bills(session_id, last_action_date desc);

create index if not exists idx_bills_session_status_completed
  on bills(session_id, status, completed);

-- Full-text search on legislators.name and bills.title (replaces slow ILIKE '%q%' scans)
-- Requires pg_trgm extension — enabled by default on Supabase
create extension if not exists pg_trgm;

create index if not exists idx_legislators_name_trgm
  on legislators using gin(name gin_trgm_ops);

create index if not exists idx_bills_title_trgm
  on bills using gin(title gin_trgm_ops);
