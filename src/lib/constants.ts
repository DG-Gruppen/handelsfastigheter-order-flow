import { Clock, CheckCircle2, XCircle, Package } from "lucide-react";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  STAFF: "staff",
  IT: "it",
} as const;

export const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: "shf-sidebar-collapsed",
  SIDEBAR_ORDER: "shf-sidebar-order",
} as const;

/** Shared order status display config – single source of truth */
export const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  pending:  { label: "Väntar på attestering", variant: "secondary",    icon: Clock },
  approved: { label: "Godkänd",               variant: "default",      icon: CheckCircle2 },
  rejected: { label: "Avslagen",              variant: "destructive",  icon: XCircle },
  delivered:{ label: "Levererad",             variant: "outline",      icon: Package },
};

/** Short labels used in the History list */
export const ORDER_STATUS_SHORT: Record<string, string> = {
  pending:  "Väntar",
  approved: "Godkänd",
  rejected: "Avslagen",
  delivered:"Levererad",
};

/** Fallback IT helpdesk email */
export const FALLBACK_IT_EMAIL = "helpdesk@dggruppen.se";

/** App base URL */
export const APP_BASE_URL = "https://intra.handelsfastigheter.se";

/** Predefined delivery addresses for hardware orders */
export const DELIVERY_ADDRESSES = [
  { label: "Regionkontor Nord", address: "Maskinistgatan 8, 781 70 Borlänge" },
  { label: "Regionkontor Syd", address: "Grustagsgatan 4, 254 64 Helsingborg" },
  { label: "Huvudkontor (Sthlm)", address: "Holländargatan 10, 111 36 Stockholm" },
] as const;
