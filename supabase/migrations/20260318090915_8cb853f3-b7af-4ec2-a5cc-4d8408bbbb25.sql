
-- Remove the empty duplicate module (slug: kunskapsbanken)
DELETE FROM modules WHERE id = '1cf0e0e9-9e3c-468f-aa74-62d88859c42f';

-- Update the remaining module's slug from 'knowledge' to 'kunskapsbanken' so RLS policies match
UPDATE modules SET slug = 'kunskapsbanken' WHERE id = '573296a6-6cca-4f0b-9f88-2635e30dcaa8';

-- Drop and recreate RLS policies that reference 'kunskapsbanken' slug (they already use that slug, so they'll work now)
-- No RLS changes needed since the slug is now 'kunskapsbanken' on the correct module
