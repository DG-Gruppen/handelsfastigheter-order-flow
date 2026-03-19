import { getAppBaseUrl } from "@/lib/utils";
import { APP_BASE_URL } from "@/lib/constants";

/** Escape HTML special characters to prevent XSS in email templates */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * SHF Email Template System
 * Branded email templates following SHF's visual identity:
 * - Roboto / Roboto Slab fonts
 * - Primary: #2e4a62 (Himmel och Vatten)
 * - Accent: #3d7a6a (Land och Miljö)
 * - Warning/Destructive: #b34304 (Eld och Värme)
 */

const BRAND = {
  primary: "#2e4a62",
  primaryLight: "#3a5f7c",
  accent: "#3d7a6a",
  accentLight: "#e8f5f0",
  destructive: "#b34304",
  destructiveLight: "#fef2ed",
  bgLight: "#f4f5f7",
  bgCard: "#ffffff",
  textDark: "#1a2332",
  textBody: "#3a4553",
  textMuted: "#6b7685",
  border: "#dde1e6",
  // Use system-ui stack – Google Fonts <link> tags are ignored by most email clients
  fontStack: "'Segoe UI', system-ui, Arial, sans-serif",
  fontHeading: "Georgia, 'Times New Roman', serif",
  logoUrl: `${APP_BASE_URL}/favicon.png`,
};

/** Full email wrapper with SHF branding */
export function emailLayout(title: string, emoji: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${BRAND.bgLight};font-family:${BRAND.fontStack};-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%);padding:28px 32px;border-radius:12px 12px 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <h1 style="margin:0;font-family:${BRAND.fontHeading};font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.3px;">
              ${emoji} ${title}
            </h1>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="background:${BRAND.bgCard};padding:32px;border:1px solid ${BRAND.border};border-top:none;border-radius:0 0 12px 12px;">
      ${body}
    </div>

    <!-- Footer -->
    <div style="padding:24px 16px;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:500;color:${BRAND.textMuted};font-family:${BRAND.fontHeading};">
        SHF Intra
      </p>
      <p style="margin:0;font-size:11px;color:${BRAND.textMuted};">
        Svensk Handelsfastigheter · <a href="${APP_BASE_URL}" style="color:${BRAND.primary};text-decoration:none;">intra.handelsfastigheter.se</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Greeting paragraph */
export function emailGreeting(name: string): string {
  return `<p style="margin:0 0 20px;font-size:15px;color:${BRAND.textBody};line-height:1.6;">
    Hej <strong style="color:${BRAND.textDark};">${escapeHtml(name)}</strong>,
  </p>`;
}

/** Body text paragraph */
export function emailText(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;color:${BRAND.textBody};line-height:1.6;">${text}</p>`;
}

/** Section heading */
export function emailHeading(text: string): string {
  return `<h3 style="margin:20px 0 10px;font-family:${BRAND.fontHeading};font-size:14px;font-weight:600;color:${BRAND.primary};text-transform:uppercase;letter-spacing:0.5px;">${text}</h3>`;
}

/** Items list (equipment) */
export function emailItemsList(items: { name: string; quantity?: number; description?: string | null }[]): string {
  const rows = items.map((i) => {
    const qty = (i.quantity ?? 1) > 1 ? ` <span style="color:${BRAND.textMuted};">×${i.quantity}</span>` : "";
    const desc = i.description ? `<br><span style="font-size:12px;color:${BRAND.textMuted};">${escapeHtml(i.description)}</span>` : "";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.textDark};">
        <strong>${escapeHtml(i.name)}</strong>${qty}${desc}
      </td>
    </tr>`;
  }).join("");
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;">
    ${rows}
  </table>`;
}

/** Systems/licenses list */
export function emailSystemsList(systems: { name: string; description?: string | null }[]): string {
  if (systems.length === 0) return "";
  const rows = systems.map((s) => {
    const desc = s.description ? ` <span style="color:${BRAND.textMuted};">– ${escapeHtml(s.description)}</span>` : "";
    return `<li style="padding:4px 0;font-size:14px;color:${BRAND.textDark};">${escapeHtml(s.name)}${desc}</li>`;
  }).join("");
  return `${emailHeading("System & Licenser")}<ul style="margin:0;padding-left:20px;">${rows}</ul>`;
}

/** Primary CTA button */
export function emailButton(url: string, label: string): string {
  return `<div style="margin:28px 0 8px;text-align:center;">
    <a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;font-family:${BRAND.fontStack};letter-spacing:0.2px;">
      ${label}
    </a>
    <p style="margin:10px 0 0;font-size:11px;color:${BRAND.textMuted};">Länken kräver inloggning på SHF Intra</p>
  </div>`;
}

/** Info callout box (neutral) */
export function emailCallout(content: string): string {
  return `<div style="margin:16px 0;padding:14px 18px;background:${BRAND.accentLight};border-left:4px solid ${BRAND.accent};border-radius:0 8px 8px 0;">
    ${content}
  </div>`;
}

/** Warning/rejection callout box */
export function emailWarningCallout(label: string, content: string): string {
  return `<div style="margin:16px 0;padding:14px 18px;background:${BRAND.destructiveLight};border-left:4px solid ${BRAND.destructive};border-radius:0 8px 8px 0;">
    <p style="margin:0 0 4px;font-size:11px;color:${BRAND.textMuted};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</p>
    <p style="margin:0;font-size:14px;color:${BRAND.textDark};line-height:1.5;">${escapeHtml(content)}</p>
  </div>`;
}

/** Recipient info table */
export function emailRecipientInfo(params: {
  name: string;
  department?: string | null;
  date?: string | null;
  dateLabel?: string;
}): string {
  const rows = [
    `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:${BRAND.textMuted};white-space:nowrap;">Namn:</td><td style="padding:6px 0;font-size:14px;color:${BRAND.textDark};font-weight:500;">${escapeHtml(params.name)}</td></tr>`,
    params.department ? `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:${BRAND.textMuted};white-space:nowrap;">Avdelning:</td><td style="padding:6px 0;font-size:14px;color:${BRAND.textDark};">${escapeHtml(params.department)}</td></tr>` : "",
    params.date ? `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:${BRAND.textMuted};white-space:nowrap;">${escapeHtml(params.dateLabel || "Datum")}:</td><td style="padding:6px 0;font-size:14px;color:${BRAND.textDark};">${new Date(params.date).toLocaleDateString("sv-SE")}</td></tr>` : "",
  ].filter(Boolean).join("");
  return `${emailHeading("Mottagare")}<table cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}
