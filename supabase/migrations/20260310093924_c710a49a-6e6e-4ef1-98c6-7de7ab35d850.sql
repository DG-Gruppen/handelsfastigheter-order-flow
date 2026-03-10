
-- Delete the OAuth-created duplicate profile first
DELETE FROM public.profiles WHERE id = '0ec68ecd-18a1-4719-be36-3bab234dcf36';

-- Now update the seed profile to use the OAuth user_id
UPDATE public.profiles
SET user_id = '2e88b0dc-4682-4147-85d6-7f82113ec269',
    full_name = 'Christel Johansson Korsner',
    updated_at = now()
WHERE id = 'c32ae9d4-87c8-4cd8-9099-3bcc1560c4cf';

-- Move any roles/orders from old seed user_id to real OAuth user_id
UPDATE public.user_roles SET user_id = '2e88b0dc-4682-4147-85d6-7f82113ec269' WHERE user_id = 'd39ceb6b-4e57-4de1-8994-8e004b88800a';
UPDATE public.orders SET requester_id = '2e88b0dc-4682-4147-85d6-7f82113ec269' WHERE requester_id = 'd39ceb6b-4e57-4de1-8994-8e004b88800a';
UPDATE public.orders SET approver_id = '2e88b0dc-4682-4147-85d6-7f82113ec269' WHERE approver_id = 'd39ceb6b-4e57-4de1-8994-8e004b88800a';
