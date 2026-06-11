/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, BRAND, styles } from './_onboarding-shared.ts'

interface Props {
  instanceId?: string
  newHireName?: string
  cancelReason?: string
  cancelledByName?: string
}

const Email = ({
  newHireName = 'Ny medarbetare',
  cancelReason = '',
  cancelledByName = 'HR',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Onboarding för {newHireName} har avbrutits</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <div style={styles.header}>
          <Heading style={styles.headerTitle}>🛑 Onboarding avbruten</Heading>
        </div>
        <div style={styles.content}>
          <Text style={styles.greeting}>Hej,</Text>
          <Text style={styles.text}>
            Onboardingen för <strong>{newHireName}</strong> har avbrutits av <strong>{cancelledByName}</strong>.
            Du behöver inte längre slutföra de punkter du tidigare fått tilldelade i den här processen.
          </Text>

          {cancelReason && (
            <>
              <Heading style={styles.sectionHeading}>Anledning</Heading>
              <div style={styles.warningBox}>
                <Text style={{ ...styles.text, margin: 0, color: BRAND.textDark }}>{cancelReason}</Text>
              </div>
            </>
          )}

          <Text style={{ ...styles.text, color: BRAND.textMuted, fontSize: '12px', marginTop: '20px' }}>
            Har du redan utfört något (t.ex. beställt utrustning eller skapat konton) — kontakta HR om det behöver återställas.
          </Text>
        </div>
        <div style={styles.brandFooter}>
          <Text style={styles.brandName}>SHF Intra</Text>
          <Text style={styles.brandSub}>
            Svensk Handelsfastigheter · <Link href={SITE_URL} style={styles.link}>intra.handelsfastigheter.se</Link>
          </Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `[SHF Intra] Onboarding avbruten: ${data.newHireName || 'ny medarbetare'}`,
  displayName: 'Onboarding – avbruten',
  previewData: {
    instanceId: 'demo-instance',
    newHireName: 'Erik Svensson',
    cancelReason: 'Kandidaten tackade nej efter slutförhandling.',
    cancelledByName: 'Petra (HR)',
  },
} satisfies TemplateEntry
