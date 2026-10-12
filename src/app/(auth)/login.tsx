import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DemoBanner } from '@/components/demo-banner';
import { LogoMark } from '@/components/logo';
import { Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { backend } from '@/lib/backend';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await backend.signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <LogoMark size={72} />
      </View>
      <Title subtitle="Schön, dass du wieder da bist. Finde den perfekten Tauschpartner für deine Wunschuniversität.">
        Willkommen zurück!
      </Title>
      <DemoBanner />
      <TextField
        label="E-Mail"
        icon="mail-outline"
        placeholder="name@uni.de"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Passwort"
        icon="lock-closed-outline"
        placeholder="Passwort"
        secure
        autoComplete="current-password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      <Link href="/forgot-password" style={styles.link}>
        Passwort vergessen?
      </Link>
      <ErrorText>{error}</ErrorText>
      <Button title="Anmelden" onPress={submit} loading={loading} />
      <Text style={styles.footer}>
        Noch kein Konto?{' '}
        <Link href="/register" style={styles.link}>
          Jetzt registrieren
        </Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  footer: { textAlign: 'center', color: Colors.textSecondary, fontSize: 14, marginTop: Spacing.sm },
});
