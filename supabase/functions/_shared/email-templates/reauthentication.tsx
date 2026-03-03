/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>Cod de verificare — Intranet ICMPP</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://erghywhqrxmwqptusbxd.supabase.co/storage/v1/object/public/email-assets/logo-icmpp.png"
            width="64"
            height="64"
            alt="ICMPP Logo"
            style={logo}
          />
        </Section>
        <Heading style={h1}>Cod de verificare</Heading>
        <Text style={text}>Folosește codul de mai jos pentru a-ți confirma identitatea:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Acest cod expiră în scurt timp. Dacă nu ai solicitat acest cod, poți ignora emailul.
        </Text>
        <Text style={footerBrand}>
          Institutul de Chimie Macromoleculară „Petru Poni" — Iași
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logo = { display: 'inline-block' as const }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a365d',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#4a5568',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#1a5fb4',
  margin: '0 0 30px',
  letterSpacing: '4px',
}
const footer = { fontSize: '12px', color: '#a0aec0', margin: '32px 0 4px' }
const footerBrand = { fontSize: '11px', color: '#cbd5e0', margin: '0' }
