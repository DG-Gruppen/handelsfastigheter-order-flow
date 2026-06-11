/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { SITE_URL, BRAND, styles, formatSweDate } from './_onboarding-shared.ts'

interface Props {
  instanceId?: string
  recipientFirstName?: string
  newHireName?: string
  startDate?: string
  daysUntilStart?: 7 | 3 | 1
  openTasks?: { title: string }[]
  deepLink?: string
  escalatedToManager?: boolean
}

const Email = ({
  recipientFirstName = 'Hej',
  newHireName = 'Ny medarbetare',
  startDate,
  daysUntilStart = 3,
  openTasks = [],
  deepLink = `${SITE_URL}/onboarding`,
  escalatedToManager = false,
}: Props) => {
  const urgent = daysUntilStart <= 1
  const emoji = urgent ? '🚨' : daysUntilStart <= 3 ? '⏰' : '🔔'

  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>
        Påminnelse: {newHireName} börjar om {daysUntilStart} {daysUntilStart === 1 ? 'dag' : 'dagar'}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>{emoji} Påminnelse – onboarding</Heading>
          </div>
          <div style={styles.content}>
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName}</strong>,
            </Text>

            {escalatedToManager ? (
              <Text style={styles.text}>
                <strong>{newHireName}</strong> börjar om <strong>1 dag</strong>
                {startDate ? ` (${formatSweDate(startDate)})` : ''} och det finns fortfarande öppna onboarding-uppgifter. Som närmaste chef får du en sammanfattning så att inget glöms bort.
              </Text>
            ) : (
              <Text style={styles.text}>
                <strong>{newHireName}</strong> börjar om <strong>{daysUntilStart} {daysUntilStart === 1 ? 'dag' : 'dagar'}</strong>
                {startDate ? ` (${formatSweDate(startDate)})` : ''}. Du har fortfarande punkter som inte är avbockade:
              </Text>
            )}

            <div style={urgent ? styles.warningBox : styles.infoBox}>
              <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                <tbody>
                  {openTasks.map((t, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 0', fontSize: '14px', color: BRAND.textDark }}>
                        • {t.title}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.btnWrap}>
              <Button style={styles.button} href={deepLink}>Öppna ärendet</Button>
              <Text style={styles.btnNote}>Länken kräver inloggning på SHF Intra</Text>
            </div>

            <Text style={{ ...styles.text, color: BRAND.textMuted, fontSize: '12px', marginTop: '20px' }}>
              Om något är klart men inte avbockat — bocka av i intranätet så slipper vi fler påminnelser.
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
    const days = data.daysUntilStart ?? 3
    const name = data.newHireName || 'ny medarbetare'
    return `[SHF Intra] Påminnelse: ${name} börjar om ${days} ${days === 1 ? 'dag' : 'dagar'}`
  },
  displayName: 'Onboarding – påminnelse',
  previewData: {
    instanceId: 'demo-instance',
    recipientFirstName: 'Christel',
    newHireName: 'Erik Svensson',
    startDate: '2026-08-01',
    daysUntilStart: 3,
    openTasks: [
      { title: 'Beställ passerkort & nycklar' },
      { title: 'Boka introduktionsmöte vecka 1' },
    ],
    deepLink: `${SITE_URL}/onboarding/demo-instance`,
    escalatedToManager: false,
  },
} satisfies TemplateEntry
