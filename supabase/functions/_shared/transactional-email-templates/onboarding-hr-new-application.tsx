/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, BRAND, styles, formatSweDate } from './_onboarding-shared.ts'

interface Props {
  instanceId?: string
  fullName?: string
  position?: string
  startDate?: string
  initiatedByName?: string
  optionalItems?: string[]
  deepLink?: string
}

const Email = ({
  fullName = 'Ny medarbetare',
  position,
  startDate,
  initiatedByName = 'Närmaste chef',
  optionalItems = [],
  deepLink = `${SITE_URL}/onboarding`,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Ny onboardingansökan för {fullName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <div style={styles.header}>
          <Heading style={styles.headerTitle}>📥 Ny onboardingansökan</Heading>
        </div>
        <div style={styles.content}>
          <Text style={styles.greeting}>Hej HR,</Text>
          <Text style={styles.text}>
            <strong>{initiatedByName}</strong> har initierat en onboarding för en ny medarbetare. Lägg in personen i Heartpace och bekräfta i intranätet — då rullar resten av processen igång automatiskt.
          </Text>

          <Heading style={styles.sectionHeading}>Den nyanställde</Heading>
          <table cellPadding="0" cellSpacing="0">
            <tbody>
              <tr>
                <td style={styles.metaRow}>Namn:</td>
                <td style={styles.metaValue}>{fullName}</td>
              </tr>
              {position && (
                <tr>
                  <td style={styles.metaRow}>Befattning:</td>
                  <td style={styles.metaValue}>{position}</td>
                </tr>
              )}
              {startDate && (
                <tr>
                  <td style={styles.metaRow}>Startdatum:</td>
                  <td style={styles.metaValue}>{formatSweDate(startDate)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {optionalItems.length > 0 && (
            <>
              <Heading style={styles.sectionHeading}>Markerade tillval</Heading>
              <div style={styles.infoBox}>
                <Text style={{ ...styles.text, margin: 0 }}>
                  {optionalItems.join(' · ')}
                </Text>
              </div>
            </>
          )}

          <Text style={styles.text}>
            När du klickar "Bekräfta & starta utskick" i ärendet skickas mejl och notiser till alla ansvariga (chef, systemägare, externa kontakter m.fl.) med deras del av checklistan.
          </Text>

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
    `[SHF Intra] Ny onboardingansökan: ${data.fullName || 'Ny medarbetare'}`,
  displayName: 'Onboarding – ny ansökan (HR)',
  previewData: {
    instanceId: 'demo-instance',
    fullName: 'Erik Svensson',
    position: 'Fastighetsförvaltare',
    startDate: '2026-08-01',
    initiatedByName: 'Anna Johansson',
    optionalItems: ['Tjänstebil', 'ID06', 'Creditsafe'],
    deepLink: `${SITE_URL}/onboarding/demo-instance`,
  },
} satisfies TemplateEntry
