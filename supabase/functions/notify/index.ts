// Sends Expo push notifications. Triggered by two Database Webhooks (see README):
//   * INSERT on public.messages        -> notify the other chat participants
//   * INSERT/UPDATE on public.swap_requests -> notify users whose request now matches
import { createClient } from 'npm:@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const WEBHOOK_SECRET = Deno.env.get('NOTIFY_WEBHOOK_SECRET');

async function tokensFor(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .in('id', userIds)
    .eq('push_enabled', true);
  const enabled = (profiles ?? []).map((p) => p.id);
  if (!enabled.length) return [];
  const { data } = await supabase.from('push_tokens').select('token').in('user_id', enabled);
  return (data ?? []).map((t) => t.token);
}

async function send(userIds: string[], title: string, body: string, data: Record<string, unknown>) {
  const tokens = await tokensFor(userIds);
  if (!tokens.length) return 0;
  const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default' }));
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await response.json();
  // Remove tokens of uninstalled apps.
  const tickets: { status: string; details?: { error?: string } }[] = result.data ?? [];
  const stale = tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
  if (stale.length) await supabase.from('push_tokens').delete().in('token', stale);
  return tokens.length;
}

async function onMessage(record: Record<string, unknown>) {
  const { data: conversation } = await supabase
    .from('conversations')
    .select('participant_ids')
    .eq('id', record.conversation_id)
    .single();
  const { data: sender } = await supabase.from('profiles').select('first_name, username').eq('id', record.sender_id).single();
  const recipients = (conversation?.participant_ids ?? []).filter((id: string) => id !== record.sender_id);
  const body = String(record.body ?? '');
  return send(
    recipients,
    `Neue Nachricht von ${sender?.first_name || sender?.username || 'SwapUni'}`,
    body.length > 120 ? `${body.slice(0, 117)}…` : body,
    { url: `/chat/${record.conversation_id}` },
  );
}

async function onRequest(payload: WebhookPayload) {
  const record = payload.record!;
  if (record.status !== 'active') return 0;
  const old = payload.old_record;
  // Only notify when something relevant for matching changed.
  if (
    payload.type === 'UPDATE' && old && old.status === 'active' &&
    ['current_university_id', 'target_university_ids', 'desired_term', 'program'].every(
      (key) => JSON.stringify(old[key]) === JSON.stringify(record[key]),
    )
  ) {
    return 0;
  }
  const { data } = await supabase.rpc('direct_counterparts', { request_id: record.id });
  const userIds = ((data ?? []) as (string | { direct_counterparts: string })[]).map((row) =>
    typeof row === 'string' ? row : row.direct_counterparts,
  );
  return send(
    userIds,
    'Neuer Tauschpartner gefunden 🎉',
    'Jemand passt zu deinem Tauschgesuch. Schau dir dein neues Match an!',
    { url: '/swap' },
  );
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  const payload = (await req.json()) as WebhookPayload;
  let sent = 0;
  if (payload.table === 'messages' && payload.type === 'INSERT' && payload.record) {
    sent = await onMessage(payload.record);
  } else if (payload.table === 'swap_requests' && payload.record) {
    sent = await onRequest(payload);
  }
  return Response.json({ sent });
});
