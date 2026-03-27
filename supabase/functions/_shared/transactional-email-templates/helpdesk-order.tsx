/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://intra.handelsfastigheter.se'

interface Props {
  typeLabel?: string
  title?: string
  requesterName?: string
  requesterDepartment?: string
  requesterRegion?: string
  requesterPhone?: string
  recipientName?: string
  recipientDepartment?: string
  recipientDate?: string
  dateLabel?: string
  description?: string
  items?: { name: string; quantity?: number; description?: string }[]
  systems?: { name: string; description?: string }[]
  orderUrl?: string
}

const HelpdeskOrderEmail = ({
  typeLabel = 'Utrustningsbeställning',
  title = 'Beställning',
  requesterName = 'Medarbetare',
  requesterDepartment,
  requesterRegion,
  requesterPhone,
  recipientName,
  recipientDepartment,
  recipientDate,
  dateLabel = 'Startdatum',
  description,
  items = [],
  systems = [],
  orderUrl = SITE_URL,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{typeLabel}: {title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>🎫 {typeLabel}: {title}</Heading>
        </div>
        <div style={content}>
          <Text style={text}>
            En ny godkänd beställning har inkommit från <strong>{requesterName}</strong>.
          </Text>

          {(requesterDepartment || requesterRegion || requesterPhone) && (
            <>
              <Heading style={sectionHeading}>Beställare</Heading>
              <table cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td style={infoLabel}>Namn:</td>
                    <td style={infoValue}>{requesterName}</td>
                  </tr>
                  {requesterDepartment && (
                    <tr>
                      <td style={infoLabel}>Avdelning:</td>
                      <td style={infoValue}>{requesterDepartment}</td>
                    </tr>
                  )}
                  {requesterRegion && (
                    <tr>
                      <td style={infoLabel}>Region:</td>
                      <td style={infoValue}>{requesterRegion}</td>
                    </tr>
                  )}
                  {requesterPhone && (
                    <tr>
                      <td style={infoLabel}>Telefon:</td>
                      <td style={infoValue}>{requesterPhone}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {recipientName && (
            <>
              <Heading style={sectionHeading}>Mottagare</Heading>
              <table cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td style={infoLabel}>Namn:</td>
                    <td style={infoValue}>{recipientName}</td>
                  </tr>
                  {recipientDepartment && (
                    <tr>
                      <td style={infoLabel}>Avdelning:</td>
                      <td style={infoValue}>{recipientDepartment}</td>
                    </tr>
                  )}
                  {recipientDate && (
                    <tr>
                      <td style={infoLabel}>{dateLabel}:</td>
                      <td style={infoValue}>{recipientDate}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {items.length > 0 && (
            <>
              <Heading style={sectionHeading}>Utrustning</Heading>
              <table cellPadding="0" cellSpacing="0" style={itemsTable}>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td style={itemCell}>
                        <strong>{item.name}</strong>
                        {(item.quantity ?? 1) > 1 && (
                          <span style={{ color: BRAND.textMuted }}> ×{item.quantity}</span>
                        )}
                        {item.description && (
                          <>
                            <br />
                            <span style={{ fontSize: '12px', color: BRAND.textMuted }}>{item.description}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {systems.length > 0 && (
            <>
              <Heading style={sectionHeading}>System & Licenser</Heading>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                {systems.map((s, i) => (
                  <li key={i} style={{ padding: '4px 0', fontSize: '14px', color: BRAND.textDark }}>
                    {s.name}
                    {s.description && (
                      <span style={{ color: BRAND.textMuted }}> – {s.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {description && (
            <>
              <Heading style={sectionHeading}>Kommentar</Heading>
              <Text style={text}>{description}</Text>
            </>
          )}

          <div style={btnWrap}>
            <Button style={button} href={orderUrl}>Visa beställning i systemet</Button>
            <Text style={btnNote}>Länken kräver inloggning på SHF Intra</Text>
          </div>
        </div>
        <div style={brandFooter}>
          <Text style={brandName}>SHF Intra</Text>
          <Text style={brandSub}>Svensk Handelsfastigheter · <Link href={SITE_URL} style={link}>intra.handelsfastigheter.se</Link></Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HelpdeskOrderEmail,
  subject: (data: Record<string, any>) =>
    `[SHF IT Beställning] ${data.typeLabel || 'Beställning'}: ${data.title || ''}`,
  displayName: 'Helpdesk – beställning',
  previewData: {
    typeLabel: 'Onboarding',
    title: 'Onboarding: Erik Svensson',
    requesterName: 'Knud Lauridsen',
    recipientName: 'Erik Svensson',
    recipientDepartment: 'Ekonomi',
    recipientDate: '2026-04-01',
    dateLabel: 'Startdatum',
    items: [
      { name: 'Laptop – MacBook Pro 14"', quantity: 1 },
      { name: 'Headset – Jabra Evolve2 75', quantity: 1, description: 'Trådlöst' },
    ],
    systems: [
      { name: 'Microsoft 365', description: 'E3-licens' },
      { name: 'Visma', description: 'Standard' },
    ],
    description: 'Sitter på kontoret i Stockholm, plan 3',
    orderUrl: 'https://intra.handelsfastigheter.se/orders/demo-123',
  },
} satisfies TemplateEntry

const BRAND = {
  primary: '#2e4a62',
  primaryLight: '#3a5f7c',
  textDark: '#1a2332',
  textBody: '#3a4553',
  textMuted: '#6b7685',
  border: '#dde1e6',
}

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', system-ui, Arial, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }
const header = { background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`, padding: '28px 32px', borderRadius: '12px 12px 0 0' }
const headerTitle = { margin: '0', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '20px', fontWeight: '600' as const, color: '#ffffff', letterSpacing: '-0.3px' }
const content = { backgroundColor: '#ffffff', padding: '32px', border: `1px solid ${BRAND.border}`, borderTop: 'none', borderRadius: '0 0 12px 12px' }
const text = { margin: '0 0 16px', fontSize: '14px', color: BRAND.textBody, lineHeight: '1.6' }
const sectionHeading = { margin: '20px 0 10px', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '14px', fontWeight: '600' as const, color: BRAND.primary, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const infoLabel = { padding: '6px 16px 6px 0', fontSize: '13px', color: BRAND.textMuted, whiteSpace: 'nowrap' as const }
const infoValue = { padding: '6px 0', fontSize: '14px', color: BRAND.textDark, fontWeight: '500' as const }
const itemsTable = { width: '100%', margin: '8px 0 16px', border: `1px solid ${BRAND.border}`, borderRadius: '8px', overflow: 'hidden' as const }
const itemCell = { padding: '8px 12px', borderBottom: `1px solid ${BRAND.border}`, fontSize: '14px', color: BRAND.textDark }
const btnWrap = { margin: '28px 0 8px', textAlign: 'center' as const }
const button = { display: 'inline-block' as const, padding: '12px 32px', background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`, color: '#ffffff', textDecoration: 'none', borderRadius: '8px', fontWeight: '700' as const, fontSize: '14px', letterSpacing: '0.2px' }
const btnNote = { margin: '10px 0 0', fontSize: '11px', color: BRAND.textMuted }
const brandFooter = { padding: '24px 16px', textAlign: 'center' as const }
const brandName = { margin: '0 0 8px', fontSize: '13px', fontWeight: '500' as const, color: BRAND.textMuted, fontFamily: "Georgia, 'Times New Roman', serif" }
const brandSub = { margin: '0', fontSize: '11px', color: BRAND.textMuted }
const link = { color: BRAND.primary, textDecoration: 'none' }
