
ALTER TABLE public.orders
  ADD COLUMN recipient_type text DEFAULT 'existing' CHECK (recipient_type IN ('new', 'existing')),
  ADD COLUMN recipient_name text DEFAULT '',
  ADD COLUMN recipient_start_date date,
  ADD COLUMN recipient_department text DEFAULT '',
  ADD COLUMN order_reason text DEFAULT 'new_employee' CHECK (order_reason IN ('new_employee', 'broken_equipment', 'end_of_employment'));
