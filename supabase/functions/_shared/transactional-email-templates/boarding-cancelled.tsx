/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { BRAND, styles, TestBanner, BrandFooter, type BoardingKind } from './_boarding-shared.tsx'

interface Props {
  kind?: BoardingKind
  caseId?: string
  recipientFirstName?: string
  personName?: string
  cancelReason?: string
  cancelledByName?: string
  deepLink?: string
  redirectedFrom?: string
}

const Email = ({
  kind = 'onboarding',
  recipientFirstName = '',
  personName = 'Ny medarbetare',
  cancelReason,
  cancelledByName = 'HR',
  redirectedFrom,
}: Props) => {
  const isOn = kind === 'onboarding'
  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>{`${isOn ? 'Onboardingen' : 'Offboardingen'} för ${personName} är avbruten`}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <div style={styles.header}>
            <Heading style={styles.headerTitle}>⛔ {isOn ? 'Onboarding' : 'Offboarding'} avbruten</Heading>
          </div>
          <div style={styles.content}>
            <TestBanner redirectedFrom={redirectedFrom} />
            <Text style={styles.greeting}>
              Hej <strong style={{ color: BRAND.textDark }}>{recipientFirstName || ''}</strong>,
            </Text>
            <Text style={styles.text}>
              {cancelledByName} har avbrutit {isOn ? 'onboardingen' : 'offboardingen'} för <strong>{personName}</strong>.
              Dina öppna uppgifter i ärendet behöver inte göras.
            </Text>
            {cancelReason && (
              <div style={styles.warningBox}>
                <Text style={{ ...styles.text, margin: 0 }}>
                  <strong>Anledning:</strong> {cancelReason}
                </Text>
              </div>
            )}
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
    `[SHF Intra] ${data.kind === 'offboarding' ? 'Offboarding' : 'Onboarding'} avbruten: ${data.personName || 'medarbetare'}`,
  displayName: 'Boarding v2 – avbruten',
  previewData: { kind: 'onboarding', caseId: 'demo', recipientFirstName: 'Emma', personName: 'Erik Svensson', cancelReason: 'Kandidaten tackade nej.', cancelledByName: 'Petra Bondesson' },
} satisfies TemplateEntry
