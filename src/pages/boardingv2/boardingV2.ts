// Delade typer, etiketter och hjälpare för on-/offboarding v2 (/boardingv2).
// v2 lever vid sidan av v1 (/boarding) tills vi slår om.

export type BoardingKind = "onboarding" | "offboarding";
export type CaseStatus = "awaiting_manager" | "awaiting_hr" | "active" | "completed" | "cancelled";
export type TaskStatus = "pending" | "done" | "not_applicable";
export type TriggerSource = "heartpace" | "manual" | "simulated";

export interface BoardingTemplate {
  id: string;
  kind: BoardingKind;
  name: string;
  description: string | null;
  is_default: boolean;
  require_hr_confirm: boolean;
}

export interface BoardingTemplateTask {
  id: string;
  template_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  category: string | null;
  condition_key: string | null;
  condition_label: string | null;
  is_system_access: boolean;
  due_offset_days: number;
  assignee_source: string;
  assignee_tool_id: string | null;
  tool: { id: string; name: string } | null;
}

export interface BoardingCase {
  id: string;
  kind: BoardingKind;
  template_id: string;
  status: CaseStatus;
  trigger_source: TriggerSource;
  profile_id: string | null;
  heartpace_employee_id: string | null;
  first_name: string;
  last_name: string;
  work_email: string | null;
  personal_email: string | null;
  title: string | null;
  department: string | null;
  location: string | null;
  cost_centre: string | null;
  employment_form: string | null;
  nearest_manager_id: string | null;
  manager_name_raw: string | null;
  start_date: string | null;
  last_day: string | null;
  exit_reason: string | null;
  exit_type: string | null;
  selected_tool_ids: string[];
  optional_keys: string[];
  manager_submitted_at: string | null;
  hr_confirmed_at: string | null;
  google_account_status: string;
  google_account_email: string | null;
  notes: string | null;
  cancel_reason: string | null;
  initiated_by: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  template: BoardingTemplate | null;
  manager: { id: string; full_name: string; email: string | null } | null;
}

export interface BoardingCaseTask {
  id: string;
  case_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  category: string | null;
  condition_key: string | null;
  assignee_profile_id: string | null;
  assignee_external_contact_id: string | null;
  assignee_email: string | null;
  assignee_label: string | null;
  deadline_date: string | null;
  status: TaskStatus;
  done_at: string | null;
  note: string | null;
  assignee: { full_name: string; email: string | null } | null;
}

export const STATUS_LABEL: Record<CaseStatus, string> = {
  awaiting_manager: "Väntar på chef",
  awaiting_hr: "Väntar på HR",
  active: "Pågår",
  completed: "Klar",
  cancelled: "Avbruten",
};

export const STATUS_CLASS: Record<CaseStatus, string> = {
  awaiting_manager: "bg-warning/20 text-warning",
  awaiting_hr: "bg-warning/20 text-warning",
  active: "bg-accent/20 text-accent",
  completed: "bg-primary/20 text-primary",
  cancelled: "bg-destructive/20 text-destructive",
};

export const TRIGGER_LABEL: Record<TriggerSource, string> = {
  heartpace: "Från Heartpace",
  manual: "Manuellt skapad",
  simulated: "Simulerad Heartpace-post",
};

export const EXIT_REASON_LABEL: Record<string, string> = {
  voluntary: "Egen uppsägning",
  employer: "Arbetsgivarens uppsägning",
  retirement: "Pension",
  other: "Annat",
};

export const EMPLOYMENT_FORMS = ["Tillsvidare", "Visstid", "Provanställning", "Konsult", "Praktik"];

/** Villkorsnycklar som utvärderas från ärendet – chefen kryssar inte i dem. */
export const AUTO_CONDITION_KEYS = new Set(["location_stockholm", "trigger_manual"]);

export const personName = (c: Pick<BoardingCase, "first_name" | "last_name">) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "(Namn saknas)";

export const kindLabel = (kind: BoardingKind) => (kind === "onboarding" ? "Onboarding" : "Offboarding");

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("sv-SE") : "";
