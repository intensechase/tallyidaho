-- Add SOP-extracted fields to bills table
alter table bills add column if not exists rs_number text;       -- e.g. "RS 22456"
alter table bills add column if not exists fiscal_note text;     -- fiscal note body text
alter table bills add column if not exists sop_revised_at text;  -- e.g. "03/03/2026, 1:30 PM"

-- Index rs_number for agenda RS→bill linking
create index if not exists idx_bills_rs_number on bills(rs_number);
