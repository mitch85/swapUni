import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmAction } from '@/components/confirm';
import { CompatibilityBadge, displayName } from '@/components/match-card';
import { programLabel } from '@/components/request-fields';
import { Avatar, Badge, Button, Card, EmptyState, ErrorText, Icon, InfoRow, Screen, TextField } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { backend } from '@/lib/backend';
import { evaluateSwap, findMatchById, indexUniversities, type CheckStatus, type Match } from '@/lib/matching';
import { semesterLabel } from '@/lib/terms';
import type { Offer } from '@/lib/types';

const statusIcon: Record<CheckStatus, { name: 'checkmark-circle' | 'alert-circle' | 'close-circle'; color: string }> = {
  ok: { name: 'checkmark-circle', color: Colors.success },
  warn: { name: 'alert-circle', color: Colors.warning },
  fail: { name: 'close-circle', color: Colors.danger },
};

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = decodeURIComponent(id ?? '');
  const { myRequest, offers, universities, universityById, favorites, toggleFavorite, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reported, setReported] = useState(false);

  const match = resolveMatch();

  function resolveMatch(): Match | undefined {
    if (!myRequest) return undefined;
    if (matchId.startsWith('o:')) {
      const offer = offers.find((o) => o.id === matchId.slice(2));
      if (!offer) return undefined;
      const direct = findMatchById(`d:${offer.id}`, myRequest, offers, universities);
      if (direct) return direct;
      const checks = evaluateSwap([myRequest, offer], indexUniversities(universities), new Date());
      return { id: matchId, kind: 'direct', partners: [offer], checks, compatibility: 'incompatible', priority: 0 };
    }
    return findMatchById(matchId, myRequest, offers, universities);
  }

  if (!match || !myRequest) {
    return (
      <Screen>
        <BackBar />
        <EmptyState icon="help-circle-outline" title="Angebot nicht mehr verfügbar" text="Das Gesuch wurde vermutlich bereits erfolgreich vermittelt oder pausiert." />
      </Screen>
    );
  }

  const isMutual = !match.id.startsWith('o:');
  const partners = match.partners;
  const isFavorite = partners.length === 1 && favorites.has(partners[0].id);
  // In a ring I move to the first partner's university, otherwise to the partner's.
  const myNewUniversityId = partners[0].currentUniversityId;
  const myNewUni = universityById(myNewUniversityId);

  async function writeMessage() {
    setBusy(true);
    setError(null);
    try {
      const conversationId = await backend.startConversation(partners.map((p) => p.userId));
      router.push(`/chat/${conversationId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markSuccessful() {
    const ok = await confirmAction({
      title: 'Tausch erfolgreich?',
      message: `Dein Gesuch wird als erfolgreich vermittelt (Wechsel nach ${myNewUni?.name ?? myNewUniversityId}) markiert und aus dem Teilnehmerpool entfernt.`,
      confirmLabel: 'Abschließen',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await backend.completeSwap(myNewUniversityId);
      await refresh();
      setBusy(false);
      router.dismissTo('/(tabs)');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function sendReport() {
    if (!reportText.trim()) return;
    setBusy(true);
    try {
      await Promise.all(partners.map((p) => backend.reportUser(p.userId, reportText.trim())));
      setReported(true);
      setReporting(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackBar
        right={
          partners.length === 1 ? (
            <Pressable
              accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}
              onPress={() => toggleFavorite(partners[0].id)}
              hitSlop={10}>
              <Icon name={isFavorite ? 'heart' : 'heart-outline'} size={24} color={isFavorite ? Colors.danger : Colors.text} />
            </Pressable>
          ) : null
        }
      />

      {match.kind === 'ring' ? (
        <Card>
          <Badge tone="info" icon="sync" label="Ringtausch" />
          <RingStep from="Du" fromUni={universityById(myRequest.currentUniversityId)?.city} toUni={universityById(partners[0].currentUniversityId)?.city} />
          <RingStep from={displayName(partners[0].profile)} fromUni={universityById(partners[0].currentUniversityId)?.city} toUni={universityById(partners[1].currentUniversityId)?.city} />
          <RingStep from={displayName(partners[1].profile)} fromUni={universityById(partners[1].currentUniversityId)?.city} toUni={universityById(myRequest.currentUniversityId)?.city} />
        </Card>
      ) : null}

      {partners.map((partner) => (
        <PartnerCard key={partner.id} offer={partner} />
      ))}

      <Card>
        <Text style={Font.subheading}>Kompatibilität (Vorprüfung)</Text>
        {!isMutual ? (
          <Badge tone="neutral" icon="information-circle" label="Kein gegenseitiges Match – Wünsche passen nicht zusammen" />
        ) : (
          <CompatibilityBadge match={match} />
        )}
        {match.checks.map((check, i) => (
          <View key={`${check.label}-${i}`} style={styles.check}>
            <Icon name={statusIcon[check.status].name} size={18} color={statusIcon[check.status].color} />
            <View style={styles.flex}>
              <Text style={Font.body}>{check.label}</Text>
              {check.detail ? <Text style={Font.small}>{check.detail}</Text> : null}
            </View>
          </View>
        ))}
        <Text style={Font.tiny}>
          Automatische Vorprüfung anhand der hinterlegten Uni-Vorgaben. Verbindlich entscheiden die Studierendensekretariate.
        </Text>
      </Card>

      {myNewUni ? (
        <Card onPress={() => router.push(`/universities/${myNewUni.id}`)}>
          <View style={styles.row}>
            <Icon name="document-text-outline" size={22} color={Colors.primary} />
            <View style={styles.flex}>
              <Text style={Font.subheading}>Tauschformulare & Fristen</Text>
              <Text style={Font.small}>{myNewUni.name}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title={partners.length > 1 ? 'Gruppenchat starten' : 'Nachricht schreiben'} icon="chatbubble-outline" onPress={writeMessage} loading={busy} />
      {isMutual && myRequest.status === 'active' ? (
        <Button title="Tausch erfolgreich – Gesuch abschließen" variant="success" icon="trophy-outline" onPress={markSuccessful} disabled={busy} />
      ) : null}

      {reported ? (
        <Text style={[Font.small, styles.center]}>Danke! Wir prüfen deine Meldung.</Text>
      ) : reporting ? (
        <Card>
          <TextField label="Was ist passiert?" multiline value={reportText} onChangeText={setReportText} placeholder="Beschreibe kurz das Problem" />
          <View style={styles.row}>
            <Button small variant="secondary" title="Abbrechen" onPress={() => setReporting(false)} style={styles.flex} />
            <Button small variant="danger" title="Melden" onPress={sendReport} disabled={!reportText.trim()} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <Button title="Profil melden" variant="danger" icon="flag-outline" onPress={() => setReporting(true)} />
      )}
    </Screen>
  );
}

function BackBar({ right }: { right?: React.ReactNode }) {
  return (
    <View style={styles.backBar}>
      <Pressable accessibilityLabel="Zurück" onPress={() => (router.canGoBack() ? router.back() : router.replace('/swap'))} hitSlop={10}>
        <Icon name="arrow-back" size={24} />
      </Pressable>
      {right}
    </View>
  );
}

function RingStep({ from, fromUni, toUni }: { from: string; fromUni?: string; toUni?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[Font.body, styles.ringName]}>{from}</Text>
      <Text style={Font.small}>{fromUni}</Text>
      <Icon name="arrow-forward" size={16} color={Colors.primary} />
      <Text style={[Font.body, styles.bold]}>{toUni}</Text>
    </View>
  );
}

function PartnerCard({ offer }: { offer: Offer }) {
  const { universityById } = useApp();
  const from = universityById(offer.currentUniversityId);
  return (
    <Card>
      <View style={styles.row}>
        <Avatar name={displayName(offer.profile)} seed={offer.userId} size={72} />
        <View style={styles.flex}>
          <Text style={Font.heading}>{displayName(offer.profile)}</Text>
          <Text style={Font.small}>@{offer.profile.username}</Text>
          {offer.profile.verified ? (
            <Badge tone="success" icon="checkmark-circle" label="Verifiziert" />
          ) : (
            <Badge tone="neutral" label="Nicht verifiziert" />
          )}
        </View>
      </View>
      <View>
        <InfoRow label="Studiengang" value={programLabel(offer.program)} />
        <InfoRow label="Aktuelle Universität" value={from?.name ?? offer.currentUniversityId} />
        <InfoRow
          label="Wunschunis"
          value={offer.targetUniversityIds.map((id, i) => `${i + 1}. ${universityById(id)?.city ?? id}`).join('\n')}
        />
        <InfoRow label="Fachsemester" value={semesterLabel(offer.semester)} />
        <InfoRow label="Wechselzeitpunkt" value={offer.desiredTerm} />
        <InfoRow label="Studienplatz" value={offer.placeType === 'full' ? 'Vollstudienplatz' : 'Teilstudienplatz'} />
        <InfoRow label="Ringtausch erlaubt" value={offer.ringSwap ? 'Ja' : 'Nein'} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  check: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  center: { textAlign: 'center' },
  ringName: { fontWeight: '600', minWidth: 70 },
  bold: { fontWeight: '700' },
});
