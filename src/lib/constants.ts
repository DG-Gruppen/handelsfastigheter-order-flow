/** Centralized constants to avoid magic strings scattered throughout the codebase. */

/** Module slug identifiers used for routing and permission lookups. */
export const MODULE_SLUGS = {
  HOME: "home",
  NEWS: "nyheter",
  STRATEGY: "strategy",
  KNOWLEDGE_BASE: "kunskapsbanken",
  DOCUMENTS: "documents",
  NEW_ORDER: "new-order",
  ONBOARDING: "onboarding",
  HISTORY: "history",
  ORG: "org",
  PERSONNEL: "personnel",
  CULTURE: "kulturen",
  WORKWEAR: "workwear",
  PULSE: "pulse",
  IT_SUPPORT: "it-support",
  PLANNER: "planner",
  TOOLS: "tools",
  PASSWORDS: "losenord",
  MY_SHF: "my-shf",
} as const;

/** User role identifiers used throughout the permission system. */
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  STAFF: "staff",
  IT: "it",
} as const;

/** Order status values used in the orders workflow. */
export const ORDER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DELIVERED: "delivered",
} as const;

/** Approval settings keys stored in org_chart_settings. */
export const APPROVAL_SETTINGS = {
  MANAGERS_TO_CEO: "approval_managers_to_ceo",
  STAFF_TO_CEO: "approval_staff_to_ceo",
} as const;

/** localStorage keys used for persisting UI state. */
export const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: "shf-sidebar-collapsed",
  SIDEBAR_ORDER: "shf-sidebar-order",
} as const;
