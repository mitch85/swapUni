import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Font, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import type { Match } from '@/lib/matching';
import { semesterLabel } from '@/lib/terms';
import type { Offer, PublicProfile } from '@/lib/types';

import { Avatar, Badge, Button, Card, Icon } from './ui';

export const displayName = (p: PublicProfile) => `${p.firstName}${p.lastInitial ? ` ${p.lastInitial}.` : ''}`.trim() || p.username;

export const matchHref = (id: string) => `/match/${encodeURIComponent(id)}` as const;

export function CompatibilityBadge({ match }: { match: Match }) {
  if (match.compatibility === 'compatible') {
    return <Badge tone="success" icon="checkmark-circle" label="Voraussetzungen erfüllt" />;
  }
  if (match.compatibility === 'partial') {
    return <Badge tone="warning" icon="alert-circle" label="Teilweise kompatibel" />;
  }
  return <Badge tone="danger" icon="close-circle" label="Nicht kompatibel" />;
}

function FavoriteButton({ requestId }: { requestId: string }) {
  const { favorites, toggleFavorite } = useApp();
  const active = favorites.has(requestId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}
      onPress={() => toggleFavorite(requestId).catch(() => undefined)}
      hitSlop={8}
      style={styles.favorite}>
      <Icon name={active ? 'heart' : 'heart-outline'} size={20} color={active ? Colors.danger : Colors.primary} />
    </Pressable>
  );
}

function OfferSummary({ offer, compact }: { offer: Offer; compact?: boolean }) {
  const { universityById } = useApp();
  const from = universityById(offer.currentUniversityId);
  const to = offer.targetUniversityIds.map((id) => universityById(id)?.city ?? id);
  return (
    <View style={styles.summary}>
      <Avatar name={displayName(offer.profile)} seed={offer.userId} size={compact ? 40 : 52} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text style={Font.subheading}>{displayName(offer.profile)}</Text>
          {offer.profile.verified ? <Icon name="checkmark-circle" size={16} color={Colors.success} /> : null}
        </View>
        <Text style={Font.small}>
          {from?.city ?? offer.currentUniversityId} → {to.join(', ')}
        </Text>
        <Text style={Font.small}>
          {semesterLabel(offer.semester)} · {offer.desiredTerm}
        </Text>
      </View>
    </View>
  );
}

export function MatchCard({ match, compact = false }: { match: Match; compact?: boolean }) {
  const open = () => router.push(matchHref(match.id));
  if (match.kind === 'ring') {
    return (
      <Card onPress={open}>
        <View style={styles.ringHeader}>
          <Badge tone="info" icon="sync" label="Ringtausch mit 3 Personen" />
        </View>
        {match.partners.map((p) => (
          <OfferSummary key={p.id} offer={p} compact />
        ))}
        <CompatibilityBadge match={match} />
        {!compact ? <Button small variant="secondary" title="Details ansehen" onPress={open} /> : null}
      </Card>
    );
  }
  const partner = match.partners[0];
  return (
    <Card onPress={compact ? open : undefined}>
      <OfferSummary offer={partner} compact={compact} />
      <CompatibilityBadge match={match} />
      {!compact ? (
        <View style={styles.actions}>
          <Button small variant="secondary" title="Details ansehen" onPress={open} style={styles.flex} />
          <FavoriteButton requestId={partner.id} />
        </View>
      ) : null}
    </Card>
  );
}

export function OfferCard({ offer }: { offer: Offer }) {
  const open = () => router.push(matchHref(`o:${offer.id}`));
  return (
    <Card onPress={open}>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <OfferSummary offer={offer} compact />
        </View>
        <FavoriteButton requestId={offer.id} />
      </View>
      {offer.ringSwap ? <Badge tone="info" icon="sync" label="Offen für Ringtausch" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  favorite: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringHeader: { flexDirection: 'row' },
});
