import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchCard } from '@/components/match-card';
import { programLabel } from '@/components/request-fields';
import { Badge, Button, Card, EmptyState, Icon, SectionHeader } from '@/components/ui';
import { Colors, Font, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { backend } from '@/lib/backend';
import { semesterLabel } from '@/lib/terms';

export default function HomeScreen() {
  const { profile, myRequest, matches, universityById, refresh, swapCount, setMyRequest } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await refresh().catch(() => undefined);
    setRefreshing(false);
  }

  async function reactivate() {
    await backend.setRequestStatus('active');
    await refresh();
  }

  if (!myRequest) return null;
  const from = universityById(myRequest.currentUniversityId);
  const wishes = myRequest.targetUniversityIds.map((id) => universityById(id));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={Font.title}>Hallo {profile?.firstName || profile?.username} 👋</Text>
            <Text style={Font.small}>Willkommen zurück.</Text>
          </View>
          <Pressable
            accessibilityLabel={`${matches.length} Matches anzeigen`}
            onPress={() => router.push('/swap')}
            style={styles.bell}>
            <Icon name="notifications-outline" size={24} color={Colors.text} />
            {matches.length ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{matches.length}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Card>
          <View style={styles.cardTitleRow}>
            <Text style={Font.subheading}>Dein Studienplatzwechsel</Text>
            <Pressable accessibilityLabel="Gesuch bearbeiten" onPress={() => router.push('/request')} hitSlop={8}>
              <Icon name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.route}>
            <View style={styles.uni}>
              <Icon name="business" size={22} color={Colors.primary} />
              <Text style={styles.uniName} numberOfLines={2}>
                {from?.city ?? myRequest.currentUniversityId}
              </Text>
            </View>
            <Icon name="arrow-forward" size={20} color={Colors.primary} />
            <View style={styles.uni}>
              <Icon name="business" size={22} color={Colors.success} />
              <Text style={styles.uniName} numberOfLines={2}>
                {wishes.map((w, i) => w?.city ?? myRequest.targetUniversityIds[i]).join(', ')}
              </Text>
            </View>
          </View>
          <Text style={[Font.small, styles.centerText]}>
            {programLabel(myRequest.program)} · {semesterLabel(myRequest.semester)} · {myRequest.desiredTerm}
          </Text>
          {myRequest.status === 'active' ? (
            <Badge tone="warning" icon="ellipse" label="Tauschpartner wird gesucht" />
          ) : myRequest.status === 'paused' ? (
            <Badge tone="neutral" icon="pause-circle" label="Gesuch pausiert – du bist nicht sichtbar" />
          ) : (
            <Badge tone="success" icon="trophy" label="Tausch erfolgreich – aus dem Pool entfernt" />
          )}
          {myRequest.status === 'completed' ? (
            <Button
              small
              title="Neues Gesuch erstellen"
              onPress={() => {
                setMyRequest(null);
              }}
            />
          ) : myRequest.status === 'paused' ? (
            <Button small title="Gesuch wieder aktivieren" onPress={reactivate} />
          ) : (
            <Button small variant="secondary" title="Gesuch bearbeiten" onPress={() => router.push('/request')} />
          )}
        </Card>

        {myRequest.status === 'active' ? (
          <View style={styles.section}>
            <SectionHeader title="Neue Matches" action={matches.length ? 'Alle anzeigen' : undefined} onAction={() => router.push('/swap')} />
            {matches.length === 0 ? (
              <Card>
                <EmptyState
                  icon="search"
                  title="Noch kein passender Tauschpartner"
                  text="Wir benachrichtigen dich, sobald sich jemand registriert, der zu deinem Gesuch passt."
                />
              </Card>
            ) : (
              matches.slice(0, 3).map((m) => <MatchCard key={m.id} match={m} compact />)
            )}
          </View>
        ) : null}

        <Card onPress={() => router.push('/universities')}>
          <View style={styles.linkRow}>
            <View style={styles.linkIcon}>
              <Icon name="library-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={Font.subheading}>Universitäten & Voraussetzungen</Text>
              <Text style={Font.small}>Fristen, Tauschformulare und Kontakte der Studienbüros</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>
        </Card>

        {swapCount > 0 ? (
          <View style={styles.stat}>
            <Icon name="people" size={18} color={Colors.success} />
            <Text style={Font.small}>
              Bereits <Text style={styles.statNumber}>{swapCount}</Text> erfolgreiche Tausche über SwapUni
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center' },
  bell: { padding: 8 },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  route: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: Spacing.sm },
  uni: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  uniName: { fontSize: 16, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  centerText: { textAlign: 'center' },
  section: { gap: Spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  statNumber: { color: Colors.success, fontWeight: '700' },
});
