
-- Fix Nyheter: remove empty duplicate (slug: nyheter), rename the one with data (news -> nyheter)
DELETE FROM modules WHERE id = '49779519-8496-463b-8a96-702494b19583';
UPDATE modules SET slug = 'nyheter' WHERE id = '4a45a5c7-2d19-4e50-ae92-24d19d6068db';

-- Fix Kulturen: remove empty duplicate (slug: kulturen), rename the one with data (culture -> kulturen)
DELETE FROM modules WHERE id = 'f333128c-fdc8-456a-bbf9-91e13741f4bf';
UPDATE modules SET slug = 'kulturen' WHERE id = '2fa29acd-1642-4e57-9d37-4a666efbdd63';
