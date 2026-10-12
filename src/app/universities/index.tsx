import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Card, Icon, TextField, Title } from '@/components/ui';
import { Colors, Font, MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { swapRuleSummary } from '@/lib/format';

export default function UniversitiesScreen() {
  const { universities } = useApp();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universities.filter((u) => !q || u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q));
  }, [universities, query]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable accessibilityLabel="Zurück" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10}>
              <Icon name="arrow-back" size={24} />
            </Pressable>
            <Title subtitle="Voraussetzungen, Fristen, Formulare und Kontakte der medizinischen Fakultäten.">Universitäten</Title>
            <TextField icon="search" placeholder="Universität oder Stadt suchen" value={query} onChangeText={setQuery} />
          </View>
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/universities/${item.id}`)}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={Font.subheading}>{item.name}</Text>
                <Text style={Font.small}>{swapRuleSummary(item)}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
            <View style={styles.badges}>
              {item.swapPossible ? null : <Badge tone="danger" label="Tausch nicht möglich" />}
              {item.ringSwap === 'yes' ? <Badge tone="success" label="Ringtausch" /> : null}
              {item.ringSwap === 'no' ? <Badge tone="neutral" label="Kein Ringtausch" /> : null}
              {item.modelProgram ? <Badge tone="info" label="Modellstudiengang" /> : null}
              {item.requiresDeanApproval ? <Badge tone="warning" label="Dekanat" /> : null}
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.lg, marginBottom: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
