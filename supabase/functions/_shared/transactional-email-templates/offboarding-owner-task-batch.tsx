/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, BRAND, styles, formatSweDate } from './_onboarding-shared.ts'

interface TaskItem { title: string; description?: string; deadline?: string }

interface Props {
  instanceId?: string
  recipientFirstName?: string
  newHireName?: string
  lastDay?: string
  position?: string
  managerName?: string
  tasks?: TaskItem[]
  deepLink?: string
  externalToken?: string
}

const Email = ({
  recipientFirstName = 'Hej',
  newHireName = 'Medarbetare',
  lastDay,
  position,
  managerName,
  tasks = [],
  deepLink = `${SITE_URL}/boarding`,
  externalToken,
}: Props) => {
  const linkUrl = externalToken
    ? `${SITE_URL}/onboarding/extern?token=${externalToken}`
    : deepLink

  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>
        Du har {tasks.length} offboarding-{tasks.length === 1 ? 'uppgift' : 'uppgifter'} för {newHireName}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>📤 Offboarding: dina uppgifter</Heading>
          </div>
          <div style={styles.content}>
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName}</strong>,
            </Text>
            <Text style={styles.text}>
              <strong>{newHireName}</strong> slutar{lastDay ? ` ${formatSweDate(lastDay)}` : ' snart'}
              {position ? ` (${position})` : ''}{managerName ? `, rapporterade till ${managerName}` : ''}.
              Här är punkterna som ligger på dig — bocka av i intranätet när de är klara.
            </Text>

            <Heading style={styles.sectionHeading}>Dina uppgifter ({tasks.length})</Heading>
            <table cellPadding="0" cellSpacing="0" style={styles.itemsTable}>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={i}>
                    <td style={styles.itemCell}>
                      <strong>{t.title}</strong>
                      {t.description && (<><br /><span style={{ fontSize: '12px', color: BRAND.textMuted }}>{t.description}</span></>)}
                      {t.deadline && (<><br /><span style={{ fontSize: '12px', color: BRAND.warning }}>Senast: {formatSweDate(t.deadline)}</span></>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.btnWrap}>
              <Button style={styles.button} href={linkUrl}>Öppna mina uppgifter</Button>
              <Text style={styles.btnNote}>
                {externalToken ? 'Personlig länk — kräver ingen inloggning' : 'Länken kräver inloggning på SHF Intra'}
              </Text>
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
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const count = Array.isArray(data.tasks) ? data.tasks.length : 0
    return `[SHF Intra] ${count} offboarding-${count === 1 ? 'uppgift' : 'uppgifter'} för ${data.newHireName || 'medarbetare'}`
  },
  displayName: 'Offboarding – uppgifter till ansvarig',
  previewData: {
    instanceId: 'demo',
    recipientFirstName: 'Christel',
    newHireName: 'Erik Svensson',
    lastDay: '2026-09-30',
    position: 'Fastighetsförvaltare',
    managerName: 'Anna Johansson',
    tasks: [
      { title: 'Återta nycklar & passerkort' },
      { title: 'Avsluta Google-konto', deadline: '2026-10-01' },
    ],
    deepLink: `${SITE_URL}/boarding/demo`,
  },
} satisfies TemplateEntry
