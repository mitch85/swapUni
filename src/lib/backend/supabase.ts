import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { normalizeUniversity } from '@/data/universities';

import type {
  Conversation,
  Message,
  Offer,
  Profile,
  PublicProfile,
  SwapRequest,
  SwapRequestInput,
  University,
  UploadFile,
} from '../types';
import { secureStorage } from './secure-storage';
import { BackendError, type Backend, type Session, type SignUpInput } from './types';

type Row = Record<string, any>;

function check<R extends { data: unknown; error: { message: string } | null }>(result: R): R['data'] {
  if (result.error) throw new BackendError(translateError(result.error.message));
  return result.data;
}

function translateError(message: string): string {
  if (/Invalid login credentials/i.test(message)) return 'E-Mail oder Passwort ist falsch.';
  if (/Email not confirmed/i.test(message)) return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if (/already registered/i.test(message)) return 'Diese E-Mail-Adresse ist bereits registriert.';
  if (/Password should be/i.test(message)) return 'Das Passwort ist zu kurz (mindestens 8 Zeichen).';
  if (/profiles_username|duplicate key.*username/i.test(message)) return 'Dieser Benutzername ist bereits vergeben.';
  return message;
}

const toUniversity = (r: Row): University =>
  normalizeUniversity({
    id: r.id,
    name: r.name,
    city: r.city,
    swapPossible: r.swap_possible,
    ringSwap: r.ring_swap,
    ringSwapMax: r.ring_swap_max,
    minSemester: r.min_semester,
    maxSemester: r.max_semester,
    modelProgram: r.model_program,
    swapWithModel: r.swap_with_model,
    swapWithRegular: r.swap_with_regular,
    regularSwapMinSemester: r.regular_swap_min_semester,
    requiresExactSemester: r.requires_exact_semester,
    requiresDeanApproval: r.requires_dean_approval,
    excludesLawsuitPlaces: r.excludes_lawsuit_places,
    partnerMustApplyOnline: r.partner_must_apply_online,
    allowedTerms: r.allowed_terms ?? 'both',
    lastSwapTerm: r.last_swap_term,
    achievementNote: r.achievement_note,
    deadlineSoSe: r.deadline_sose,
    deadlineWiSe: r.deadline_wise,
    forms: r.forms ?? [],
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    website: r.website,
    notes: r.notes ?? [],
    updatedAt: r.updated_at,
  });

