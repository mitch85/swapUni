import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmAction } from '@/components/confirm';
import { DemoBanner } from '@/components/demo-banner';
import { displayName } from '@/components/match-card';
import { Avatar, Badge, Button, Card, ErrorText, Icon, Screen, TextField, ToggleRow, type IconName } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { Colors, Font, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { backend } from '@/lib/backend';
import type { VerificationStatus } from '@/lib/types';

const verificationInfo: Record<VerificationStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; text: string }> = {
  none: {
    label: 'Nicht verifiziert',
    tone: 'neutral',
    text: 'Lade deine Studienbescheinigung oder deinen Zulassungsbescheid hoch. Verifizierte Profile wirken vertrauenswürdiger.',
  },
  pending: { label: 'Wird geprüft', tone: 'warning', text: 'Dein Nachweis wird geprüft. Das kann bis zu zwei Werktage dauern.' },
  verified: { label: 'Verifiziert', tone: 'success', text: 'Dein Studienplatz ist bestätigt.' },
  rejected: { label: 'Abgelehnt', tone: 'danger', text: 'Dein Nachweis konnte nicht bestätigt werden. Bitte lade ein aktuelles Dokument hoch.' },
};

export default function ProfileScreen() {
  const { profile, myRequest, refresh, refreshProfile } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!profile) return null;
  const verification = verificationInfo[profile.verificationStatus];

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const upload = () =>
    run('upload', async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Die Datei ist größer als 10 MB.');
      await backend.uploadVerification({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
        file: asset.file,
      });
      await refreshProfile();
    });

  const saveProfile = () =>
    run('profile', async () => {
      if (!/^[A-Za-z0-9_.-]{3,24}$/.test(form.username)) throw new Error('Benutzername: 3–24 Zeichen, Buchstaben, Zahlen, _ . -');
      await backend.updateProfile({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), username: form.username });
      await refreshProfile();
      setEditing(false);
    });

  const togglePause = () =>
    run('pause', async () => {
      await backend.setRequestStatus(myRequest?.status === 'paused' ? 'active' : 'paused');
      await refresh();
    });

  const deleteAccount = async () => {
    const ok = await confirmAction({
      title: 'Konto löschen?',
      message: 'Dein Profil, dein Tauschgesuch, deine Chats und hochgeladenen Nachweise werden endgültig gelöscht.',
      confirmLabel: 'Endgültig löschen',
      destructive: true,
    });
    if (ok) await run('delete', () => backend.deleteAccount());
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar name={`${profile.firstName} ${profile.lastName}`} seed={profile.id} size={72} />
        <View style={styles.flex}>
          <Text style={Font.heading}>{displayName({ ...profile, lastInitial: profile.lastName.slice(0, 1), verified: false })}</Text>
          <Text style={Font.small}>@{profile.username}</Text>
          {profile.email ? <Text style={Font.small}>{profile.email}</Text> : null}
        </View>
      </View>
      <DemoBanner />
      <ErrorText>{error}</ErrorText>

      {editing ? (
        <Card>
          <Text style={Font.subheading}>Profil bearbeiten</Text>
          <TextField label="Vorname" value={form.firstName} onChangeText={(firstName) => setForm((f) => ({ ...f, firstName }))} />
          <TextField label="Nachname" value={form.lastName} onChangeText={(lastName) => setForm((f) => ({ ...f, lastName }))} />
          <TextField label="Benutzername" autoCapitalize="none" value={form.username} onChangeText={(username) => setForm((f) => ({ ...f, username }))} />
          <Text style={Font.tiny}>Andere sehen nur deinen Vornamen, den ersten Buchstaben deines Nachnamens und deinen Benutzernamen.</Text>
          <View style={styles.row}>
            <Button small variant="secondary" title="Abbrechen" onPress={() => setEditing(false)} style={styles.flex} />
            <Button small title="Speichern" onPress={saveProfile} loading={busy === 'profile'} style={styles.flex} />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.rowBetween}>
          <Text style={Font.subheading}>Studienbescheinigung</Text>
          <Badge tone={verification.tone} label={verification.label} />
        </View>
        <Text style={Font.small}>{verification.text}</Text>
        {profile.verificationStatus !== 'verified' ? (
          <Button
            small
            variant="secondary"
            icon="cloud-upload-outline"
            title={profile.verificationStatus === 'pending' ? 'Anderes Dokument hochladen' : 'Nachweis hochladen'}
            onPress={upload}
            loading={busy === 'upload'}
          />
        ) : null}
        <Text style={Font.tiny}>PDF oder Foto, max. 10 MB. Nur für die Prüfung sichtbar, verschlüsselt gespeichert.</Text>
      </Card>

      <Card>
        <Text style={Font.subheading}>Benachrichtigungen</Text>
        <ToggleRow
          label="Push-Benachrichtigungen"
          description="Bei neuen passenden Tauschpartnern und Chat-Nachrichten"
          value={profile.pushEnabled}
          onChange={(pushEnabled) =>
            run('push', async () => {
              await backend.updateProfile({ pushEnabled });
              await refreshProfile();
            })
          }
        />
        {Platform.OS === 'web' ? <Text style={Font.tiny}>Push-Nachrichten werden in der iOS- und Android-App zugestellt.</Text> : null}
      </Card>

      <Card style={styles.menu}>
        <MenuItem icon="create-outline" label="Tauschgesuch bearbeiten" onPress={() => router.push('/request')} />
        {myRequest && myRequest.status !== 'completed' ? (
          <MenuItem
            icon={myRequest.status === 'paused' ? 'play-circle-outline' : 'pause-circle-outline'}
            label={myRequest.status === 'paused' ? 'Gesuch wieder aktivieren' : 'Gesuch pausieren'}
            onPress={togglePause}
          />
        ) : null}
        <MenuItem
          icon="person-outline"
          label="Profil bearbeiten"
          onPress={() => {
            setForm({ firstName: profile.firstName, lastName: profile.lastName, username: profile.username });
            setEditing(true);
          }}
        />
        <MenuItem icon="library-outline" label="Universitäten & Voraussetzungen" onPress={() => router.push('/universities')} />
        <MenuItem icon="shield-checkmark-outline" label="Datenschutzerklärung" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <MenuItem icon="document-text-outline" label="AGB" onPress={() => Linking.openURL(TERMS_URL)} last />
      </Card>

      <Button title="Abmelden" variant="secondary" icon="log-out-outline" onPress={() => backend.signOut()} />
      <Button title="Konto löschen" variant="danger" icon="trash-outline" onPress={deleteAccount} loading={busy === 'delete'} />
      <Text style={[Font.tiny, styles.center]}>
        Deine Daten werden verschlüsselt gespeichert und nicht an Dritte weitergegeben.
      </Text>
    </Screen>
  );
}

function MenuItem({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, !last && styles.menuBorder, pressed && styles.pressed]}>
      <Icon name={icon} size={20} color={Colors.primary} />
      <Text style={[Font.body, styles.flex]}>{label}</Text>
      <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  row: { flexDirection: 'row', gap: Spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { textAlign: 'center' },
  menu: { paddingVertical: Spacing.xs, gap: 0 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 14 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  pressed: { opacity: 0.6 },
});
