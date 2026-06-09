/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  lastName?: string
  personalNumber?: string
  birthPlace?: string
  nationality?: string
  passportNumber?: string
  issuedDate?: string
  validUntil?: string
  allergies?: string
  submitterName?: string
  submitterEmail?: string
}

const SupermaletRegistration = ({
  firstName = '',
  lastName = '',
  personalNumber = '',
  birthPlace = '',
  passportNumber = '',
  issuedDate = '',
  validUntil = '',
  allergies = '',
  submitterName = '',
  submitterEmail = '',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Ny anmälan till Supermålet-resan: {firstName} {lastName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>✈️ Ny anmälan: Supermålet-resan</Heading>
        </div>
        <div style={content}>
          <Text style={text}>
            <strong>{submitterName}</strong> ({submitterEmail}) har skickat in en anmälan.
          </Text>

          <Heading as="h3" style={sectionHeading}>Personuppgifter</Heading>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Efternamn" value={lastName} />
              <Row label="För-/mellannamn" value={firstName} />
              <Row label="Personnummer" value={personalNumber} />
              <Row label="Födelseort" value={birthPlace} />
            </tbody>
          </table>

          <Heading as="h3" style={sectionHeading}>Passuppgifter</Heading>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Passnummer" value={passportNumber} />
              <Row label="Utfärdat datum" value={issuedDate} />
              <Row label="Giltigt till" value={validUntil} />
            </tbody>
          </table>

          <Heading as="h3" style={sectionHeading}>Övrigt</Heading>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Allergier" value={allergies || '—'} />
            </tbody>
          </table>
        </div>
        <div style={brandFooter}>
          <Text style={brandName}>SHF Intra</Text>
          <Text style={brandSub}>Detta är ett automatiskt mejl från intranätet.</Text>
        </div>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <tr>
    <td style={infoLabel}>{label}</td>
    <td style={infoValue}>{value}</td>
  </tr>
)

export const template = {
  component: SupermaletRegistration,
  subject: (d: Record<string, any>) =>
    `Ny anmälan Supermålet: ${d.firstName ?? ''} ${d.lastName ?? ''}`.trim(),
  displayName: 'Supermålet – ny anmälan',
  previewData: {
    firstName: 'Anna',
    lastName: 'Andersson',
    personalNumber: '19850101-1234',
    birthPlace: 'Stockholm',
    passportNumber: '12345678',
    issuedDate: '2022-05-10',
    validUntil: '2032-05-10',
    allergies: 'Nötter',
    submitterName: 'Anna Andersson',
    submitterEmail: 'anna@handelsfastigheter.se',
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
const infoLabel = { padding: '6px 16px 6px 0', fontSize: '13px', color: BRAND.textMuted, whiteSpace: 'nowrap' as const, verticalAlign: 'top' as const }
const infoValue = { padding: '6px 0', fontSize: '14px', color: BRAND.textDark, fontWeight: '500' as const }
const brandFooter = { padding: '24px 16px', textAlign: 'center' as const }
const brandName = { margin: '0 0 8px', fontSize: '13px', fontWeight: '500' as const, color: BRAND.textMuted, fontFamily: "Georgia, 'Times New Roman', serif" }
const brandSub = { margin: '0', fontSize: '11px', color: BRAND.textMuted }
