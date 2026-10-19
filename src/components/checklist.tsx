import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Font, Radius, Spacing } from '@/constants/theme';
import type { PublicProfile } from '@/lib/types';

import { displayName } from './match-card';
import { Icon } from './ui';

export const CHECKLIST_STEPS = [
  { key: 'forms', label: 'Tauschformulare beider Unis besorgt' },
  { key: 'signed', label: 'Anträge ausgefüllt und unterschrieben' },
  { key: 'submitted', label: 'Anträge fristgerecht eingereicht' },
  { key: 'approved', label: 'Genehmigung beider Unis erhalten' },
  { key: 'enrolled', label: 'An der neuen Uni eingeschrieben' },
] as const;

/**
 * Shared swap checklist in a chat: everyone ticks their own steps and sees the partners'
 * progress. Purely informational – the app does not verify anything.
 */
export function SwapChecklist({
  checklist,
  myId,
  partners,
  onToggle,
}: {
  checklist: Record<string, string[]>;
  myId: string;
  partners: PublicProfile[];
  onToggle: (step: string, done: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const mine = new Set(checklist[myId] ?? []);
  const doneCount = CHECKLIST_STEPS.filter((s) => mine.has(s.key)).length;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.header}>
        <Icon name="list-outline" size={18} color={Colors.primary} />
        <Text style={[Font.subheading, styles.flex]}>Tausch-Checkliste</Text>
        <Text style={Font.small}>
          {doneCount}/{CHECKLIST_STEPS.length}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <>
          {CHECKLIST_STEPS.map((step) => {
            const done = mine.has(step.key);
            const partnersDone = partners.filter((p) => checklist[p.id]?.includes(step.key));
            return (
              <Pressable
                key={step.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                onPress={() => onToggle(step.key, !done)}
                style={styles.step}>
                <Icon name={done ? 'checkbox' : 'square-outline'} size={22} color={done ? Colors.success : Colors.textMuted} />
                <View style={styles.flex}>
                  <Text style={[Font.body, done && styles.done]}>{step.label}</Text>
                  {partners.length ? (
                    <Text style={Font.tiny}>
                      {partners
                        .map((p) => `${displayName(p)}: ${partnersDone.includes(p) ? 'erledigt' : 'offen'}`)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          <Text style={Font.tiny}>
            Die Checkliste dient nur eurer Übersicht. SwapUni prüft die Angaben nicht – für Anträge und Fristen seid ihr
            selbst verantwortlich.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 4 },
  done: { color: Colors.textSecondary },
});
