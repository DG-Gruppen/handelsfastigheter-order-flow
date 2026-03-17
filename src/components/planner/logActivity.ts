import { supabase } from "@/integrations/supabase/client";

interface LogParams {
  boardId: string;
  userId: string;
  action: "created" | "updated" | "deleted" | "moved";
  entityType: "card" | "column";
  entityName?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logPlannerActivity({ boardId, userId, action, entityType, entityName, metadata }: LogParams) {
  await supabase.from("planner_activity_log").insert({
    board_id: boardId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_name: entityName ?? null,
    metadata: metadata ?? {},
  });
}
