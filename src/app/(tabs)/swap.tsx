import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchCard, OfferCard } from '@/components/match-card';
import { EmptyState, SegmentedControl, TextField, Title } from '@/components/ui';
import { Colors, Font, MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';

type View_ = 'matches' | 'offers' | 'favorites';

export default function SwapScreen() {
  const { matches, offers, favorites, myRequest, universityById, refresh, session } = useApp();
  const [view, setView] = useState<View_>('matches');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const otherOffers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offers.filter((o) => {
      if (o.userId === session?.userId) return false;
      if (myRequest && o.program !== myRequest.program) return false;
      if (!q) return true;
      const unis = [o.currentUniversityId, ...o.targetUniversityIds].map((id) => universityById(id));
      return unis.some((u) => u && (u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q)));
    });
  }, [offers, query, myRequest, session, universityById]);

  const favoriteOffers = useMemo(() => offers.filter((o) => favorites.has(o.id)), [offers, favorites]);

  async function onRefresh() {
    setRefreshing(true);
    await refresh().catch(() => undefined);
    setRefreshing(false);
  }

  const header = (
    <View style={styles.header}>
      <Title subtitle="Hier sind passende Tauschpartner für dich.">Deine Matches</Title>
      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'matches', label: `Matches (${matches.length})` },
          { value: 'offers', label: 'Alle Angebote' },
          { value: 'favorites', label: 'Favoriten' },
        ]}
      />
      {view === 'offers' ? (
        <>
          <TextField icon="search" placeholder="Nach Universität oder Stadt filtern" value={query} onChangeText={setQuery} />
          <Text style={Font.small}>{otherOffers.length} aktive Tauschgesuche</Text>
        </>
      ) : null}
    </View>
  );

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {view === 'matches' ? (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          refreshControl={refreshControl}
          renderItem={({ item }) => <MatchCard match={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={myRequest?.status === 'active' ? 'Noch keine Matches' : 'Dein Gesuch ist nicht aktiv'}
              text={
                myRequest?.status === 'active'
                  ? 'Sobald jemand von deiner Wunschuni an deine Uni möchte, erscheint er hier. Schau dir solange alle Angebote an.'
                  : 'Aktiviere dein Gesuch auf der Startseite, um Matches zu sehen.'
              }
            />
          }
        />
      ) : (
        <FlatList
          data={view === 'offers' ? otherOffers : favoriteOffers}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          refreshControl={refreshControl}
          renderItem={({ item }) => <OfferCard offer={item} />}
          ListEmptyComponent={
            view === 'favorites' ? (
              <EmptyState icon="heart-outline" title="Keine Favoriten" text="Markiere interessante Angebote mit dem Herz." />
            ) : (
              <EmptyState icon="search" title="Keine Angebote gefunden" />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.md, marginBottom: Spacing.xs },
});
