/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>Confirmare schimbare email — Intranet ICMPP</Preview>
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
        <Heading style={h1}>Confirmare schimbare email</Heading>
        <Text style={text}>
          Ai solicitat schimbarea adresei de email pe Intranet ICMPP de la{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          la{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Apasă butonul de mai jos pentru a confirma modificarea:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmă noul email
        </Button>
        <Text style={footer}>
          Dacă nu ai solicitat această modificare, te rugăm să îți securizezi contul imediat.
        </Text>
        <Text style={footerBrand}>
          Institutul de Chimie Macromoleculară „Petru Poni" — Iași
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const link = { color: '#1a5fb4', textDecoration: 'underline' }
const button = {
  backgroundColor: '#1a5fb4',
  color: '#ffffff',
  fontSize: '15px',
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#a0aec0', margin: '32px 0 4px' }
const footerBrand = { fontSize: '11px', color: '#cbd5e0', margin: '0' }
