/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, BRAND, styles, formatSweDate } from './_onboarding-shared.ts'

interface TaskItem {
  title: string
  description?: string
  deadline?: string
}

interface Props {
  instanceId?: string
  recipientFirstName?: string
  newHireName?: string
  startDate?: string
  position?: string
  managerName?: string
  tasks?: TaskItem[]
  deepLink?: string
  externalToken?: string
}

const Email = ({
  recipientFirstName = 'Hej',
  newHireName = 'Ny medarbetare',
  startDate,
  position,
  managerName,
  tasks = [],
  deepLink = `${SITE_URL}/onboarding`,
  externalToken,
}: Props) => {
  const linkUrl = externalToken
    ? `${SITE_URL}/onboarding/extern?token=${externalToken}`
    : deepLink

  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>
        Du har {tasks.length} onboarding-{tasks.length === 1 ? 'uppgift' : 'uppgifter'} för {newHireName}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>✅ Onboarding: dina uppgifter</Heading>
          </div>
          <div style={styles.content}>
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName}</strong>,
            </Text>
            <Text style={styles.text}>
              <strong>{newHireName}</strong> börjar{startDate ? ` ${formatSweDate(startDate)}` : ' snart'}
              {position ? ` som ${position}` : ''}{managerName ? ` och rapporterar till ${managerName}` : ''}.
              Här är de punkter som ligger på dig — bocka av dem i intranätet när de är klara.
            </Text>

            <Heading style={styles.sectionHeading}>Dina uppgifter ({tasks.length})</Heading>
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
                          <span style={{ fontSize: '12px', color: BRAND.warning }}>
                            Senast: {formatSweDate(t.deadline)}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.btnWrap}>
              <Button style={styles.button} href={linkUrl}>Öppna mina uppgifter</Button>
              <Text style={styles.btnNote}>
                {externalToken
                  ? 'Personlig länk — kräver ingen inloggning'
                  : 'Länken kräver inloggning på SHF Intra'}
              </Text>
            </div>

            <Text style={{ ...styles.text, color: BRAND.textMuted, fontSize: '12px', marginTop: '20px' }}>
              Får du påminnelser och har redan gjort något? Bocka av i intranätet så vet både HR och chef att det är klart.
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
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const count = Array.isArray(data.tasks) ? data.tasks.length : 0
    const name = data.newHireName || 'ny medarbetare'
    return `[SHF Intra] ${count} onboarding-${count === 1 ? 'uppgift' : 'uppgifter'} för ${name}`
  },
  displayName: 'Onboarding – uppgifter till ansvarig',
  previewData: {
    instanceId: 'demo-instance',
    recipientFirstName: 'Christel',
    newHireName: 'Erik Svensson',
    startDate: '2026-08-01',
    position: 'Fastighetsförvaltare',
    managerName: 'Anna Johansson',
    tasks: [
      { title: 'Beställ passerkort & nycklar', description: 'Region Syd, huvudkontor + lager' },
      { title: 'Lägg upp i What\u2019s Up Kris', deadline: '2026-07-30' },
      { title: 'Boka introduktionsmöte vecka 1' },
    ],
    deepLink: `${SITE_URL}/onboarding/demo-instance?focus=mine`,
  },
} satisfies TemplateEntry
