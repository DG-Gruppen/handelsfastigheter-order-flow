/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, BRAND, styles, formatSweDate } from './_onboarding-shared.ts'

interface Props {
  instanceId?: string
  newHireName?: string
  startDate?: string
  deepLink?: string
}

const Email = ({
  newHireName = 'Ny medarbetare',
  startDate,
  deepLink = `${SITE_URL}/onboarding`,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Onboarding klar för {newHireName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <div style={styles.header}>
          <Heading style={styles.headerTitle}>🎉 Onboarding klar</Heading>
        </div>
        <div style={styles.content}>
          <Text style={styles.greeting}>Hej,</Text>
          <Text style={styles.text}>
            Alla onboarding-uppgifter för <strong>{newHireName}</strong>
            {startDate ? ` (startdatum ${formatSweDate(startDate)})` : ''} är nu avbockade. Tack till alla som bidragit.
          </Text>

          <div style={styles.infoBox}>
            <Text style={{ ...styles.text, margin: 0 }}>
              Du kan se den fullständiga checklistan, vilka som gjorde vad och tidsstämplar i ärendet — bra att ha för uppföljning eller framtida förbättringar av processen.
            </Text>
          </div>

          <div style={styles.btnWrap}>
            <Button style={styles.button} href={deepLink}>Öppna ärendet</Button>
            <Text style={styles.btnNote}>Länken kräver inloggning på SHF Intra</Text>
          </div>
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
    `[SHF Intra] Onboarding klar för ${data.newHireName || 'ny medarbetare'}`,
  displayName: 'Onboarding – avslutad',
  previewData: {
    instanceId: 'demo-instance',
    newHireName: 'Erik Svensson',
    startDate: '2026-08-01',
    deepLink: `${SITE_URL}/onboarding/demo-instance`,
  },
} satisfies TemplateEntry
