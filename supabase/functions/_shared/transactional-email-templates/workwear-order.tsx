/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Item {
  productName: string
  colorLabel: string
  size: string
  quantity: number
  url?: string
}

interface Props {
  employeeName?: string
  employeeEmail?: string
  seasonLabel?: string
  items?: Item[]
  notes?: string
}

const WorkwearOrderEmail = ({
  employeeName = 'Anställd',
  employeeEmail = '',
  seasonLabel = '',
  items = [],
  notes = '',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Beställning av profilkläder – {employeeName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>👔 Beställning av profilkläder</Heading>
        </div>
        <div style={content}>
          <Text style={intro}>
            <strong>{employeeName}</strong> har beställt profilkläder
            {seasonLabel ? ` (${seasonLabel})` : ''}:
          </Text>
          <table cellPadding={0} cellSpacing={0} style={table}>
            <thead>
              <tr style={theadRow}>
                <th style={th}>Plagg</th>
                <th style={th}>Färg</th>
                <th style={th}>Storlek</th>
                <th style={{ ...th, textAlign: 'center' as const }}>Antal</th>
                <th style={th}>Produkt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={td}>{item.productName}</td>
                  <td style={td}>{item.colorLabel}</td>
                  <td style={td}>{item.size}</td>
                  <td style={{ ...td, textAlign: 'center' as const }}>{item.quantity}</td>
                  <td style={td}>
                    {item.url ? (
                      <Link href={item.url} style={link}>Länk</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {notes ? (
            <Text style={notesText}><strong>Kommentar:</strong> {notes}</Text>
          ) : null}
          {employeeEmail ? (
            <Text style={meta}>E-post: {employeeEmail}</Text>
          ) : null}
        </div>
        <Text style={footer}>SHF Intra · Svensk Handelsfastigheter</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WorkwearOrderEmail,
  subject: (data: Record<string, any>) =>
    `[SHF] Beställning profilkläder – ${data?.employeeName || 'Anställd'}`,
  displayName: 'Profilkläder – beställning',
  previewData: {
    employeeName: 'Anna Andersson',
    employeeEmail: 'anna@example.com',
    seasonLabel: 'Vår/Sommar',
    items: [
      { productName: 'Piké', colorLabel: 'Marinblå', size: 'M', quantity: 2, url: 'https://157work.com' },
    ],
    notes: 'Levereras till kontoret i Stockholm.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Roboto','Segoe UI',Arial,sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }
const header = {
  background: '#2e4a62',
  padding: '28px 32px',
  borderRadius: '12px 12px 0 0',
}
const headerTitle = { margin: 0, fontSize: '20px', fontWeight: 600 as const, color: '#ffffff' }
const content = {
  background: '#ffffff',
  padding: '32px',
  border: '1px solid #dde1e6',
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
}
const intro = { margin: '0 0 16px', fontSize: '15px', color: '#3a4553' }
const table = { width: '100%', margin: '16px 0', border: '1px solid #dde1e6', borderRadius: '8px' }
const theadRow = { background: '#f4f5f7' }
const th = {
  padding: '8px 12px',
  textAlign: 'left' as const,
  fontSize: '12px',
  color: '#6b7685',
  textTransform: 'uppercase' as const,
}
const td = { padding: '8px 12px', borderBottom: '1px solid #dde1e6', fontSize: '14px', color: '#3a4553' }
const link = { color: '#2e4a62' }
const notesText = { margin: '16px 0 0', fontSize: '14px', color: '#3a4553' }
const meta = { margin: '16px 0 0', fontSize: '13px', color: '#6b7685' }
const footer = { padding: '24px 16px', textAlign: 'center' as const, fontSize: '11px', color: '#6b7685' }
