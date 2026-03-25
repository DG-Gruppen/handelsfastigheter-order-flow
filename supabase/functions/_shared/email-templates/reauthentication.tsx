/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Din verifieringskod</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>🔑 Verifiering</Heading>
        </div>
        <div style={content}>
          <Heading style={h1}>Bekräfta din identitet</Heading>
          <Text style={text}>Använd koden nedan för att bekräfta din identitet:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            Koden upphör att gälla inom kort. Om du inte begärde detta kan du ignorera detta meddelande.
          </Text>
        </div>
        <div style={brandFooter}>
          <Text style={brandName}>SHF Intra</Text>
          <Text style={brandSub}>Svensk Handelsfastigheter · intra.handelsfastigheter.se</Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', system-ui, Arial, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }
const header = { background: 'linear-gradient(135deg, #2e4a62 0%, #3a5f7c 100%)', padding: '28px 32px', borderRadius: '12px 12px 0 0' }
const headerTitle = { margin: '0', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '20px', fontWeight: '600' as const, color: '#ffffff', letterSpacing: '-0.3px' }
const content = { backgroundColor: '#ffffff', padding: '32px', border: '1px solid #dde1e6', borderTop: 'none', borderRadius: '0 0 12px 12px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a2332', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#3a4553', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#2e4a62', margin: '0 0 30px', textAlign: 'center' as const, letterSpacing: '4px' }
const footer = { fontSize: '12px', color: '#6b7685', margin: '30px 0 0' }
const brandFooter = { padding: '24px 16px', textAlign: 'center' as const }
const brandName = { margin: '0 0 8px', fontSize: '13px', fontWeight: '500' as const, color: '#6b7685', fontFamily: "Georgia, 'Times New Roman', serif" }
const brandSub = { margin: '0', fontSize: '11px', color: '#6b7685' }
