// Daily maintenance, started by a cron job (see README):
//   * pauses requests of users who have been inactive for a year
//   * deletes completed requests six weeks after a successful swap
//   * reminds users two weeks before their request is paused (push, plus e-mail if configured)
import { admin, authorizedWebhook, sendPush } from '../_shared/push.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const MAIL_FROM = Deno.env.get('MAIL_FROM'); // e.g. "SwapUni <hallo@swapuni.de>"

const TITLE = 'Ist dein Tauschgesuch noch aktuell?';
const TEXT =
  'Du warst fast ein Jahr nicht mehr in SwapUni. In 14 Tagen pausieren wir dein Tauschgesuch, ' +
  'damit die Trefferliste aktuell bleibt. Öffne einfach die App, dann bleibt es aktiv.';

async function sendMail(userId: string) {
  if (!RESEND_API_KEY || !MAIL_FROM) return false;
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email;
  if (!email) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: email, subject: TITLE, text: TEXT }),
  });
  return response.ok;
}

Deno.serve(async (req) => {
  if (!authorizedWebhook(req)) return new Response('unauthorized', { status: 401 });
  const { data, error } = await admin.rpc('run_maintenance');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const userIds = ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
  const pushed = await sendPush(userIds, TITLE, TEXT, { url: '/' });
  let mailed = 0;
  for (const id of userIds) if (await sendMail(id)) mailed += 1;
  return Response.json({ reminded: userIds.length, pushed, mailed });
});
