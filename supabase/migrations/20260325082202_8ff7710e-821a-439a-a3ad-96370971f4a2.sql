CREATE POLICY "Admin and IT can view email log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'it'::app_role)
);