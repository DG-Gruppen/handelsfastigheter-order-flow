/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BRAND, styles, formatSweDate, caseLink, TestBanner, BrandFooter, type BoardingKind } from './_boarding-shared.tsx'

interface Props {
  kind?: BoardingKind
  caseId?: string
  managerFirstName?: string
  personName?: string
  position?: string
  department?: string
  startDate?: string
  lastDay?: string
  deepLink?: string
  redirectedFrom?: string
}

const Email = ({
  kind = 'onboarding',
  caseId,
  managerFirstName = '',
  personName = 'Ny medarbetare',
  position,
  department,
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
      <Preview>{isOn ? `${personName} börjar snart – dina val behövs` : `${personName} slutar – dina val behövs`}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>{isOn ? '👋 Ny medarbetare att onboarda' : '📦 Medarbetare som slutar'}</Heading>
          </div>
          <div style={styles.content}>
            <TestBanner redirectedFrom={redirectedFrom} />
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{managerFirstName || 'chef'}</strong>,
            </Text>
            <Text style={styles.text}>
              {isOn ? (
                <>
                  <strong>{personName}</strong> börjar{startDate ? ` ${formatSweDate(startDate)}` : ' snart'}
                  {position ? ` som ${position}` : ''}{department ? ` på ${department}` : ''} och du är närmaste chef.
                </>
              ) : (
                <>
                  <strong>{personName}</strong> har sista arbetsdag{lastDay ? ` ${formatSweDate(lastDay)}` : ' inom kort'} och du är närmaste chef.
                </>
              )}
            </Text>
            <Text style={styles.text}>
              {isOn
                ? 'Innan checklistan går ut till alla ansvariga behöver du välja vilka system personen ska ha tillgång till och kryssa i vad som är aktuellt (ID06, bank, tjänstebil …). Utrustning beställer du som vanligt under Beställningar.'
                : 'Innan checklistan går ut behöver du bekräfta vilka system personen har tillgång till så att rätt personer kan stänga behörigheterna.'}
            </Text>
            <div style={styles.btnWrap}>
              <Button style={styles.button} href={link}>Öppna ärendet och gör dina val</Button>
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
    data.kind === 'offboarding'
      ? `[SHF Intra] Offboarding – ${data.personName || 'medarbetare'} slutar ${formatSweDate(data.lastDay) || 'snart'}`
      : `[SHF Intra] Onboarding – ${data.personName || 'ny medarbetare'} börjar ${formatSweDate(data.startDate) || 'snart'}`,
  displayName: 'Boarding v2 – till närmaste chef (gör dina val)',
  previewData: {
    kind: 'onboarding',
    caseId: 'demo',
    managerFirstName: 'Malin',
    personName: 'Erik Svensson',
    position: 'Fastighetsförvaltare',
    department: 'Förvaltningen Region Syd',
    startDate: '2026-10-01',
  },
} satisfies TemplateEntry
