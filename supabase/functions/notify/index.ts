// Sends Expo push notifications. Triggered by two Database Webhooks (see README):
//   * INSERT on public.messages        -> notify the other chat participants
//   * INSERT/UPDATE on public.swap_requests -> notify users whose request now matches
import { admin as supabase, authorizedWebhook, sendPush as send } from '../_shared/push.ts';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
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
  if (!authorizedWebhook(req)) {
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
