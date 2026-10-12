import AsyncStorage from '@react-native-async-storage/async-storage';

import { BUNDLED_UNIVERSITIES } from '@/data/universities';

import { upcomingTerms } from '../terms';
import type {
  Conversation,
  Message,
  Offer,
  Profile,
  PublicProfile,
  SwapRequest,
  SwapRequestInput,
  UploadFile,
} from '../types';
import { BackendError, type Backend, type Session, type SignUpInput } from './types';

/**
 * Local backend for trying the app without a Supabase project. Data is kept on the device
 * (AsyncStorage / localStorage) and a few simulated students are seeded so that matching,
 * favorites and chat can be explored. Not meant for production use.
 */

interface Account {
  password: string;
  profile: Profile;
}

interface DemoState {
  version: number;
  accounts: Record<string, Account>;
  sessionEmail: string | null;
  requests: SwapRequest[];
  /** profile id -> public profile, also for simulated users */
  people: Record<string, PublicProfile>;
  favorites: Record<string, string[]>;
  conversations: { id: string; participantIds: string[] }[];
  messages: (Message & { readBy: string[] })[];
  successfulSwaps: number;
}

const STORAGE_KEY = 'swapuni-demo-v2';
const VERSION = 2;

const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();

const SIMULATED: [string, string, string, string[], number, boolean][] = [
  // first name, last name, current uni, wishes, semester, ring swap
  ['Max', 'Müller', 'muenchen-lmu', ['mainz', 'freiburg', 'heidelberg'], 3, true],
  ['Lea', 'Klein', 'muenchen-lmu', ['mainz', 'wuerzburg'], 3, false],
  ['Paul', 'Schulz', 'freiburg', ['mainz', 'muenchen-lmu'], 4, true],
  ['Sophie', 'Wagner', 'heidelberg', ['muenchen-lmu', 'freiburg', 'mainz'], 3, false],
  ['Jonas', 'Becker', 'kiel', ['hamburg', 'luebeck', 'muenster'], 2, true],
  ['Marie', 'Hoffmann', 'muenster', ['koeln', 'duesseldorf', 'bochum'], 3, true],
  ['Felix', 'Fischer', 'wuerzburg', ['muenchen-lmu', 'regensburg', 'erlangen'], 3, true],
  ['Emma', 'Weber', 'regensburg', ['wuerzburg', 'erlangen', 'muenchen-lmu'], 3, true],
  ['Leon', 'Koch', 'erlangen', ['regensburg', 'muenchen-lmu'], 3, true],
  ['Hannah', 'Richter', 'jena', ['berlin-fu', 'leipzig', 'dresden'], 5, true],
  ['Lukas', 'Wolf', 'rostock', ['greifswald', 'kiel', 'hamburg'], 2, true],
  ['Mia', 'Neumann', 'frankfurt', ['mainz', 'marburg', 'giessen'], 3, true],
  ['Noah', 'Braun', 'mainz', ['frankfurt', 'heidelberg'], 3, true],
  ['Lina', 'Zimmermann', 'marburg', ['frankfurt', 'giessen', 'mainz'], 2, false],
];

function seed(): DemoState {
  const [term] = upcomingTerms(new Date());
  const state: DemoState = {
    version: VERSION,
    accounts: {},
    sessionEmail: null,
    requests: [],
    people: {},
    favorites: {},
    conversations: [],
    messages: [],
    successfulSwaps: 27,
  };
  SIMULATED.forEach(([firstName, lastName, uni, wishes, semester, ring], i) => {
    const userId = `sim-${i}`;
    state.people[userId] = {
      id: userId,
      username: firstName.toLowerCase(),
      firstName,
      lastInitial: lastName[0],
      verified: i % 3 !== 2,
    };
    state.requests.push(simulatedRequest(userId, uni, wishes, semester, ring, term));
  });
  return state;
}

