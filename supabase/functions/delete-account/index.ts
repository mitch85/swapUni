// Deletes the calling user's account: uploaded proofs (via the Storage API) and the auth
// user. Profile, request, favorites, messages etc. are removed by foreign-key cascades.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { admin } from '../_shared/push.ts';

const BUCKET = 'verifications';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const authorization = req.headers.get('Authorization') ?? '';
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth } = await caller.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return Response.json({ error: 'not authenticated' }, { status: 401, headers: cors });

  const { data: files } = await admin.storage.from(BUCKET).list(userId);
  if (files?.length) {
    await admin.storage.from(BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  return Response.json({ deleted: true }, { headers: cors });
});

// The web app calls this function from the browser.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
