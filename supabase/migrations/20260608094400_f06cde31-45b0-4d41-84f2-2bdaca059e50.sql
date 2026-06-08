insert into modules (id, name, slug, route, icon, description, sort_order, is_active)
values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Supermålet',
  'supermalet',
  '/supermalet',
  'plane',
  'Anmälan till Supermålet-resan',
  20,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  route = excluded.route,
  icon = excluded.icon,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into module_role_access (module_id, role, has_access)
values 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'employee', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'manager', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'staff', true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'it', true)
on conflict (module_id, role) do update set has_access = excluded.has_access;
