/// <reference types="npm:@types/react@18.3.1" />
// Gemensamma byggblock för on-/offboarding v2-mejl. Återanvänder
// designtokens från _onboarding-shared.ts (delat stilark, ingen v1-logik).
import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { SITE_URL, BRAND, styles } from './_onboarding-shared.ts'

export { SITE_URL, BRAND, styles, formatSweDate } from './_onboarding-shared.ts'

export type BoardingKind = 'onboarding' | 'offboarding'

export const kindWord = (kind?: BoardingKind) => (kind === 'offboarding' ? 'offboarding' : 'onboarding')

export const caseLink = (caseId?: string) => (caseId ? `${SITE_URL}/boardingv2/${caseId}` : `${SITE_URL}/boardingv2`)

/** Visas när BOARDING_EMAIL_REDIRECT är satt och mejlet gått till testadressen. */
export const TestBanner = ({ redirectedFrom }: { redirectedFrom?: string }) =>
  redirectedFrom ? (
    <div style={{ ...styles.warningBox, marginBottom: '16px' }}>
      <Text style={{ margin: 0, fontSize: '13px', color: BRAND.warning }}>
        <strong>Testläge.</strong> Det här mejlet skulle ha gått till <strong>{redirectedFrom}</strong>.
      </Text>
    </div>
  ) : null

export const BrandFooter = () => (
  <div style={styles.brandFooter}>
    <Text style={styles.brandName}>SHF Intra</Text>
    <Text style={styles.brandSub}>
      Svensk Handelsfastigheter · <Link href={SITE_URL} style={styles.link}>intra.handelsfastigheter.se</Link>
    </Text>
  </div>
)
