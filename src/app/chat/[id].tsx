import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { displayName } from '@/components/match-card';
import { Avatar, Icon } from '@/components/ui';
import { Colors, Font, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/lib/app-state';
import { backend } from '@/lib/backend';
import { formatTime } from '@/lib/format';
import type { Message } from '@/lib/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversations, session, refreshConversations } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<Message>>(null);

  const conversation = conversations.find((c) => c.id === id);
  const title = conversation?.participants.map(displayName).join(', ') || 'Chat';

  useEffect(() => {
    if (!id) return;
    let active = true;
    backend
      .listMessages(id)
      .then((initial) => active && setMessages(initial))
      .catch((e) => setError((e as Error).message));
    backend.markRead(id).then(refreshConversations).catch(() => undefined);
    if (!conversation) refreshConversations().catch(() => undefined);
    const unsubscribe = backend.subscribeMessages((message) => {
      if (message.conversationId !== id) return;
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      backend.markRead(id).catch(() => undefined);
    });
    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function send() {
    const body = text.trim();
    if (!body || !id) return;
    setSending(true);
    setError(null);
    try {
      await backend.sendMessage(id, body);
      setText('');
      // Realtime delivers the message; reload as a fallback for missed events.
      const latest = await backend.listMessages(id);
      setMessages(latest);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Zurück" onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} hitSlop={10}>
          <Icon name="arrow-back" size={24} />
        </Pressable>
        <Avatar name={title} seed={conversation?.participants[0]?.id ?? String(id)} size={36} />
        <Text style={[Font.subheading, styles.flex]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={[Font.small, styles.empty]}>
              Stell dich kurz vor und besprecht, wie ihr die Tauschanträge einreicht. Teile keine sensiblen Daten wie Passwörter.
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === session?.userId;
            const sender = conversation?.participants.find((p) => p.id === item.senderId);
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {!mine && (conversation?.participants.length ?? 0) > 1 && sender ? (
                  <Text style={styles.sender}>{displayName(sender)}</Text>
                ) : null}
                <Text style={[styles.body, mine && styles.mineText]}>{item.body}</Text>
                <Text style={[styles.time, mine && styles.mineTime]}>{formatTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Nachricht schreiben…"
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            onSubmitEditing={send}
            submitBehavior={Platform.OS === 'web' ? 'submit' : undefined}
          />
          <Pressable
            accessibilityLabel="Senden"
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.send, (!text.trim() || sending) && styles.disabled]}>
            <Icon name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  messages: { padding: Spacing.lg, gap: Spacing.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.xxl, paddingHorizontal: Spacing.xl },
  bubble: { maxWidth: '80%', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  sender: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  body: { fontSize: 15, color: Colors.text, lineHeight: 20 },
  mineText: { color: '#FFFFFF' },
  time: { fontSize: 11, color: Colors.textMuted, alignSelf: 'flex-end' },
  mineTime: { color: '#DBEAFE' },
  error: { color: Colors.danger, textAlign: 'center', padding: Spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
