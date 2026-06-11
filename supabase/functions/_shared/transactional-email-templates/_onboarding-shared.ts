// Delade design-tokens och inline-stilar för onboarding-mejl.
// Matchar mönstret i new-order-approval.tsx (SHF-brand).

export const SITE_URL = 'https://intra.handelsfastigheter.se'

export const BRAND = {
  primary: '#2e4a62',
  primaryLight: '#3a5f7c',
  accent: '#3d7a6a',
  accentLight: '#e8f5f0',
  warning: '#b34304',
  warningLight: '#fef2ed',
  textDark: '#1a2332',
  textBody: '#3a4553',
  textMuted: '#6b7685',
  border: '#dde1e6',
}

export const styles = {
  main: { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', system-ui, Arial, sans-serif" } as const,
  container: { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' } as const,
  header: {
    background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`,
    padding: '28px 32px',
    borderRadius: '12px 12px 0 0',
  } as const,
  headerTitle: {
    margin: '0',
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: '20px',
    fontWeight: '600' as const,
    color: '#ffffff',
    letterSpacing: '-0.3px',
  } as const,
  content: {
    backgroundColor: '#ffffff',
    padding: '32px',
    border: `1px solid ${BRAND.border}`,
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
  } as const,
  greeting: { margin: '0 0 20px', fontSize: '15px', color: BRAND.textBody, lineHeight: '1.6' } as const,
  text: { margin: '0 0 16px', fontSize: '14px', color: BRAND.textBody, lineHeight: '1.6' } as const,
  sectionHeading: {
    margin: '20px 0 10px',
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: '14px',
    fontWeight: '600' as const,
    color: BRAND.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as const,
  infoBox: {
    margin: '12px 0 20px',
    padding: '14px 18px',
    background: BRAND.accentLight,
    borderLeft: `4px solid ${BRAND.accent}`,
    borderRadius: '0 8px 8px 0',
  } as const,
  warningBox: {
    margin: '12px 0 20px',
    padding: '14px 18px',
    background: BRAND.warningLight,
    borderLeft: `4px solid ${BRAND.warning}`,
    borderRadius: '0 8px 8px 0',
  } as const,
  itemsTable: {
    width: '100%',
    margin: '8px 0 16px',
    border: `1px solid ${BRAND.border}`,
    borderRadius: '8px',
    overflow: 'hidden' as const,
  } as const,
  itemCell: {
    padding: '10px 14px',
    borderBottom: `1px solid ${BRAND.border}`,
    fontSize: '14px',
    color: BRAND.textDark,
  } as const,
  btnWrap: { margin: '28px 0 8px', textAlign: 'center' as const } as const,
  button: {
    display: 'inline-block' as const,
    padding: '12px 32px',
    background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`,
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '700' as const,
    fontSize: '14px',
    letterSpacing: '0.2px',
  } as const,
  btnNote: { margin: '10px 0 0', fontSize: '11px', color: BRAND.textMuted } as const,
  brandFooter: { padding: '24px 16px', textAlign: 'center' as const } as const,
  brandName: {
    margin: '0 0 8px',
    fontSize: '13px',
    fontWeight: '500' as const,
    color: BRAND.textMuted,
    fontFamily: "Georgia, 'Times New Roman', serif",
  } as const,
  brandSub: { margin: '0', fontSize: '11px', color: BRAND.textMuted } as const,
  link: { color: BRAND.primary, textDecoration: 'none' } as const,
  metaRow: {
    padding: '6px 16px 6px 0',
    fontSize: '13px',
    color: BRAND.textMuted,
    whiteSpace: 'nowrap' as const,
  } as const,
  metaValue: { padding: '6px 0', fontSize: '14px', color: BRAND.textDark, fontWeight: 500 } as const,
}

export function formatSweDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('sv-SE')
  } catch {
    return iso
  }
}
