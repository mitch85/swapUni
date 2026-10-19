import { createClient } from 'npm:@supabase/supabase-js@2';

/** Supabase client with the service role – only for use inside edge functions. */
export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Rejects requests that do not carry the shared webhook secret (if one is configured). */
export function authorizedWebhook(req: Request): boolean {
  const secret = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
  return !secret || req.headers.get('x-webhook-secret') === secret;
}

async function tokensFor(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const { data: profiles } = await admin.from('profiles').select('id').in('id', userIds).eq('push_enabled', true);
  const enabled = (profiles ?? []).map((p) => p.id);
  if (!enabled.length) return [];
  const { data } = await admin.from('push_tokens').select('token').in('user_id', enabled);
  return (data ?? []).map((t) => t.token);
}

/** Sends an Expo push notification to all devices of the given users. Returns the number of devices. */
export async function sendPush(userIds: string[], title: string, body: string, data: Record<string, unknown>) {
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
  if (stale.length) await admin.from('push_tokens').delete().in('token', stale);
  return tokens.length;
}
