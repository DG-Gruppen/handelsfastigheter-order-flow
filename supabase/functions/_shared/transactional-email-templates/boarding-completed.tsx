/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BRAND, styles, formatSweDate, caseLink, TestBanner, BrandFooter, type BoardingKind } from './_boarding-shared.tsx'

interface Props {
  kind?: BoardingKind
  caseId?: string
  recipientFirstName?: string
  personName?: string
  startDate?: string
  lastDay?: string
  deepLink?: string
  redirectedFrom?: string
}

const Email = ({
  kind = 'onboarding',
  caseId,
  recipientFirstName = '',
  personName = 'Ny medarbetare',
  startDate,
  lastDay,
  deepLink,
  redirectedFrom,
}: Props) => {
  const isOn = kind === 'onboarding'
  const link = deepLink ?? caseLink(caseId)
  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>{`${isOn ? 'Onboarding' : 'Offboarding'} klar för ${personName}`}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>🎉 {isOn ? 'Onboarding' : 'Offboarding'} klar</Heading>
          </div>
          <div style={styles.content}>
            <TestBanner redirectedFrom={redirectedFrom} />
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName || ''}</strong>,
            </Text>
            <Text style={styles.text}>
              Alla uppgifter för <strong>{personName}</strong>
              {isOn && startDate ? ` (startdatum ${formatSweDate(startDate)})` : ''}
              {!isOn && lastDay ? ` (sista dag ${formatSweDate(lastDay)})` : ''} är avbockade. Tack till alla som bidragit.
            </Text>
            <div style={styles.infoBox}>
              <Text style={{ ...styles.text, margin: 0 }}>
                Hela checklistan, vem som gjorde vad och när, finns kvar i ärendet – bra underlag för uppföljning.
              </Text>
            </div>
            <div style={styles.btnWrap}>
              <Button style={styles.button} href={link}>Öppna ärendet</Button>
            </div>
          </div>
          <BrandFooter />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `[SHF Intra] ${data.kind === 'offboarding' ? 'Offboarding' : 'Onboarding'} klar: ${data.personName || 'medarbetare'}`,
  displayName: 'Boarding v2 – klart (HR + chef)',
  previewData: { kind: 'onboarding', caseId: 'demo', recipientFirstName: 'Petra', personName: 'Erik Svensson', startDate: '2026-10-01' },
} satisfies TemplateEntry
