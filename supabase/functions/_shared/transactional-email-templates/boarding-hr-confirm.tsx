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
  position?: string
  startDate?: string
  lastDay?: string
  managerName?: string
  deepLink?: string
  redirectedFrom?: string
}

const Email = ({
  kind = 'onboarding',
  caseId,
  recipientFirstName = '',
  personName = 'Ny medarbetare',
  position,
  startDate,
  lastDay,
  managerName,
  deepLink,
  redirectedFrom,
}: Props) => {
  const isOn = kind === 'onboarding'
  const link = deepLink ?? caseLink(caseId)
  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>{`${managerName || 'Chefen'} har gjort sina val för ${personName} – bekräfta utskick`}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>🔎 Bekräfta {isOn ? 'onboarding' : 'offboarding'}</Heading>
          </div>
          <div style={styles.content}>
            <TestBanner redirectedFrom={redirectedFrom} />
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName || ''}</strong>,
            </Text>
            <Text style={styles.text}>
              {managerName || 'Närmaste chef'} har gjort sina val för <strong>{personName}</strong>
              {position ? ` (${position})` : ''}
              {isOn && startDate ? `, startdatum ${formatSweDate(startDate)}` : ''}
              {!isOn && lastDay ? `, sista dag ${formatSweDate(lastDay)}` : ''}.
              Ärendet väntar på din bekräftelse innan uppgifterna skickas ut till alla ansvariga.
            </Text>
            <div style={styles.btnWrap}>
              <Button style={styles.button} href={link}>Granska och bekräfta</Button>
              <Text style={styles.btnNote}>Länken kräver inloggning på SHF Intra</Text>
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
    `[SHF Intra] Bekräfta ${data.kind === 'offboarding' ? 'offboarding' : 'onboarding'}: ${data.personName || 'medarbetare'}`,
  displayName: 'Boarding v2 – HR bekräftar',
  previewData: {
    kind: 'onboarding',
    caseId: 'demo',
    recipientFirstName: 'Petra',
    personName: 'Erik Svensson',
    position: 'Fastighetsförvaltare',
    startDate: '2026-10-01',
    managerName: 'Malin Ekwall',
  },
} satisfies TemplateEntry
