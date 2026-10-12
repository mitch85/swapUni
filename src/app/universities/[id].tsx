import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Icon, InfoRow, Screen } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
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
          <InfoRow label="Semester müssen exakt passen" value={uni.requiresExactSemester ? 'Ja' : 'Ab der Klinik'} />
          {uni.requiresDeanApproval ? <InfoRow label="Dekanatsgenehmigung" value="Erforderlich" /> : null}
          {uni.excludesLawsuitPlaces ? <InfoRow label="Klageplätze" value="Vom Tausch ausgeschlossen" /> : null}
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
        <InfoRow label="Sommersemester" value={uni.deadlineSoSe ?? 'Keine Angabe'} />
        <InfoRow label="Wintersemester" value={uni.deadlineWiSe ?? 'Keine Angabe'} />
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
    </Screen>
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
});
