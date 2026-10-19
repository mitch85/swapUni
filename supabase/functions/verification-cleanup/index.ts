// Deletes an uploaded proof as soon as an admin has verified or rejected it (data
// minimisation). Triggered by a Database Webhook on UPDATE of public.profiles (see README).
import { admin, authorizedWebhook } from '../_shared/push.ts';

interface ProfileRow {
  id: string;
  verification_status: string;
  verification_path: string | null;
}

Deno.serve(async (req) => {
  if (!authorizedWebhook(req)) return new Response('unauthorized', { status: 401 });
  const { record, old_record } = (await req.json()) as { record: ProfileRow; old_record: ProfileRow | null };
  const decided = ['verified', 'rejected'].includes(record.verification_status);
  const changed = old_record?.verification_status !== record.verification_status;
  if (!decided || !changed || !record.verification_path) return Response.json({ deleted: 0 });

  const { data: files } = await admin.storage.from('verifications').list(record.id);
  const paths = (files ?? []).map((f) => `${record.id}/${f.name}`);
  if (paths.length) await admin.storage.from('verifications').remove(paths);
  await admin.from('profiles').update({ verification_path: null }).eq('id', record.id);
  return Response.json({ deleted: paths.length });
});
