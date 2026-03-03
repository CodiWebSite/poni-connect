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
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>Link de autentificare — Intranet ICMPP</Preview>
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
        <Heading style={h1}>Link de autentificare</Heading>
        <Text style={text}>
          Apasă butonul de mai jos pentru a te autentifica pe Intranet ICMPP. Acest link expiră în scurt timp.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Autentifică-te
        </Button>
        <Text style={footer}>
          Dacă nu ai solicitat acest link, poți ignora acest email.
        </Text>
        <Text style={footerBrand}>
          Institutul de Chimie Macromoleculară „Petru Poni" — Iași
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
