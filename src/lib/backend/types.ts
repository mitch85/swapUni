import type {
  Conversation,
  Message,
  Offer,
  Profile,
  RequestStatus,
  SwapRequest,
  SwapRequestInput,
  University,
  UploadFile,
} from '../types';

export interface Session {
  userId: string;
  email: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface SignUpResult {
  /** False when the e-mail address still has to be confirmed. */
  signedIn: boolean;
}

/** Everything the app needs from a backend. Implemented by Supabase and by a local demo store. */
export interface Backend {
  readonly mode: 'supabase' | 'demo';

  getSession(): Promise<Session | null>;
  onAuthChange(listener: (session: Session | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  usernameAvailable(username: string): Promise<boolean>;
  deleteAccount(): Promise<void>;

  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Pick<Profile, 'firstName' | 'lastName' | 'username' | 'pushEnabled'>>): Promise<void>;
  uploadVerification(file: UploadFile): Promise<void>;

  listUniversities(): Promise<University[]>;

  getMyRequest(): Promise<SwapRequest | null>;
  saveMyRequest(input: SwapRequestInput): Promise<SwapRequest>;
  setRequestStatus(status: Exclude<RequestStatus, 'completed'>): Promise<void>;
  completeSwap(newUniversityId: string): Promise<void>;
  listOffers(): Promise<Offer[]>;
  successfulSwapCount(): Promise<number>;

  listFavorites(): Promise<string[]>;
  setFavorite(requestId: string, favorite: boolean): Promise<void>;

  listConversations(): Promise<Conversation[]>;
  startConversation(userIds: string[]): Promise<string>;
  listMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, body: string): Promise<void>;
  markRead(conversationId: string): Promise<void>;
  /** Calls `listener` for every new message visible to the user. */
  subscribeMessages(listener: (message: Message) => void): () => void;

  reportUser(userId: string, reason: string): Promise<void>;
  /** Reports outdated or wrong swap rules of a university. */
  reportUniversityIssue(universityId: string, message: string): Promise<void>;
  registerPushToken(token: string, platform: string): Promise<void>;
}

export class BackendError extends Error {}
