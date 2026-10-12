import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { displayName } from '@/components/match-card';
import { Avatar, Card, EmptyState, Title } from '@/components/ui';
import { Colors, Font, MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { formatTime } from '@/lib/format';

export default function MessagesScreen() {
  const { conversations, refreshConversations, session } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshConversations().catch(() => undefined);
    }, [refreshConversations]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await refreshConversations().catch(() => undefined);
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={<Title subtitle="Deine Chats mit passenden Tauschpartnern.">Nachrichten</Title>}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Noch keine Nachrichten"
            text="Öffne ein Match und tippe auf „Nachricht schreiben“, um Kontakt aufzunehmen."
          />
        }
        renderItem={({ item }) => {
          const name = item.participants.map(displayName).join(', ') || 'Unterhaltung';
          const fromMe = item.lastMessage?.senderId === session?.userId;
          return (
            <Card onPress={() => router.push(`/chat/${item.id}`)}>
              <View style={styles.row}>
                <Avatar name={name} seed={item.participants[0]?.id ?? item.id} />
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <Text style={[Font.subheading, styles.flex]} numberOfLines={1}>
                      {name}
                    </Text>
                    {item.lastMessage ? <Text style={Font.tiny}>{formatTime(item.lastMessage.createdAt)}</Text> : null}
                  </View>
                  <View style={styles.titleRow}>
                    <Text style={[Font.small, styles.flex, item.unreadCount > 0 && styles.unread]} numberOfLines={1}>
                      {item.lastMessage ? `${fromMe ? 'Du: ' : ''}${item.lastMessage.body}` : 'Noch keine Nachrichten'}
                    </Text>
                    {item.unreadCount > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  unread: { color: Colors.text, fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
