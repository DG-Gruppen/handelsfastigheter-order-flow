/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://intra.handelsfastigheter.se'

interface Props {
  recipientName?: string
  title?: string
  orderRecipientName?: string
  comment?: string
  orderUrl?: string
}

const OrderDeliveredEmail = ({
  recipientName = 'Medarbetare',
  title = 'Beställning',
  orderRecipientName,
  comment,
  orderUrl = SITE_URL,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Din beställning har levererats: {title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>📦 Beställning levererad</Heading>
        </div>
        <div style={content}>
          <Text style={greeting}>
            Hej <strong style={{ color: BRAND.textDark }}>{recipientName}</strong>,
          </Text>
          <Text style={text}>
            Din beställning <strong>&ldquo;{title}&rdquo;</strong> har nu markerats som levererad.
          </Text>
          {orderRecipientName && (
            <Text style={text}>Mottagare: <strong>{orderRecipientName}</strong></Text>
          )}
          {comment && (
            <div style={commentBox}>
              <Text style={commentLabel}>Kommentar från IT</Text>
              <Text style={commentText}>{comment}</Text>
            </div>
          )}
          <div style={btnWrap}>
            <Button style={button} href={orderUrl}>Visa beställning</Button>
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
  component: OrderDeliveredEmail,
  subject: (data: Record<string, any>) =>
    `[SHF IT] Beställning levererad: ${data.title || 'Beställning'}`,
  displayName: 'Beställning levererad',
  previewData: {
    recipientName: 'Knud Lauridsen',
    title: 'Onboarding: Erik Svensson',
    orderRecipientName: 'Erik Svensson',
    comment: 'Utrustningen finns redo att hämtas på plan 3.',
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
const greeting = { margin: '0 0 20px', fontSize: '15px', color: BRAND.textBody, lineHeight: '1.6' }
const text = { margin: '0 0 16px', fontSize: '14px', color: BRAND.textBody, lineHeight: '1.6' }
const commentBox = { margin: '16px 0', padding: '14px 18px', background: '#f4f5f7', borderLeft: `4px solid ${BRAND.primary}`, borderRadius: '0 8px 8px 0' }
const commentLabel = { margin: '0 0 4px', fontSize: '11px', color: BRAND.textMuted, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const commentText = { margin: '0', fontSize: '14px', color: BRAND.textDark, lineHeight: '1.5' }
const btnWrap = { margin: '28px 0 8px', textAlign: 'center' as const }
const button = { display: 'inline-block' as const, padding: '12px 32px', background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%)`, color: '#ffffff', textDecoration: 'none', borderRadius: '8px', fontWeight: '700' as const, fontSize: '14px', letterSpacing: '0.2px' }
const btnNote = { margin: '10px 0 0', fontSize: '11px', color: BRAND.textMuted }
const brandFooter = { padding: '24px 16px', textAlign: 'center' as const }
const brandName = { margin: '0 0 8px', fontSize: '13px', fontWeight: '500' as const, color: BRAND.textMuted, fontFamily: "Georgia, 'Times New Roman', serif" }
const brandSub = { margin: '0', fontSize: '11px', color: BRAND.textMuted }
const link = { color: BRAND.primary, textDecoration: 'none' }
