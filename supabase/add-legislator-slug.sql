-- ==========================================
-- Add slug column to legislators
-- Run in Supabase SQL editor BEFORE deploying the matching code changes
-- ==========================================

-- 1. Add the column
alter table legislators add column if not exists slug text;

-- 2. Backfill — mirrors the TypeScript legislatorSlug() function in lib/slugify.ts:
--    name.toLowerCase()
--      .replace(/\./g, '')             remove dots (middle initials like "D.")
--      .replace(/[^a-z0-9\s-]/g, '')  remove remaining special chars
--      .trim()
--      .replace(/\s+/g, '-')           collapse spaces to hyphens
update legislators
set slug = regexp_replace(
  trim(
    regexp_replace(
      regexp_replace(lower(name), '\.', '', 'g'),
      '[^a-z0-9 \-]', '', 'g'
    )
  ),
  '\s+', '-', 'g'
)
where slug is null;

-- 3. Unique index — one slug per legislator, fast O(1) lookup by slug
create unique index if not exists idx_legislators_slug on legislators(slug);
