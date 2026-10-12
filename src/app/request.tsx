import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MAX_WISHES,
  PROGRAMS,
  SemesterStepper,
  UniversityPickerModal,
  toggleWish,
} from '@/components/request-fields';
import { Button, Card, ErrorText, Icon, OptionRow, Screen, SegmentedControl, Title, ToggleRow } from '@/components/ui';
import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { backend } from '@/lib/backend';
import { upcomingTerms } from '@/lib/terms';
import type { SwapRequestInput } from '@/lib/types';

export default function RequestScreen() {
  const { myRequest, universities, universityById, refresh } = useApp();
  const [form, setForm] = useState<SwapRequestInput>(() => ({
    program: myRequest?.program ?? 'humanmedizin',
    currentUniversityId: myRequest?.currentUniversityId ?? '',
    targetUniversityIds: myRequest?.targetUniversityIds ?? [],
    semester: myRequest?.semester ?? 1,
    placeType: myRequest?.placeType ?? 'full',
    lawsuitPlace: myRequest?.lawsuitPlace ?? false,
    admissionConfirmed: myRequest?.admissionConfirmed ?? false,
    desiredTerm: myRequest?.desiredTerm ?? upcomingTerms(new Date())[0],
    ringSwap: myRequest?.ringSwap ?? true,
  }));
  const [picker, setPicker] = useState<'current' | 'wishes' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terms = useMemo(() => {
    const list = upcomingTerms(new Date());
    return list.includes(form.desiredTerm) ? list : [form.desiredTerm, ...list];
  }, [form.desiredTerm]);

  const update = (patch: Partial<SwapRequestInput>) => setForm((f) => ({ ...f, ...patch }));
  const valid =
    !!form.currentUniversityId &&
    form.targetUniversityIds.length > 0 &&
    (form.semester > 0 || form.admissionConfirmed);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await backend.saveMyRequest({ ...form, admissionConfirmed: form.semester > 0 || form.admissionConfirmed });
      await refresh();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Screen
      edges={['top', 'left', 'right']}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button
            title={myRequest?.status === 'completed' ? 'Neues Gesuch veröffentlichen' : 'Gesuch veröffentlichen'}
            onPress={save}
            disabled={!valid}
            loading={saving}
          />
        </>
      }>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Schließen" onPress={() => router.back()} hitSlop={10}>
          <Icon name="close" size={26} />
        </Pressable>
      </View>
      <Title subtitle="Erstelle oder ändere dein Gesuch in wenigen Schritten.">Tauschgesuch</Title>

      <Card>
        <Field label="Aktuelle Universität" onPress={() => setPicker('current')}>
          <Text style={Font.subheading}>{universityById(form.currentUniversityId)?.name ?? 'Auswählen'}</Text>
        </Field>
      </Card>

      <Card>
        <Field label={`Wunschuniversitäten (max. ${MAX_WISHES}, nach Priorität)`} onPress={() => setPicker('wishes')}>
          <View style={styles.chips}>
            {form.targetUniversityIds.length === 0 ? <Text style={Font.small}>Auswählen</Text> : null}
            {form.targetUniversityIds.map((id, index) => (
              <Pressable
                key={id}
                accessibilityLabel={`${universityById(id)?.name ?? id} entfernen`}
                onPress={() => update({ targetUniversityIds: form.targetUniversityIds.filter((w) => w !== id) })}
                style={styles.chip}>
                <Text style={styles.chipText}>
                  {index + 1}. {universityById(id)?.city ?? id}
                </Text>
                <Icon name="close" size={14} color={Colors.primary} />
              </Pressable>
            ))}
          </View>
        </Field>
      </Card>

      <Card>
        <Text style={Font.small}>Studiengang</Text>
        <SegmentedControl value={form.program} onChange={(program) => update({ program })} options={PROGRAMS} />
      </Card>

      <Card>
        <Text style={Font.small}>Fachsemester</Text>
        <SemesterStepper value={form.semester} onChange={(semester) => update({ semester })} />
        {form.semester === 0 ? (
          <OptionRow
            multi
            label="Mein Studienplatz ist bestätigt"
            description="Zulassungsbescheid liegt vor"
            selected={form.admissionConfirmed}
            onPress={() => update({ admissionConfirmed: !form.admissionConfirmed })}
          />
        ) : null}
        <SegmentedControl
          value={form.placeType}
          onChange={(placeType) => update({ placeType })}
          options={[
            { value: 'full', label: 'Vollstudienplatz' },
            { value: 'partial', label: 'Teilstudienplatz' },
          ]}
        />
        <ToggleRow label="Studienplatz über Klage erhalten" value={form.lawsuitPlace} onChange={(lawsuitPlace) => update({ lawsuitPlace })} />
      </Card>

      <Card>
        <Text style={Font.small}>Gewünschter Wechselzeitpunkt</Text>
        {terms.map((term) => (
          <OptionRow key={term} label={term} selected={form.desiredTerm === term} onPress={() => update({ desiredTerm: term })} />
        ))}
      </Card>

      <Card>
        <ToggleRow
          label="Ringtausch erlauben"
          description="Tausch zu dritt, wenn kein direkter Partner existiert"
          value={form.ringSwap}
          onChange={(ringSwap) => update({ ringSwap })}
        />
      </Card>

      <UniversityPickerModal
        visible={picker === 'current'}
        title="Aktuelle Universität"
        universities={universities}
        selected={form.currentUniversityId ? [form.currentUniversityId] : []}
        onToggle={(id) => {
          update({ currentUniversityId: id, targetUniversityIds: form.targetUniversityIds.filter((w) => w !== id) });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <UniversityPickerModal
        visible={picker === 'wishes'}
        title="Wunschuniversitäten"
        multi
        universities={universities}
        exclude={form.currentUniversityId}
        selected={form.targetUniversityIds}
        onToggle={(id) => update({ targetUniversityIds: toggleWish(form.targetUniversityIds, id) })}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

function Field({ label, children, onPress }: { label: string; children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.field}>
      <View style={styles.flex}>
        <Text style={Font.small}>{label}</Text>
        {children}
      </View>
      <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
});
