/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://intra.handelsfastigheter.se'

interface Props {
  approverName?: string
  requesterName?: string
  title?: string
  description?: string
  recipientName?: string
  items?: { name: string; quantity?: number; description?: string }[]
  orderUrl?: string
}

const NewOrderApprovalEmail = ({
  approverName = 'Chef',
  requesterName = 'Medarbetare',
  title = 'Beställning',
  description,
  recipientName,
  items = [],
  orderUrl = SITE_URL,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Ny beställning att attestera: {title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>📋 Ny beställning att attestera</Heading>
        </div>
        <div style={content}>
          <Text style={greeting}>
            Hej <strong style={{ color: BRAND.textDark }}>{approverName}</strong>,
          </Text>
          <Text style={text}>
            <strong>{requesterName}</strong> har skickat en beställning som behöver din attestering:
          </Text>
          <Text style={text}>
            <strong>&ldquo;{title}&rdquo;</strong>
          </Text>
          {recipientName && (
            <Text style={text}>Mottagare: <strong>{recipientName}</strong></Text>
          )}
          {description && (
            <Text style={{ ...text, color: BRAND.textMuted, fontStyle: 'italic' }}>{description}</Text>
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
          <div style={btnWrap}>
            <Button style={button} href={orderUrl}>Granska och attestera</Button>
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
  component: NewOrderApprovalEmail,
  subject: (data: Record<string, any>) =>
    `[SHF IT] Ny beställning att attestera: ${data.title || 'Beställning'}`,
  displayName: 'Ny beställning – attestering',
  previewData: {
    approverName: 'Anna Johansson',
    requesterName: 'Knud Lauridsen',
    title: 'Onboarding: Erik Svensson',
    description: 'Ny medarbetare startar 1 april',
    recipientName: 'Erik Svensson',
    items: [
      { name: 'Laptop – MacBook Pro 14"', quantity: 1 },
      { name: 'Mobiltelefon – iPhone 15', quantity: 1 },
      { name: 'Headset – Jabra Evolve2 75', quantity: 1, description: 'Trådlöst' },
    ],
    orderUrl: 'https://intra.handelsfastigheter.se/orders/demo-123',
  },
} satisfies TemplateEntry

const BRAND = {
  primary: '#2e4a62',
  primaryLight: '#3a5f7c',
  accent: '#3d7a6a',
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
const greeting = { margin: '0 0 20px', fontSize: '15px', color: BRAND.textBody, lineHeight: '1.6' }
const text = { margin: '0 0 16px', fontSize: '14px', color: BRAND.textBody, lineHeight: '1.6' }
const sectionHeading = { margin: '20px 0 10px', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '14px', fontWeight: '600' as const, color: BRAND.primary, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const itemsTable = { width: '100%', margin: '8px 0 16px', border: `1px solid ${BRAND.border}`, borderRadius: '8px', overflow: 'hidden' as const }
const itemCell = { padding: '8px 12px', borderBottom: `1px solid ${BRAND.border}`, fontSize: '14px', color: BRAND.textDark }
const btnWrap = { margin: '28px 0 8px', textAlign: 'center' as const }
const button = { display: 'inline-block' as const, padding: '12px 32px', background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`, color: '#ffffff', textDecoration: 'none', borderRadius: '8px', fontWeight: '700' as const, fontSize: '14px', letterSpacing: '0.2px' }
const btnNote = { margin: '10px 0 0', fontSize: '11px', color: BRAND.textMuted }
const brandFooter = { padding: '24px 16px', textAlign: 'center' as const }
const brandName = { margin: '0 0 8px', fontSize: '13px', fontWeight: '500' as const, color: BRAND.textMuted, fontFamily: "Georgia, 'Times New Roman', serif" }
const brandSub = { margin: '0', fontSize: '11px', color: BRAND.textMuted }
const link = { color: BRAND.primary, textDecoration: 'none' }
