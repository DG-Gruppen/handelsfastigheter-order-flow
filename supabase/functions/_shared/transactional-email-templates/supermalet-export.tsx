/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  downloadUrl?: string
  count?: number
  expiresHours?: number
}

const SupermaletExport = ({
  recipientName = '',
  downloadUrl = '#',
  count = 0,
  expiresHours = 168,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Excel-export från Supermålet-anmälningarna</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>✈️ Supermålet – Excel-export</Heading>
        </div>
        <div style={content}>
          <Text style={text}>
            Hej {recipientName || 'där'},
          </Text>
          <Text style={text}>
            Här är din export från Supermålet-anmälningarna. Filen innehåller
            <strong> {count}</strong> anmälningar.
          </Text>
          <div style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button href={downloadUrl} style={btn}>Ladda ner Excel</Button>
          </div>
          <Text style={muted}>
            Länken är giltig i {Math.round(expiresHours)} timmar. Behandla filen
            konfidentiellt – den innehåller person- och passuppgifter.
          </Text>
        </div>
        <div style={brandFooter}>
          <Text style={brandName}>SHF Intra</Text>
          <Text style={brandSub}>Detta är ett automatiskt mejl från intranätet.</Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupermaletExport,
  subject: (d: Record<string, any>) =>
    `Supermålet – Excel-export (${d.count ?? 0} anmälningar)`,
  displayName: 'Supermålet – Excel-export',
  previewData: {
    recipientName: 'Anna',
    downloadUrl: 'https://example.com/export.xlsx',
    count: 12,
    expiresHours: 168,
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
const muted = { margin: '16px 0 0', fontSize: '12px', color: BRAND.textMuted, lineHeight: '1.5' }
const btn = { backgroundColor: BRAND.primary, color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const brandFooter = { padding: '24px 16px', textAlign: 'center' as const }
const brandName = { margin: '0 0 8px', fontSize: '13px', fontWeight: '500' as const, color: BRAND.textMuted, fontFamily: "Georgia, 'Times New Roman', serif" }
const brandSub = { margin: '0', fontSize: '11px', color: BRAND.textMuted }
