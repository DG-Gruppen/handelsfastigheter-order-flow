/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BRAND, styles, formatSweDate, caseLink, TestBanner, BrandFooter, type BoardingKind } from './_boarding-shared.tsx'

interface TaskItem {
  title: string
  description?: string | null
  deadline?: string | null
}

interface Props {
  kind?: BoardingKind
  caseId?: string
  recipientFirstName?: string
  personName?: string
  position?: string
  department?: string
  startDate?: string
  lastDay?: string
  managerName?: string
  costCentre?: string
  tasks?: TaskItem[]
  deepLink?: string
  redirectedFrom?: string
}

const Email = ({
  kind = 'onboarding',
  caseId,
  recipientFirstName = '',
  personName = 'Ny medarbetare',
  position,
  department,
  startDate,
  lastDay,
  managerName,
  costCentre,
  tasks = [],
  deepLink,
  redirectedFrom,
}: Props) => {
  const isOn = kind === 'onboarding'
  const link = deepLink ?? caseLink(caseId)
  const n = tasks.length
  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>
        {`Du har ${n} ${isOn ? 'onboarding' : 'offboarding'}-${n === 1 ? 'uppgift' : 'uppgifter'} för ${personName}`}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>{isOn ? '✅ Onboarding: dina uppgifter' : '✅ Offboarding: dina uppgifter'}</Heading>
          </div>
          <div style={styles.content}>
            <TestBanner redirectedFrom={redirectedFrom} />
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName || ''}</strong>,
            </Text>
            <Text style={styles.text}>
              {isOn ? (
                <>
                  Den {startDate ? formatSweDate(startDate) : 'inom kort'} börjar <strong>{personName}</strong> hos oss
                  {position ? ` som ${position}` : ''}{department ? ` på ${department}` : ''}
                  {managerName ? `. Närmaste chef är ${managerName}` : ''}.
                </>
              ) : (
                <>
                  <strong>{personName}</strong> slutar hos oss{lastDay ? `, sista arbetsdag ${formatSweDate(lastDay)}` : ''}
                  {managerName ? `. Närmaste chef är ${managerName}` : ''}.
                </>
              )}
              {' '}För att det ska bli en så bra {isOn ? 'start' : 'avslutning'} som möjligt får du här de punkter som ligger på dig.
            </Text>

            {costCentre && (
              <table cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td style={styles.metaRow}>Kostnadsställe</td>
                    <td style={styles.metaValue}>{costCentre}</td>
                  </tr>
                </tbody>
              </table>
            )}

            <Heading style={styles.sectionHeading}>Dina uppgifter ({n})</Heading>
            <table cellPadding="0" cellSpacing="0" style={styles.itemsTable}>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={i}>
                    <td style={styles.itemCell}>
                      <strong>{t.title}</strong>
                      {t.description && (
                        <>
                          <br />
                          <span style={{ fontSize: '12px', color: BRAND.textMuted }}>{t.description}</span>
                        </>
                      )}
                      {t.deadline && (
                        <>
                          <br />
                          <span style={{ fontSize: '12px', color: BRAND.warning }}>Senast: {formatSweDate(t.deadline)}</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.btnWrap}>
              <Button style={styles.button} href={link}>Öppna och bocka av</Button>
              <Text style={styles.btnNote}>Länken kräver inloggning på SHF Intra</Text>
            </div>

            <Text style={{ ...styles.text, color: BRAND.textMuted, fontSize: '12px', marginTop: '20px' }}>
              Hör av dig om du har några frågor! Bocka av i intranätet när något är klart så ser HR och chef status.
            </Text>
          </div>
          <BrandFooter />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const name = data.personName || 'ny medarbetare'
    return data.kind === 'offboarding'
      ? `[SHF Intra] Offboarding – ${name}, sista dag ${formatSweDate(data.lastDay) || 'inom kort'}`
      : `[SHF Intra] Onboarding – ${name}, startdatum ${formatSweDate(data.startDate) || 'inom kort'}`
  },
  displayName: 'Boarding v2 – uppgifter till ansvarig',
  previewData: {
    kind: 'onboarding',
    caseId: 'demo',
    recipientFirstName: 'Emma',
    personName: 'Erik Svensson',
    position: 'Fastighetsförvaltare',
    department: 'Förvaltningen Region Syd',
    startDate: '2026-10-01',
    managerName: 'Malin Ekwall',
    tasks: [
      { title: 'Skapa behörighet i Rillion', deadline: '2026-09-28' },
      { title: 'Skapa behörighet i Vitec/3L', deadline: '2026-09-28' },
    ],
  },
} satisfies TemplateEntry
