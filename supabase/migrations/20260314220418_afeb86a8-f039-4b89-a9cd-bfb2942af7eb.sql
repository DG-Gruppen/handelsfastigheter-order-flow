
-- 1. Fix function search paths for functions missing it
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pgmq.send(queue_name, payload); $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pgmq.delete(queue_name, message_id); $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$$;

-- 2. Fix order_type_departments: change policies from public to authenticated
DROP POLICY IF EXISTS "Admins can manage order_type_departments" ON public.order_type_departments;
CREATE POLICY "Admins can manage order_type_departments"
ON public.order_type_departments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view order_type_departments" ON public.order_type_departments;
CREATE POLICY "Authenticated users can view order_type_departments"
ON public.order_type_departments
FOR SELECT
TO authenticated
USING (true);

-- 3. Fix category_departments: change policies from public to authenticated
DROP POLICY IF EXISTS "Admins can manage category_departments" ON public.category_departments;
CREATE POLICY "Admins can manage category_departments"
ON public.category_departments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view category_departments" ON public.category_departments;
CREATE POLICY "Authenticated users can view category_departments"
ON public.category_departments
FOR SELECT
TO authenticated
USING (true);

-- 4. Fix it_faq: restrict SELECT to active only for non-admins
DROP POLICY IF EXISTS "Authenticated users can view active FAQ" ON public.it_faq;
CREATE POLICY "Authenticated users can view active FAQ"
ON public.it_faq
FOR SELECT
TO authenticated
USING (is_active = true);

-- 5. Fix user_roles: remove overly broad policy, keep own-roles + admin access
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
