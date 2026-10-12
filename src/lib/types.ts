export type Program = 'humanmedizin' | 'zahnmedizin';
export type RingSwapRule = 'yes' | 'no' | 'unknown';
export type PlaceType = 'full' | 'partial';
export type RequestStatus = 'active' | 'paused' | 'completed';
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface UniversityForm {
  label: string;
  url: string;
}

/**
 * Swap rules of a university. Lives in the `universities` table so the rules can be
 * changed in the Supabase dashboard without shipping an app update.
 *
 * Semester numbers: 0 = before the start of studies (confirmed admission), 1 = first
 * semester, 5 = first clinical semester.
 */
export interface University {
  id: string;
  name: string;
  city: string;
  swapPossible: boolean;
  ringSwap: RingSwapRule;
  ringSwapMax: number | null;
  /** Lowest semester (at swap time) in which a swap is allowed; null = not known. */
  minSemester: number | null;
  maxSemester: number | null;
  modelProgram: boolean;
  /** Whether a partner from a model program (Modellstudiengang) is accepted. */
  swapWithModel: boolean;
  /** Whether a partner from a regular program (Regelstudiengang) is accepted. */
  swapWithRegular: boolean;
  /** From this semester on a swap with a regular program is possible (e.g. Köln after Physikum). */
  regularSwapMinSemester: number | null;
  requiresExactSemester: boolean;
  requiresDeanApproval: boolean;
  excludesLawsuitPlaces: boolean;
  partnerMustApplyOnline: boolean;
  deadlineSoSe: string | null;
  deadlineWiSe: string | null;
  forms: UniversityForm[];
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  notes: string[];
  updatedAt: string | null;
}

export interface Profile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  verificationStatus: VerificationStatus;
  pushEnabled: boolean;
}

export interface PublicProfile {
  id: string;
  username: string;
  firstName: string;
  lastInitial: string;
  verified: boolean;
}

export interface SwapRequestInput {
  program: Program;
  currentUniversityId: string;
  /** Wish universities in order of priority (1–3). */
  targetUniversityIds: string[];
  /** Current Fachsemester, 0 = before start of studies. */
  semester: number;
  placeType: PlaceType;
  lawsuitPlace: boolean;
  admissionConfirmed: boolean;
  /** e.g. "WiSe 2026/27" or "SoSe 2027" */
  desiredTerm: string;
  ringSwap: boolean;
}

export interface SwapRequest extends SwapRequestInput {
  id: string;
  userId: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Offer extends SwapRequest {
  profile: PublicProfile;
}

export interface Conversation {
  id: string;
  participants: PublicProfile[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
  /** Present on web, where the picker returns a File object. */
  file?: Blob;
}
