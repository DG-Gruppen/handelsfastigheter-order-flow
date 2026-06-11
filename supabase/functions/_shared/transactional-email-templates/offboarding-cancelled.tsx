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
  newHireName = 'Medarbetare',
  cancelReason = '',
  cancelledByName = 'HR',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Offboarding för {newHireName} har avbrutits</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <div style={styles.header}>
          <Heading style={styles.headerTitle}>🛑 Offboarding avbruten</Heading>
        </div>
        <div style={styles.content}>
          <Text style={styles.greeting}>Hej,</Text>
          <Text style={styles.text}>
            Offboardingen för <strong>{newHireName}</strong> har avbrutits av <strong>{cancelledByName}</strong>.
            Du behöver inte längre slutföra de punkter du tidigare fått i den här processen.
          </Text>
          {cancelReason && (
            <>
              <Heading style={styles.sectionHeading}>Anledning</Heading>
              <div style={styles.warningBox}>
                <Text style={{ ...styles.text, margin: 0, color: BRAND.textDark }}>{cancelReason}</Text>
              </div>
            </>
          )}
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
    `[SHF Intra] Offboarding avbruten: ${data.newHireName || 'medarbetare'}`,
  displayName: 'Offboarding – avbruten',
  previewData: {
    instanceId: 'demo',
    newHireName: 'Erik Svensson',
    cancelReason: 'Medarbetaren stannar kvar efter förhandling.',
    cancelledByName: 'Petra (HR)',
  },
} satisfies TemplateEntry
