

## Fix Region Filter in Workwear Admin Panel

### Problem
The workwear admin panel's "Region" filter and KPI card are incorrectly using `profiles.department` instead of the actual `regions` table (`profiles.region_id` → `regions.name`). This means the filter shows department names, not real regions (Norr, Söder, Mitt/Bromma).

### Changes

**File: `src/components/workwear/WorkwearAdminPanel.tsx`**

1. **Fetch region data**: Add `region_id` to the profiles query and fetch the `regions` table. Use the existing `useRegions` hook or a parallel query.

2. **Update ProfileRow interface**: Add `region_id: string | null` to `ProfileRow`.

3. **Build region lookup**: Create a `regionMap` (id → name) from the regions data, and derive region name per profile.

4. **Replace department filter with real regions**: Change the `filterDept` dropdown to show the three actual regions (Norr, Söder, Mitt/Bromma) from the `regions` table instead of unique department strings.

5. **Update filter logic**: In `filteredOrders`, match `profileMap.get(o.user_id)?.region_id` against the selected region instead of comparing department strings.

6. **Fix KPI card "Regioner"**: Count unique `region_id` values (not departments) from filtered orders.

7. **Update "Per region" tab (`deptStats`)**: Group by region name instead of department. Update column headers accordingly.

8. **Update pick list region column**: Show region name instead of department in the plocklista rows.

### No database changes needed
The `regions` table and `profiles.region_id` already exist from the previous migration.

