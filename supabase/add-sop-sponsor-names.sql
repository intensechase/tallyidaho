-- Add raw SOP sponsor names to bills table
-- Used as fallback when SOP-extracted names can't be matched to a legislator
alter table bills add column if not exists sop_sponsor_names text[];
