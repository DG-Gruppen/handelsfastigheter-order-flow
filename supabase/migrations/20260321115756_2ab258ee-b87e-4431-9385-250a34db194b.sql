
-- RISK-1/RISK-10: Enforce valid order status transitions and rejection_reason
-- Valid transitions: pending→approved, pending→rejected, approved→delivered
-- rejection_reason must NOT be null when status = 'rejected'
-- Only admin/IT can mark as delivered

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only validate when status is changing
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate allowed transitions
  IF NOT (
    (OLD.status = 'pending' AND NEW.status = 'approved') OR
    (OLD.status = 'pending' AND NEW.status = 'rejected') OR
    (OLD.status = 'approved' AND NEW.status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  -- Rejection requires a reason
  IF NEW.status = 'rejected' AND (NEW.rejection_reason IS NULL OR TRIM(NEW.rejection_reason) = '') THEN
    RAISE EXCEPTION 'rejection_reason is required when rejecting an order';
  END IF;

  -- Only admin or IT can mark as delivered
  IF NEW.status = 'delivered' THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'it')
    ) THEN
      RAISE EXCEPTION 'Only admin or IT can mark orders as delivered';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();
