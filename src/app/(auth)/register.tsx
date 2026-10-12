import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { DemoBanner } from '@/components/demo-banner';
import { Button, EmptyState, ErrorText, Icon, Screen, TextField, Title } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { Colors, Spacing } from '@/constants/theme';
import { backend } from '@/lib/backend';

const USERNAME = /^[A-Za-z0-9_.-]{3,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  function validate() {
    const next: typeof errors = {};
    if (!form.firstName.trim()) next.firstName = 'Bitte Vornamen angeben.';
    if (!form.lastName.trim()) next.lastName = 'Bitte Nachnamen angeben.';
    if (!USERNAME.test(form.username)) next.username = '3–24 Zeichen: Buchstaben, Zahlen, _ . -';
    if (!EMAIL.test(form.email.trim())) next.email = 'Bitte eine gültige E-Mail-Adresse angeben.';
    if (form.password.length < 8) next.password = 'Mindestens 8 Zeichen.';
    if (form.confirm !== form.password) next.confirm = 'Die Passwörter stimmen nicht überein.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setError(null);
    if (!validate()) return;
    if (!accepted) {
      setError('Bitte akzeptiere die AGB und die Datenschutzerklärung.');
      return;
    }
    setLoading(true);
    try {
      const result = await backend.signUp({
        email: form.email,
        password: form.password,
        username: form.username,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      if (!result.signedIn) setConfirmationSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <Screen>
        <EmptyState
          icon="mail-unread-outline"
          title="Bitte bestätige deine E-Mail"
          text={`Wir haben dir einen Bestätigungslink an ${form.email} geschickt. Danach kannst du dich anmelden.`}>
          <Link href="/login" style={styles.link}>
            Zur Anmeldung
          </Link>
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title subtitle="Erstelle dein SwapUni Konto.">Konto erstellen</Title>
      <DemoBanner />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField placeholder="Vorname" autoComplete="given-name" value={form.firstName} onChangeText={set('firstName')} error={errors.firstName} />
        </View>
        <View style={styles.flex}>
          <TextField placeholder="Nachname" autoComplete="family-name" value={form.lastName} onChangeText={set('lastName')} error={errors.lastName} />
        </View>
      </View>
      <TextField
        placeholder="Benutzername"
        icon="at-outline"
        autoCapitalize="none"
        autoComplete="username"
        value={form.username}
        onChangeText={set('username')}
        error={errors.username}
      />
      <TextField
        placeholder="E-Mail"
        icon="mail-outline"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
      />
      <TextField placeholder="Passwort" icon="lock-closed-outline" secure autoComplete="new-password" value={form.password} onChangeText={set('password')} error={errors.password} />
      <TextField placeholder="Passwort bestätigen" icon="lock-closed-outline" secure autoComplete="new-password" value={form.confirm} onChangeText={set('confirm')} error={errors.confirm} />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        onPress={() => setAccepted((a) => !a)}
        style={styles.checkRow}>
        <Icon name={accepted ? 'checkbox' : 'square-outline'} size={22} color={accepted ? Colors.primary : Colors.textMuted} />
        <Text style={styles.checkText} onPress={() => setAccepted((a) => !a)}>
          Ich akzeptiere die{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>
            AGB
          </Text>{' '}
          und die{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
            Datenschutzerklärung
          </Text>
          .
        </Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
      <Button title="Konto erstellen" onPress={submit} loading={loading} />
      <Text style={styles.footer}>
        Bereits ein Konto?{' '}
        <Link href="/login" style={styles.link}>
          Anmelden
        </Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.md },
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  checkRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  checkText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  footer: { textAlign: 'center', color: Colors.textSecondary, fontSize: 14 },
});
