/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, styles, formatSweDate } from './_onboarding-shared.ts'

interface Props {
  instanceId?: string
  newHireName?: string
  lastDay?: string
  deepLink?: string
}

const Email = ({
  newHireName = 'Medarbetare',
  lastDay,
  deepLink = `${SITE_URL}/boarding`,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Offboarding klar för {newHireName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <div style={styles.header}>
          <Heading style={styles.headerTitle}>✅ Offboarding klar</Heading>
        </div>
        <div style={styles.content}>
          <Text style={styles.greeting}>Hej,</Text>
          <Text style={styles.text}>
            Alla offboarding-uppgifter för <strong>{newHireName}</strong>
            {lastDay ? ` (sista dag ${formatSweDate(lastDay)})` : ''} är avbockade. Tack till alla som bidragit.
          </Text>
          <div style={styles.infoBox}>
            <Text style={{ ...styles.text, margin: 0 }}>
              Du kan se den fullständiga checklistan, vilka som gjorde vad och tidsstämplar i ärendet.
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
    `[SHF Intra] Offboarding klar för ${data.newHireName || 'medarbetare'}`,
  displayName: 'Offboarding – avslutad',
  previewData: {
    instanceId: 'demo',
    newHireName: 'Erik Svensson',
    lastDay: '2026-09-30',
    deepLink: `${SITE_URL}/boarding/demo`,
  },
} satisfies TemplateEntry
