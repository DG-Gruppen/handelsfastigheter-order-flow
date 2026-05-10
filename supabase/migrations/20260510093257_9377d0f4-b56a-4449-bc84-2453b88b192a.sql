-- Batch 5: migrate remaining has_role(..., 'admin') → is_in_admin_group(auth.uid())
-- IT role checks are intentionally preserved.

-- chat_*
ALTER POLICY "Users can leave channels" ON public.chat_channel_members
  USING (
    auth.uid() = user_id
    OR public.is_in_admin_group(auth.uid())
    OR EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = chat_channel_members.channel_id AND c.created_by = auth.uid())
  );

ALTER POLICY "Creator or admin can delete channels" ON public.chat_channels
  USING (auth.uid() = created_by OR public.is_in_admin_group(auth.uid()));

ALTER POLICY "Creator or admin can update channels" ON public.chat_channels
  USING (auth.uid() = created_by OR public.is_in_admin_group(auth.uid()));

ALTER POLICY "Users can delete own messages or admin" ON public.chat_messages
  USING (auth.uid() = user_id OR public.is_in_admin_group(auth.uid()));

-- document_files
ALTER POLICY "Users can view files in accessible folders" ON public.document_files
  USING (public.has_folder_access(auth.uid(), folder_id) OR public.is_in_admin_group(auth.uid()));

ALTER POLICY "Users with write access can delete files" ON public.document_files
  USING (public.is_in_admin_group(auth.uid()) OR public.has_folder_write_access(auth.uid(), folder_id));

ALTER POLICY "Users with write access can insert files" ON public.document_files
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_folder_write_access(auth.uid(), folder_id));

ALTER POLICY "Users with write access can update files" ON public.document_files
  USING (public.is_in_admin_group(auth.uid()) OR public.has_folder_write_access(auth.uid(), folder_id));

-- document_folders
ALTER POLICY "Users can view accessible folders" ON public.document_folders
  USING (access_roles IS NULL OR public.has_folder_access(auth.uid(), id) OR public.is_in_admin_group(auth.uid()));

ALTER POLICY "Users with write access can delete folders" ON public.document_folders
  USING (public.is_in_admin_group(auth.uid()) OR public.has_folder_write_access(auth.uid(), id));

ALTER POLICY "Users with write access can insert folders" ON public.document_folders
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR (parent_id IS NOT NULL AND public.has_folder_write_access(auth.uid(), parent_id)));

ALTER POLICY "Users with write access can update folders" ON public.document_folders
  USING (public.is_in_admin_group(auth.uid()) OR public.has_folder_write_access(auth.uid(), id));

-- email_send_log (keep IT)
ALTER POLICY "Admin and IT can view email log" ON public.email_send_log
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role));

-- group_members
ALTER POLICY "Admins can manage group members" ON public.group_members
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

-- groups
ALTER POLICY "Admins can manage groups" ON public.groups
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

-- integration_status
ALTER POLICY "Admin and IT can view integrations" ON public.integration_status
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role));

-- kpi_data
ALTER POLICY "Editors can delete kpi_data" ON public.kpi_data
  USING (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'delete'::text));

ALTER POLICY "Editors can insert kpi_data" ON public.kpi_data
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'edit'::text));

ALTER POLICY "Editors can update kpi_data" ON public.kpi_data
  USING (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'edit'::text));

ALTER POLICY "Users with view access can view kpi_data" ON public.kpi_data
  USING (
    public.is_in_admin_group(auth.uid())
    OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'view'::text)
    OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'edit'::text)
    OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'owner'::text)
  );

-- kpi_types
ALTER POLICY "Editors can manage kpi_types" ON public.kpi_types
  USING (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'edit'::text))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'edit'::text));

-- org_chart_settings
ALTER POLICY "Admins can manage org settings" ON public.org_chart_settings
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

-- page_analytics (keep IT)
ALTER POLICY "Admin and IT can view analytics" ON public.page_analytics
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role));

ALTER POLICY "Admin can delete analytics" ON public.page_analytics
  USING (public.is_in_admin_group(auth.uid()));

-- password_access_log (keep IT)
ALTER POLICY "Admins and IT can view access log" ON public.password_access_log
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role));

-- planner_*
ALTER POLICY "Module permission or admin can manage boards" ON public.planner_boards
  USING (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text));

ALTER POLICY "Uploader or editors can delete attachments" ON public.planner_card_attachments
  USING (auth.uid() = uploaded_by OR public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text));

