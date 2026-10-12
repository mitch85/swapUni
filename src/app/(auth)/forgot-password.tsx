import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, EmptyState, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { backend } from '@/lib/backend';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await backend.resetPassword(email);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <EmptyState
          icon="mail-outline"
          title="E-Mail verschickt"
          text="Falls ein Konto mit dieser Adresse existiert, erhältst du gleich einen Link zum Zurücksetzen deines Passworts.">
          <Link href="/login" style={styles.link}>
            Zurück zur Anmeldung
          </Link>
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title subtitle="Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen.">
        Passwort vergessen
      </Title>
      <TextField
        icon="mail-outline"
        placeholder="E-Mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Link senden" onPress={submit} loading={loading} disabled={!email.includes('@')} />
      <Link href="/login" style={[styles.link, styles.center]}>
        Zurück zur Anmeldung
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  center: { textAlign: 'center' },
});
