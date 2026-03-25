/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Du har blivit inbjuden till {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>✉️ Inbjudan</Heading>
        </div>
        <div style={content}>
          <Heading style={h1}>Du har blivit inbjuden</Heading>
          <Text style={text}>
            Du har blivit inbjuden att gå med i{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            . Klicka på knappen nedan för att acceptera inbjudan och skapa ditt konto.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Acceptera inbjudan
          </Button>
          <Text style={footer}>
            Om du inte förväntade dig denna inbjudan kan du ignorera detta meddelande.
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

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', system-ui, Arial, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }
const header = { background: 'linear-gradient(135deg, #2e4a62 0%, #3a5f7c 100%)', padding: '28px 32px', borderRadius: '12px 12px 0 0' }
const headerTitle = { margin: '0', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '20px', fontWeight: '600' as const, color: '#ffffff', letterSpacing: '-0.3px' }
const content = { backgroundColor: '#ffffff', padding: '32px', border: '1px solid #dde1e6', borderTop: 'none', borderRadius: '0 0 12px 12px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a2332', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#3a4553', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#2e4a62', textDecoration: 'underline' }
const button = { background: 'linear-gradient(135deg, #2e4a62 0%, #3a5f7c 100%)', color: '#ffffff', fontSize: '14px', fontWeight: '700' as const, borderRadius: '8px', padding: '12px 32px', textDecoration: 'none', letterSpacing: '0.2px' }
const footer = { fontSize: '12px', color: '#6b7685', margin: '30px 0 0' }
const brandFooter = { padding: '24px 16px', textAlign: 'center' as const }
const brandName = { margin: '0 0 8px', fontSize: '13px', fontWeight: '500' as const, color: '#6b7685', fontFamily: "Georgia, 'Times New Roman', serif" }
const brandSub = { margin: '0', fontSize: '11px', color: '#6b7685' }
