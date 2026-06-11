/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, styles, formatSweDate } from './_onboarding-shared.ts'

interface Props {
  instanceId?: string
  fullName?: string
  position?: string
  lastDay?: string
  exitReason?: string
  exitType?: string
  initiatedByName?: string
  deepLink?: string
}

const reasonLabel: Record<string, string> = {
  voluntary: 'Egen uppsägning',
  employer: 'Arbetsgivarens uppsägning',
  retirement: 'Pension',
  other: 'Annat',
}

const Email = ({
  fullName = 'Medarbetare',
  position,
  lastDay,
  exitReason,
  exitType,
  initiatedByName = 'Närmaste chef',
  deepLink = `${SITE_URL}/boarding`,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Ny offboarding för {fullName}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <div style={styles.header}>
          <Heading style={styles.headerTitle}>📤 Ny offboarding</Heading>
        </div>
        <div style={styles.content}>
          <Text style={styles.greeting}>Hej HR,</Text>
          <Text style={styles.text}>
            <strong>{initiatedByName}</strong> har initierat en offboarding. Bekräfta i intranätet för att starta utskick till alla ansvariga.
          </Text>

          <Heading style={styles.sectionHeading}>Medarbetaren</Heading>
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
              {lastDay && (
                <tr>
                  <td style={styles.metaRow}>Sista dag:</td>
                  <td style={styles.metaValue}>{formatSweDate(lastDay)}</td>
                </tr>
              )}
              {exitReason && (
                <tr>
                  <td style={styles.metaRow}>Orsak:</td>
                  <td style={styles.metaValue}>{reasonLabel[exitReason] || exitReason}</td>
                </tr>
              )}
              {exitType && (
                <tr>
                  <td style={styles.metaRow}>Typ:</td>
                  <td style={styles.metaValue}>{exitType === 'immediate' ? 'Snabbavslut (samma dag)' : 'Normalt'}</td>
                </tr>
              )}
            </tbody>
          </table>

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
    `[SHF Intra] Ny offboarding: ${data.fullName || 'medarbetare'}`,
  displayName: 'Offboarding – ny (HR)',
  previewData: {
    instanceId: 'demo',
    fullName: 'Erik Svensson',
    position: 'Fastighetsförvaltare',
    lastDay: '2026-09-30',
    exitReason: 'voluntary',
    exitType: 'normal',
    initiatedByName: 'Anna Johansson',
    deepLink: `${SITE_URL}/boarding/demo`,
  },
} satisfies TemplateEntry