ALTER POLICY "Users can delete own or editors delete any" ON public.planner_card_comments
  USING (auth.uid() = user_id OR public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text));

ALTER POLICY "Module permission or admin can manage cards" ON public.planner_cards
  USING (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text));

ALTER POLICY "Module permission or admin can manage columns" ON public.planner_columns
  USING (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'planner'::text, 'edit'::text));

-- profiles
ALTER POLICY "Admins can update all profiles" ON public.profiles
  USING (public.is_in_admin_group(auth.uid()));

ALTER POLICY "Managers and admins can insert profiles" ON public.profiles
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'manager'::app_role));

-- prompt_suggestions
ALTER POLICY "Author or admin can update suggestions" ON public.prompt_suggestions
  USING (
    public.is_in_admin_group(auth.uid())
    OR EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = prompt_suggestions.prompt_id AND p.author_id = auth.uid())
  );

ALTER POLICY "Suggester author or admin can view suggestions" ON public.prompt_suggestions
  USING (
    auth.uid() = suggested_by
    OR public.is_in_admin_group(auth.uid())
    OR EXISTS (SELECT 1 FROM public.prompts p WHERE p.id = prompt_suggestions.prompt_id AND p.author_id = auth.uid())
  );

-- prompts
ALTER POLICY "Author or admin can update prompts" ON public.prompts
  USING (auth.uid() = author_id OR public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'prompts'::text, 'edit'::text));

-- regions
ALTER POLICY "Admins can manage regions" ON public.regions
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

-- search_log (keep IT)
ALTER POLICY "Admin and IT can view search log" ON public.search_log
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role));

-- shared_password_groups (keep IT)
ALTER POLICY "Admins and IT can manage password groups" ON public.shared_password_groups
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role));

-- shared_passwords (keep IT)
ALTER POLICY "Editors can delete passwords" ON public.shared_passwords
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role) OR public.has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text));

ALTER POLICY "Editors can insert passwords" ON public.shared_passwords
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role) OR public.has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text));

ALTER POLICY "Editors can update passwords" ON public.shared_passwords
  USING (public.is_in_admin_group(auth.uid()) OR public.has_role(auth.uid(), 'it'::app_role) OR public.has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text));

ALTER POLICY "Users with module access can view all passwords" ON public.shared_passwords
  USING (
    public.is_in_admin_group(auth.uid())
    OR public.has_role(auth.uid(), 'it'::app_role)
    OR public.has_module_slug_permission(auth.uid(), 'losenord'::text, 'view'::text)
    OR public.has_module_slug_permission(auth.uid(), 'losenord'::text, 'edit'::text)
    OR public.has_shared_password_access(auth.uid(), id)
  );

-- systems
ALTER POLICY "Admins can manage systems" ON public.systems
  USING (public.is_in_admin_group(auth.uid()))
  WITH CHECK (public.is_in_admin_group(auth.uid()));

-- tools
ALTER POLICY "Editors can manage tools" ON public.tools
  USING (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'tools'::text, 'edit'::text))
  WITH CHECK (public.is_in_admin_group(auth.uid()) OR public.has_module_slug_permission(auth.uid(), 'tools'::text, 'edit'::text));

-- user_roles
ALTER POLICY "Admins can manage roles" ON public.user_roles
  USING (public.is_in_admin_group(auth.uid()));

ALTER POLICY "Admins can view all roles" ON public.user_roles
  USING (public.is_in_admin_group(auth.uid()));

-- workwear_orders
ALTER POLICY "Admins can update workwear orders" ON public.workwear_orders
  USING (public.is_in_admin_group(auth.uid()));

ALTER POLICY "Admins can view all workwear orders" ON public.workwear_orders
  USING (public.is_in_admin_group(auth.uid()));

-- validate_order_status_transition: admin OR IT may set delivered
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'pending' AND NEW.status = 'approved') OR
    (OLD.status = 'pending' AND NEW.status = 'rejected') OR
    (OLD.status = 'approved' AND NEW.status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'rejected' AND (NEW.rejection_reason IS NULL OR TRIM(NEW.rejection_reason) = '') THEN
    RAISE EXCEPTION 'rejection_reason is required when rejecting an order';
  END IF;

  IF NEW.status = 'delivered' THEN
    IF NOT (
      public.is_in_admin_group(auth.uid()) OR
      public.has_role(auth.uid(), 'it')
    ) THEN
      RAISE EXCEPTION 'Only admin or IT can mark orders as delivered';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
