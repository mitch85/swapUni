import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Font, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { semesterLabel } from '@/lib/terms';
import type { Program, University } from '@/lib/types';

import { Button, Icon, OptionRow, TextField } from './ui';

export const PROGRAMS: { value: Program; label: string }[] = [
  { value: 'humanmedizin', label: 'Humanmedizin' },
  { value: 'zahnmedizin', label: 'Zahnmedizin' },
];

export const programLabel = (program: Program) => PROGRAMS.find((p) => p.value === program)?.label ?? program;

export const MAX_WISHES = 3;
export const MAX_SEMESTER = 12;

function ruleHint(uni: University): string | undefined {
  if (!uni.swapPossible) return 'Kein Studienplatztausch möglich';
  if (uni.maxSemester === 0) return 'Tausch nur vor Studienbeginn';
  if (uni.modelProgram) return 'Modellstudiengang';
  return undefined;
}

/** Searchable university list for single selection or ranked multi selection. */
export function UniversityList({
  universities,
  selected,
  onToggle,
  multi = false,
  exclude,
  max = MAX_WISHES,
}: {
  universities: University[];
  selected: string[];
  onToggle: (id: string) => void;
  multi?: boolean;
  exclude?: string;
  max?: number;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universities.filter(
      (u) => u.id !== exclude && (!q || u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q)),
    );
  }, [universities, query, exclude]);

  return (
    <View style={styles.list}>
      <TextField icon="search" placeholder="Universität suchen" value={query} onChangeText={setQuery} autoCorrect={false} />
      {multi ? (
        <Text style={Font.small}>
          {selected.length}/{max} gewählt · Reihenfolge = Priorität
        </Text>
      ) : null}
      {filtered.map((uni) => {
        const index = selected.indexOf(uni.id);
        const isSelected = index !== -1;
        return (
          <OptionRow
            key={uni.id}
            icon="business-outline"
            label={uni.name}
            description={ruleHint(uni) ?? uni.city}
            selected={isSelected}
            multi={multi}
            badge={multi && isSelected ? `${index + 1}` : undefined}
            disabled={(multi && !isSelected && selected.length >= max) || (!multi && !uni.swapPossible)}
            onPress={() => onToggle(uni.id)}
          />
        );
      })}
      {filtered.length === 0 ? <Text style={[Font.small, styles.center]}>Keine Universität gefunden.</Text> : null}
    </View>
  );
}

/** Full-screen modal wrapper around {@link UniversityList}. */
export function UniversityPickerModal({
  visible,
  title,
  onClose,
  ...listProps
}: Parameters<typeof UniversityList>[0] & { visible: boolean; title: string; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={Font.heading}>{title}</Text>
          <Pressable accessibilityLabel="Schließen" onPress={onClose} hitSlop={10}>
            <Icon name="close" size={26} />
          </Pressable>
        </View>
        <FlatList
          data={[0]}
          keyExtractor={String}
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          renderItem={() => <UniversityList {...listProps} />}
        />
        <View style={styles.modalFooter}>
          <Button title="Fertig" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function SemesterStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel="Semester verringern"
        disabled={value <= 0}
        onPress={() => onChange(Math.max(0, value - 1))}
        style={[styles.stepButton, value <= 0 && styles.disabled]}>
        <Icon name="remove" size={22} color={Colors.text} />
      </Pressable>
      <Text style={styles.stepValue} accessibilityLiveRegion="polite">
        {semesterLabel(value)}
      </Text>
      <Pressable
        accessibilityLabel="Semester erhöhen"
        disabled={value >= MAX_SEMESTER}
        onPress={() => onChange(Math.min(MAX_SEMESTER, value + 1))}
        style={[styles.stepButton, value >= MAX_SEMESTER && styles.disabled]}>
        <Icon name="add" size={22} color={Colors.text} />
      </Pressable>
    </View>
  );
}

/** Adds or removes a wish while keeping the priority order. */
export function toggleWish(wishes: string[], id: string): string[] {
  if (wishes.includes(id)) return wishes.filter((w) => w !== id);
  if (wishes.length >= MAX_WISHES) return wishes;
  return [...wishes, id];
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  center: { textAlign: 'center', paddingVertical: Spacing.lg },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  modalContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  modalFooter: { padding: Spacing.xl, paddingTop: Spacing.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 17, fontWeight: '600', color: Colors.text },
  disabled: { opacity: 0.4 },
});