const toRequest = (r: Row): SwapRequest => ({
  id: r.id,
  userId: r.user_id,
  program: r.program,
  currentUniversityId: r.current_university_id,
  targetUniversityIds: r.target_university_ids,
  semester: r.semester,
  placeType: r.place_type,
  lawsuitPlace: r.lawsuit_place,
  provisionalEnrollment: r.provisional_enrollment ?? false,
  admissionConfirmed: r.admission_confirmed,
  desiredTerm: r.desired_term,
  ringSwap: r.ring_swap,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromRequestInput = (input: SwapRequestInput) => ({
  program: input.program,
  current_university_id: input.currentUniversityId,
  target_university_ids: input.targetUniversityIds,
  semester: input.semester,
  place_type: input.placeType,
  lawsuit_place: input.lawsuitPlace,
  provisional_enrollment: input.provisionalEnrollment,
  admission_confirmed: input.admissionConfirmed,
  desired_term: input.desiredTerm,
  ring_swap: input.ringSwap,
});

const toPublicProfile = (r: Row): PublicProfile => ({
  id: r.id,
  username: r.username,
  firstName: r.first_name,
  lastInitial: r.last_initial ?? '',
  verified: !!r.verified,
});

const toMessage = (r: Row): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
});

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }

  private async uid(): Promise<string> {
    const session = await this.getSession();
    if (!session) throw new BackendError('Nicht angemeldet.');
    return session.userId;
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    return user ? { userId: user.id, email: user.email ?? '' } : null;
  }

  onAuthChange(listener: (session: Session | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(session?.user ? { userId: session.user.id, email: session.user.email ?? '' } : null);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    check(await this.client.auth.signInWithPassword({ email: email.trim(), password }));
  }

  async signUp(input: SignUpInput) {
    if (!(await this.usernameAvailable(input.username))) {
      throw new BackendError('Dieser Benutzername ist bereits vergeben.');
    }
    const data = check(
      await this.client.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: { username: input.username, first_name: input.firstName, last_name: input.lastName },
          emailRedirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'swapuni://',
        },
      }),
    );
    return { signedIn: !!data.session };
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  async resetPassword(email: string) {
    check(await this.client.auth.resetPasswordForEmail(email.trim()));
  }

  async usernameAvailable(username: string) {
    return check(await this.client.rpc('username_available', { name: username })) as boolean;
  }

  async deleteAccount() {
    check(await this.client.rpc('delete_my_account'));
    await this.client.auth.signOut();
  }

  async getProfile(): Promise<Profile> {
    const session = await this.getSession();
    if (!session) throw new BackendError('Nicht angemeldet.');
    const r = check(await this.client.from('profiles').select('*').eq('id', session.userId).single()) as Row;
    return {
      id: r.id,
      username: r.username,
      firstName: r.first_name,
      lastName: r.last_name,
      email: session.email,
      verificationStatus: r.verification_status,
      pushEnabled: r.push_enabled,
    };
  }

  async updateProfile(patch: Partial<Pick<Profile, 'firstName' | 'lastName' | 'username' | 'pushEnabled'>>) {
    const row: Row = {};
    if (patch.firstName !== undefined) row.first_name = patch.firstName;
    if (patch.lastName !== undefined) row.last_name = patch.lastName;
    if (patch.username !== undefined) row.username = patch.username;
    if (patch.pushEnabled !== undefined) row.push_enabled = patch.pushEnabled;
    check(await this.client.from('profiles').update(row).eq('id', await this.uid()));
  }

  async uploadVerification(file: UploadFile) {
    const uid = await this.uid();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const path = `${uid}/studienbescheinigung-${Date.now()}.${extension}`;
    const body = file.file ?? (await (await fetch(file.uri)).arrayBuffer());
    check(await this.client.storage.from('verifications').upload(path, body, { contentType: file.mimeType }));
    check(
      await this.client
        .from('profiles')
        .update({ verification_status: 'pending', verification_path: path })
        .eq('id', uid),
    );
  }

  async listUniversities() {
    const rows = check(await this.client.from('universities').select('*').order('name')) as Row[];
    return rows.map(toUniversity);
  }

  async getMyRequest() {
    const uid = await this.uid();
    const row = check(await this.client.from('swap_requests').select('*').eq('user_id', uid).maybeSingle()) as Row | null;
    return row ? toRequest(row) : null;
  }

  async saveMyRequest(input: SwapRequestInput) {
    const uid = await this.uid();
    const row = check(
      await this.client
        .from('swap_requests')
        .upsert(
          { ...fromRequestInput(input), user_id: uid, status: 'active', completed_at: null },
          { onConflict: 'user_id' },
        )
        .select()
        .single(),
    ) as Row;
    return toRequest(row);
  }

  async setRequestStatus(status: 'active' | 'paused') {
    check(await this.client.from('swap_requests').update({ status }).eq('user_id', await this.uid()));
  }

  async completeSwap(newUniversityId: string) {
    check(await this.client.rpc('complete_swap', { new_university_id: newUniversityId }));
  }

  async listOffers(): Promise<Offer[]> {
    const rows = check(await this.client.from('offers').select('*').order('created_at', { ascending: false })) as Row[];
    return rows.map((r) => ({
      ...toRequest(r),
      profile: toPublicProfile({ ...r, id: r.user_id }),
    }));
  }

  async successfulSwapCount() {
    return Number(check(await this.client.rpc('successful_swap_count')));
  }

  async listFavorites() {
    const rows = check(await this.client.from('favorites').select('request_id')) as Row[];
    return rows.map((r) => r.request_id as string);
  }

  async setFavorite(requestId: string, favorite: boolean) {
    if (favorite) {
      check(await this.client.from('favorites').upsert({ request_id: requestId, user_id: await this.uid() }));
    } else {
      check(await this.client.from('favorites').delete().eq('request_id', requestId));
    }
  }

  async listConversations(): Promise<Conversation[]> {
    const uid = await this.uid();
    const conversations = check(
      await this.client.from('conversations').select('*').order('last_message_at', { ascending: false }),
    ) as Row[];
    if (!conversations.length) return [];
    const ids = conversations.map((c) => c.id);
    const userIds = [...new Set(conversations.flatMap((c) => c.participant_ids as string[]))];
    const [profiles, messages] = await Promise.all([
      this.client.from('public_profiles').select('*').in('id', userIds).then(check),
      this.client
        .from('messages')
        .select('*')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(500)
        .then(check),
    ]);
    const profileMap = new Map((profiles as Row[]).map((p) => [p.id, toPublicProfile(p)]));
    return conversations.map((c) => {
      const own = (messages as Row[]).filter((m) => m.conversation_id === c.id);
      return {
        id: c.id,
        participants: (c.participant_ids as string[])
          .filter((id) => id !== uid)
          .map((id) => profileMap.get(id) ?? { id, username: 'gelöscht', firstName: 'Gelöschtes Konto', lastInitial: '', verified: false }),
        lastMessage: own[0] ? toMessage(own[0]) : null,
        unreadCount: own.filter((m) => m.sender_id !== uid && !(m.read_by as string[]).includes(uid)).length,
      };
    });
  }

  async startConversation(userIds: string[]) {
    return check(await this.client.rpc('start_conversation', { other_ids: userIds })) as string;
  }

  async listMessages(conversationId: string) {
    const rows = check(
      await this.client.from('messages').select('*').eq('conversation_id', conversationId).order('created_at'),
    ) as Row[];
    return rows.map(toMessage);
  }

  async sendMessage(conversationId: string, body: string) {
    check(await this.client.from('messages').insert({ conversation_id: conversationId, body: body.trim() }));
  }

  async markRead(conversationId: string) {
    check(await this.client.rpc('mark_conversation_read', { conversation: conversationId }));
  }

  subscribeMessages(listener: (message: Message) => void) {
    const channel = this.client
      .channel(`messages-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
        listener(toMessage(payload.new as Row)),
      )
      .subscribe();
    return () => {
      this.client.removeChannel(channel);
    };
  }

  async reportUser(userId: string, reason: string) {
    check(await this.client.from('reports').insert({ reported_user_id: userId, reason }));
  }

  async reportUniversityIssue(universityId: string, message: string) {
    check(await this.client.from('university_reports').insert({ university_id: universityId, message }));
  }

  async registerPushToken(token: string, platform: string) {
    check(
      await this.client
        .from('push_tokens')
        .upsert({ token, platform, user_id: await this.uid(), updated_at: new Date().toISOString() }),
    );
  }
}