function simulatedRequest(
  userId: string,
  uni: string,
  wishes: string[],
  semester: number,
  ring: boolean,
  term: string,
): SwapRequest {
  return {
    id: `req-${userId}`,
    userId,
    program: 'humanmedizin',
    currentUniversityId: uni,
    targetUniversityIds: wishes,
    semester,
    placeType: 'full',
    lawsuitPlace: false,
    provisionalEnrollment: false,
    admissionConfirmed: true,
    desiredTerm: term,
    ringSwap: ring,
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
  };
}

const REPLIES = [
  'Hi! Schön, dass es passt 😊 Wann wäre für dich ein guter Zeitpunkt zum Telefonieren?',
  'Klingt super! Hast du das Tauschformular schon heruntergeladen?',
  'Ich habe meine Studienbescheinigung schon da – wollen wir die Anträge gemeinsam einreichen?',
];

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const;
  private state: DemoState | null = null;
  private authListeners = new Set<(session: Session | null) => void>();
  private messageListeners = new Set<(message: Message) => void>();

  private async load(): Promise<DemoState> {
    if (this.state) return this.state;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as DemoState) : null;
      this.state = parsed?.version === VERSION ? parsed : seed();
    } catch {
      this.state = seed();
    }
    return this.state;
  }

  private async save() {
    if (!this.state) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage unavailable (e.g. private browsing) – keep the in-memory state.
    }
  }

  private async me(): Promise<{ state: DemoState; account: Account }> {
    const state = await this.load();
    const account = state.sessionEmail ? state.accounts[state.sessionEmail] : undefined;
    if (!account) throw new BackendError('Nicht angemeldet.');
    return { state, account };
  }

  private emitAuth(session: Session | null) {
    this.authListeners.forEach((l) => l(session));
  }

  async getSession() {
    const state = await this.load();
    const account = state.sessionEmail ? state.accounts[state.sessionEmail] : undefined;
    return account ? { userId: account.profile.id, email: state.sessionEmail! } : null;
  }

  onAuthChange(listener: (session: Session | null) => void) {
    this.authListeners.add(listener);
    return () => {
      this.authListeners.delete(listener);
    };
  }

  async signIn(email: string, password: string) {
    const state = await this.load();
    const key = email.trim().toLowerCase();
    const account = state.accounts[key];
    if (!account || account.password !== password) throw new BackendError('E-Mail oder Passwort ist falsch.');
    state.sessionEmail = key;
    await this.save();
    this.emitAuth(await this.getSession());
  }

  async signUp(input: SignUpInput) {
    const state = await this.load();
    const key = input.email.trim().toLowerCase();
    if (state.accounts[key]) throw new BackendError('Diese E-Mail-Adresse ist bereits registriert.');
    if (!(await this.usernameAvailable(input.username))) {
      throw new BackendError('Dieser Benutzername ist bereits vergeben.');
    }
    const userId = `user-${id()}`;
    const profile: Profile = {
      id: userId,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      email: key,
      verificationStatus: 'none',
      pushEnabled: true,
    };
    state.accounts[key] = { password: input.password, profile };
    state.people[userId] = this.toPublic(profile);
    state.sessionEmail = key;
    await this.save();
    this.emitAuth(await this.getSession());
    return { signedIn: true };
  }

  private toPublic(profile: Profile): PublicProfile {
    return {
      id: profile.id,
      username: profile.username,
      firstName: profile.firstName,
      lastInitial: profile.lastName.slice(0, 1),
      verified: profile.verificationStatus === 'verified',
    };
  }

  async signOut() {
    const state = await this.load();
    state.sessionEmail = null;
    await this.save();
    this.emitAuth(null);
  }

  async resetPassword() {
    // Nothing to send in demo mode.
  }

  async usernameAvailable(username: string) {
    const state = await this.load();
    return !Object.values(state.people).some((p) => p.username.toLowerCase() === username.toLowerCase());
  }

  async deleteAccount() {
    const { state, account } = await this.me();
    const uid = account.profile.id;
    state.requests = state.requests.filter((r) => r.userId !== uid);
    state.conversations = state.conversations.filter((c) => !c.participantIds.includes(uid));
    state.messages = state.messages.filter((m) => state.conversations.some((c) => c.id === m.conversationId));
    delete state.favorites[uid];
    delete state.people[uid];
    delete state.accounts[state.sessionEmail!];
    state.sessionEmail = null;
    await this.save();
    this.emitAuth(null);
  }

  async getProfile() {
    const { account } = await this.me();
    return { ...account.profile };
  }

  async updateProfile(patch: Partial<Pick<Profile, 'firstName' | 'lastName' | 'username' | 'pushEnabled'>>) {
    const { state, account } = await this.me();
    if (patch.username && patch.username !== account.profile.username && !(await this.usernameAvailable(patch.username))) {
      throw new BackendError('Dieser Benutzername ist bereits vergeben.');
    }
    Object.assign(account.profile, patch);
    state.people[account.profile.id] = this.toPublic(account.profile);
    await this.save();
  }

  async uploadVerification(_file: UploadFile) {
    const { state, account } = await this.me();
    account.profile.verificationStatus = 'pending';
    await this.save();
    // Simulate a manual review.
    setTimeout(async () => {
      account.profile.verificationStatus = 'verified';
      state.people[account.profile.id] = this.toPublic(account.profile);
      await this.save();
    }, 4000);
  }

  async listUniversities() {
    return BUNDLED_UNIVERSITIES;
  }

  async getMyRequest() {
    const { state, account } = await this.me();
    return state.requests.find((r) => r.userId === account.profile.id) ?? null;
  }

  async saveMyRequest(input: SwapRequestInput) {
    const { state, account } = await this.me();
    const uid = account.profile.id;
    const existing = state.requests.find((r) => r.userId === uid);
    const request: SwapRequest = {
      ...input,
      id: existing?.id ?? `req-${id()}`,
      userId: uid,
      status: 'active',
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    state.requests = [request, ...state.requests.filter((r) => r.userId !== uid)];
    this.ensureSimulatedPartner(state, request);
    await this.save();
    return request;
  }

  /** Makes sure the demo always shows at least one match for the user's first wish. */
  private ensureSimulatedPartner(state: DemoState, mine: SwapRequest) {
    const wish = mine.targetUniversityIds[0];
    const hasPartner = state.requests.some(
      (r) =>
        r.userId !== mine.userId &&
        r.status === 'active' &&
        r.program === mine.program &&
        r.desiredTerm === mine.desiredTerm &&
        r.targetUniversityIds.includes(mine.currentUniversityId) &&
        mine.targetUniversityIds.includes(r.currentUniversityId),
    );
    if (hasPartner || !wish) return;
    const userId = `sim-partner-${wish}-${mine.currentUniversityId}`;
    state.people[userId] = { id: userId, username: 'clara', firstName: 'Clara', lastInitial: 'S', verified: true };
    state.requests = state.requests.filter((r) => r.userId !== userId);
    state.requests.push({
      ...simulatedRequest(userId, wish, [mine.currentUniversityId], mine.semester, mine.ringSwap, mine.desiredTerm),
      program: mine.program,
      placeType: mine.placeType,
    });
  }

  async setRequestStatus(status: 'active' | 'paused') {
    const { state, account } = await this.me();
    const request = state.requests.find((r) => r.userId === account.profile.id);
    if (request) request.status = status;
    await this.save();
  }

  async completeSwap() {
    const { state, account } = await this.me();
    const request = state.requests.find((r) => r.userId === account.profile.id);
    if (!request) throw new BackendError('Kein Tauschgesuch vorhanden.');
    request.status = 'completed';
    state.successfulSwaps += 1;
    Object.keys(state.favorites).forEach((uid) => {
      state.favorites[uid] = state.favorites[uid].filter((rid) => rid !== request.id);
    });
    await this.save();
  }

  async listOffers(): Promise<Offer[]> {
    const state = await this.load();
    return state.requests
      .filter((r) => r.status === 'active' && state.people[r.userId])
      .map((r) => ({ ...r, profile: state.people[r.userId] }));
  }

  async successfulSwapCount() {
    return (await this.load()).successfulSwaps;
  }

  async listFavorites() {
    const { state, account } = await this.me();
    return state.favorites[account.profile.id] ?? [];
  }

  async setFavorite(requestId: string, favorite: boolean) {
    const { state, account } = await this.me();
    const list = new Set(state.favorites[account.profile.id] ?? []);
    if (favorite) list.add(requestId);
    else list.delete(requestId);
    state.favorites[account.profile.id] = [...list];
    await this.save();
  }

  async listConversations(): Promise<Conversation[]> {
    const { state, account } = await this.me();
    const uid = account.profile.id;
    return state.conversations
      .filter((c) => c.participantIds.includes(uid))
      .map((c) => {
        const messages = state.messages.filter((m) => m.conversationId === c.id);
        const last = messages[messages.length - 1];
        return {
          id: c.id,
          participants: c.participantIds.filter((p) => p !== uid).map((p) => state.people[p]).filter(Boolean),
          lastMessage: last ? strip(last) : null,
          unreadCount: messages.filter((m) => m.senderId !== uid && !m.readBy.includes(uid)).length,
        };
      })
      .sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
  }

  async startConversation(userIds: string[]) {
    const { state, account } = await this.me();
    const members = [...new Set([...userIds, account.profile.id])].sort();
    const existing = state.conversations.find(
      (c) => c.participantIds.length === members.length && members.every((m) => c.participantIds.includes(m)),
    );
    if (existing) return existing.id;
    const conversation = { id: `conv-${id()}`, participantIds: members };
    state.conversations.push(conversation);
    await this.save();
    return conversation.id;
  }

  async listMessages(conversationId: string) {
    const state = await this.load();
    return state.messages.filter((m) => m.conversationId === conversationId).map(strip);
  }

  async sendMessage(conversationId: string, body: string) {
    const { state, account } = await this.me();
    const message = {
      id: `msg-${id()}`,
      conversationId,
      senderId: account.profile.id,
      body: body.trim(),
      createdAt: now(),
      readBy: [],
    };
    state.messages.push(message);
    await this.save();
    this.messageListeners.forEach((l) => l(strip(message)));

    // Simulated partners answer the first message of a conversation.
    const conversation = state.conversations.find((c) => c.id === conversationId);
    const other = conversation?.participantIds.find((p) => p.startsWith('sim-'));
    const ownCount = state.messages.filter((m) => m.conversationId === conversationId && m.senderId === account.profile.id).length;
    if (other && ownCount <= REPLIES.length) {
      setTimeout(async () => {
        const reply = {
          id: `msg-${id()}`,
          conversationId,
          senderId: other,
          body: REPLIES[ownCount - 1],
          createdAt: now(),
          readBy: [],
        };
        state.messages.push(reply);
        await this.save();
        this.messageListeners.forEach((l) => l(strip(reply)));
      }, 1500);
    }
  }

  async markRead(conversationId: string) {
    const { state, account } = await this.me();
    state.messages
      .filter((m) => m.conversationId === conversationId && !m.readBy.includes(account.profile.id))
      .forEach((m) => m.readBy.push(account.profile.id));
    await this.save();
  }

  subscribeMessages(listener: (message: Message) => void) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  async reportUser() {
    // Reports are only stored server-side.
  }

  async reportUniversityIssue() {
    // Reports are only stored server-side.
  }

  async registerPushToken() {
    // Push notifications need the Supabase backend.
  }
}

function strip({ readBy: _readBy, ...message }: Message & { readBy: string[] }): Message {
  return message;
}
