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
  lastDay?: string
  daysUntilExit?: number
  openTasks?: { title: string }[]
  deepLink?: string
}

const Email = ({
  recipientFirstName = 'Hej',
  newHireName = 'Medarbetare',
  lastDay,
  daysUntilExit = 3,
  openTasks = [],
  deepLink = `${SITE_URL}/boarding`,
}: Props) => {
  const urgent = daysUntilExit <= 0
  const emoji = urgent ? '🚨' : '⏰'
  const label =
    daysUntilExit > 0 ? `om ${daysUntilExit} ${daysUntilExit === 1 ? 'dag' : 'dagar'}`
    : daysUntilExit === 0 ? 'idag'
    : `för ${Math.abs(daysUntilExit)} ${Math.abs(daysUntilExit) === 1 ? 'dag' : 'dagar'} sedan`

  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>Påminnelse offboarding: {newHireName} slutar {label}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>{emoji} Påminnelse – offboarding</Heading>
          </div>
          <div style={styles.content}>
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName}</strong>,
            </Text>
            <Text style={styles.text}>
              <strong>{newHireName}</strong> slutar <strong>{label}</strong>
              {lastDay ? ` (${formatSweDate(lastDay)})` : ''}. Du har fortfarande öppna punkter:
            </Text>

            <div style={urgent ? styles.warningBox : styles.infoBox}>
              <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                <tbody>
                  {openTasks.map((t, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 0', fontSize: '14px', color: BRAND.textDark }}>• {t.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const d = data.daysUntilExit ?? 3
    const name = data.newHireName || 'medarbetare'
    const txt = d > 0 ? `om ${d} ${d === 1 ? 'dag' : 'dagar'}` : d === 0 ? 'idag' : `för ${Math.abs(d)} dag(ar) sedan`
    return `[SHF Intra] Påminnelse offboarding: ${name} slutar ${txt}`
  },
  displayName: 'Offboarding – påminnelse',
  previewData: {
    instanceId: 'demo',
    recipientFirstName: 'Christel',
    newHireName: 'Erik Svensson',
    lastDay: '2026-09-30',
    daysUntilExit: 3,
    openTasks: [{ title: 'Återta nycklar' }, { title: 'Avsluta Google-konto' }],
    deepLink: `${SITE_URL}/boarding/demo`,
  },
} satisfies TemplateEntry
