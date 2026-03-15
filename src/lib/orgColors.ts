/**
 * Shared color map for org chart roles — used by OrgChartCanvas and Personnel page.
 * Maps color keys (from org_chart_settings) to HSL values from SHF grafiska profil.
 */

export interface OrgColorSet {
  bg: string;
  border: string;
  borderLight: string;
  text: string;
  accent: string;
}

export const ORG_COLOR_MAP: Record<string, OrgColorSet> = {
  // Himmel och Vatten – VD / Root
  primary: {
    bg: "hsl(208, 40%, 27%)",
    border: "hsl(208, 40%, 37%)",
    borderLight: "hsl(208, 35%, 60%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(206, 28%, 50%)",
  },
  // Land och Miljö – Stab
  accent: {
    bg: "hsl(162, 31%, 31%)",
    border: "hsl(162, 31%, 41%)",
    borderLight: "hsl(162, 28%, 60%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(162, 28%, 50%)",
  },
  // Himmel och Vatten (ljusare) – Chef variant 1
  blue: {
    bg: "hsl(206, 28%, 37%)",
    border: "hsl(206, 28%, 47%)",
    borderLight: "hsl(206, 25%, 65%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(206, 25%, 55%)",
  },
  // Land och Miljö (ljusare) – Chef variant 2
  green: {
    bg: "hsl(162, 32%, 40%)",
    border: "hsl(162, 32%, 50%)",
    borderLight: "hsl(162, 28%, 65%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(162, 28%, 55%)",
  },
  // Eld och Värme – Chef variant 3
  amber: {
    bg: "hsl(19, 70%, 38%)",
    border: "hsl(19, 70%, 48%)",
    borderLight: "hsl(19, 55%, 65%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(19, 55%, 55%)",
  },
  // Aubergine – Stab
  purple: {
    bg: "hsl(280, 30%, 30%)",
    border: "hsl(280, 30%, 40%)",
    borderLight: "hsl(280, 25%, 60%)",
    text: "hsl(0, 0%, 100%)",
    accent: "hsl(280, 25%, 50%)",
  },
  // Sten och Betong – Anställda
  muted: {
    bg: "hsl(60, 6%, 30%)",
    border: "hsl(60, 6%, 40%)",
    borderLight: "hsl(60, 5%, 72%)",
    text: "hsl(60, 4%, 92%)",
    accent: "hsl(60, 5%, 55%)",
  },
};

/**
 * Given a role string, return the matching org color key based on org_chart_settings.
 */
export function getRoleColorKey(
  role: string,
  colorSettings: { color_root?: string; color_staff?: string; color_manager?: string; color_employee?: string }
): string {
  switch (role) {
    case "admin":
      return colorSettings.color_root ?? "primary";
    case "staff":
      return colorSettings.color_staff ?? "purple";
    case "manager":
      return (colorSettings.color_manager ?? "amber").split(",")[0];
    default:
      return colorSettings.color_employee ?? "green";
  }
}
