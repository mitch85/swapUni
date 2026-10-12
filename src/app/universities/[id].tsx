import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Icon, InfoRow, Screen, TextField } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { backend } from '@/lib/backend';
import { swapRuleSummary } from '@/lib/format';

const ringLabel = { yes: 'Möglich', no: 'Nicht möglich', unknown: 'Unbekannt' } as const;

export default function UniversityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { universityById } = useApp();
  const uni = id ? universityById(id) : undefined;

  const back = (
    <Pressable accessibilityLabel="Zurück" onPress={() => (router.canGoBack() ? router.back() : router.replace('/universities'))} hitSlop={10}>
      <Icon name="arrow-back" size={24} />
    </Pressable>
  );

  if (!uni) {
    return (
      <Screen>
        {back}
        <EmptyState icon="business-outline" title="Universität nicht gefunden" />
      </Screen>
    );
  }

  const ring = uni.ringSwap === 'yes' && uni.ringSwapMax ? `Möglich (max. ${uni.ringSwapMax} Personen)` : ringLabel[uni.ringSwap];

  return (
    <Screen>
      {back}
      <View style={styles.titleRow}>
        <View style={styles.icon}>
          <Icon name="business" size={28} color={Colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={Font.title}>{uni.name}</Text>
          <Text style={Font.small}>{uni.city}</Text>
        </View>
      </View>

      <Card>
        <Text style={Font.subheading}>Voraussetzungen</Text>
        <View>
          <InfoRow label="Studienplatztausch" value={uni.swapPossible ? 'Möglich' : 'Nicht möglich'} />
          <InfoRow label="Tausch möglich" value={swapRuleSummary(uni)} />
          <InfoRow label="Ringtausch" value={ring} />
          <InfoRow label="Studiengang" value={uni.modelProgram ? 'Modellstudiengang' : 'Regelstudiengang'} />
          {!uni.swapWithModel ? <InfoRow label="Tausch mit Modellstudiengang" value="Nicht möglich" /> : null}
          {!uni.swapWithRegular ? <InfoRow label="Tausch mit Regelstudiengang" value="Nicht möglich" /> : null}
          {uni.regularSwapMinSemester ? (
            <InfoRow label="Tausch mit Regelstudiengang" value={`ab ${uni.regularSwapMinSemester}. Semester`} />
          ) : null}
          {uni.requiresDeanApproval ? <InfoRow label="Dekanatsgenehmigung" value="Erforderlich" /> : null}
          {uni.excludesLawsuitPlaces ? <InfoRow label="Klageplätze" value="Vom Tausch ausgeschlossen" /> : null}
          {uni.allowedTerms !== 'both' ? (
            <InfoRow label="Wechsel nur zum" value={uni.allowedTerms === 'WiSe' ? 'Wintersemester' : 'Sommersemester'} />
          ) : null}
          {uni.lastSwapTerm ? <InfoRow label="Tausch möglich bis" value={uni.lastSwapTerm} /> : null}
          {uni.achievementNote ? <InfoRow label="Leistungsstand" value={uni.achievementNote} /> : null}
        </View>
        {uni.notes.map((note) => (
          <View key={note} style={styles.note}>
            <Icon name="information-circle" size={18} color={Colors.primary} />
            <Text style={[Font.small, styles.flex]}>{note}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={Font.subheading}>Antragsfristen</Text>
        <InfoRow
          label="Sommersemester"
          value={uni.allowedTerms === 'WiSe' ? 'Kein Tausch zum SoSe' : (uni.deadlineSoSe ?? 'Keine Angabe')}
        />
        <InfoRow
          label="Wintersemester"
          value={uni.allowedTerms === 'SoSe' ? 'Kein Tausch zum WiSe' : (uni.deadlineWiSe ?? 'Keine Angabe')}
        />
      </Card>

      <Card>
        <Text style={Font.subheading}>Formulare & Kontakt</Text>
        {uni.forms.map((form) => (
          <LinkRow key={form.url} icon="document-text-outline" label={form.label} onPress={() => Linking.openURL(form.url)} />
        ))}
        {uni.website ? <LinkRow icon="globe-outline" label="Infoseite zum Studienplatztausch" onPress={() => Linking.openURL(uni.website!)} /> : null}
        {uni.contactEmail ? <LinkRow icon="mail-outline" label={uni.contactEmail} onPress={() => Linking.openURL(`mailto:${uni.contactEmail}`)} /> : null}
        {uni.contactPhone ? <LinkRow icon="call-outline" label={uni.contactPhone} onPress={() => Linking.openURL(`tel:${uni.contactPhone}`)} /> : null}
        {!uni.forms.length && !uni.website && !uni.contactEmail && !uni.contactPhone ? (
          <Text style={Font.small}>Noch keine Kontaktdaten hinterlegt. Bitte wende dich an das Studierendensekretariat.</Text>
        ) : null}
      </Card>

      <View style={styles.footer}>
        <Badge tone="neutral" icon="time-outline" label={uni.updatedAt ? `Stand ${new Date(uni.updatedAt).toLocaleDateString('de-DE')}` : 'Stand: Übersichtsplan'} />
        <Text style={Font.tiny}>Angaben ohne Gewähr – bitte vor dem Antrag bei der Universität prüfen.</Text>
      </View>
      <ReportIssue universityId={uni.id} />
    </Screen>
  );
}

function ReportIssue({ universityId }: { universityId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function send() {
    setState('sending');
    try {
      await backend.reportUniversityIssue(universityId, text.trim());
      setState('sent');
      setOpen(false);
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') return <Text style={[Font.small, styles.center]}>Danke! Wir prüfen die Angaben.</Text>;
  if (!open) {
    return <Button variant="ghost" icon="flag-outline" title="Angabe falsch oder veraltet?" onPress={() => setOpen(true)} />;
  }
  return (
    <Card>
      <TextField
        label="Was stimmt nicht?"
        multiline
        value={text}
        onChangeText={setText}
        placeholder="z. B. neue Frist, anderer Link, Tausch nicht mehr möglich"
      />
      {state === 'error' ? <Text style={styles.error}>Senden fehlgeschlagen. Bitte später erneut versuchen.</Text> : null}
      <View style={styles.row}>
        <Button small variant="secondary" title="Abbrechen" onPress={() => setOpen(false)} style={styles.flex} />
        <Button small title="Senden" onPress={send} disabled={!text.trim()} loading={state === 'sending'} style={styles.flex} />
      </View>
    </Card>
  );
}

function LinkRow({ icon, label, onPress }: { icon: 'document-text-outline' | 'globe-outline' | 'mail-outline' | 'call-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Icon name={icon} size={20} color={Colors.primary} />
      <Text style={[styles.linkText, styles.flex]}>{label}</Text>
      <Icon name="open-outline" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 8 },
  linkText: { color: Colors.primary, fontWeight: '500', fontSize: 15 },
  pressed: { opacity: 0.6 },
  footer: { gap: Spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', gap: Spacing.md },
  center: { textAlign: 'center' },
  error: { color: Colors.danger, fontSize: 13 },
});
