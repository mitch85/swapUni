import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { BUNDLED_UNIVERSITIES } from '@/data/universities';

import { backend, type Session } from './backend';
import { findMatches, type Match } from './matching';
import type { Conversation, Offer, Profile, SwapRequest, University } from './types';

interface AppState {
  /** undefined while the stored session is being restored */
  session: Session | null | undefined;
  profile: Profile | null;
  universities: University[];
  universityById: (id: string) => University | undefined;
  myRequest: SwapRequest | null;
  /** True once the user's own data has been loaded after sign-in. */
  loaded: boolean;
  offers: Offer[];
  matches: Match[];
  favorites: Set<string>;
  conversations: Conversation[];
  unreadCount: number;
  swapCount: number;
  refresh: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setMyRequest: (request: SwapRequest | null) => void;
  toggleFavorite: (requestId: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [universities, setUniversities] = useState<University[]>(BUNDLED_UNIVERSITIES);
  const [myRequest, setMyRequest] = useState<SwapRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [swapCount, setSwapCount] = useState(0);
  const sessionRef = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    const apply = (next: Session | null) => {
      if (sessionRef.current !== undefined && sessionRef.current?.userId === next?.userId) return;
      sessionRef.current = next;
      // Another (or no) user: drop the previous user's data.
      setProfile(null);
      setMyRequest(null);
      setOffers([]);
      setFavorites(new Set());
      setConversations([]);
      setLoaded(false);
      setSession(next);
    };
    backend.getSession().then(apply, () => apply(null));
    return backend.onAuthChange(apply);
  }, []);

  useEffect(() => {
    backend.listUniversities().then(setUniversities, () => {
      // Offline or not reachable: keep the bundled rules.
    });
    backend.successfulSwapCount().then(setSwapCount, () => undefined);
  }, []);

  const refreshConversations = useCallback(async () => {
    setConversations(await backend.listConversations());
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfile(await backend.getProfile());
  }, []);

  const refresh = useCallback(async () => {
    const [nextProfile, request, nextOffers, nextFavorites, nextConversations, count] = await Promise.all([
      backend.getProfile(),
      backend.getMyRequest(),
      backend.listOffers(),
      backend.listFavorites(),
      backend.listConversations(),
      backend.successfulSwapCount(),
    ]);
    setProfile(nextProfile);
    setMyRequest(request);
    setOffers(nextOffers);
    setFavorites(new Set(nextFavorites));
    setConversations(nextConversations);
    setSwapCount(count);
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    // refresh() only sets state after awaiting the backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .catch(() => undefined)
      .finally(() => !cancelled && setLoaded(true));
    const unsubscribe = backend.subscribeMessages(() => {
      refreshConversations().catch(() => undefined);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [session, refresh, refreshConversations]);

  const toggleFavorite = useCallback(
    async (requestId: string) => {
      const favorite = !favorites.has(requestId);
      setFavorites((current) => {
        const next = new Set(current);
        if (favorite) next.add(requestId);
        else next.delete(requestId);
        return next;
      });
      await backend.setFavorite(requestId, favorite);
    },
    [favorites],
  );

  const matches = useMemo(
    () => (myRequest && myRequest.status === 'active' ? findMatches(myRequest, offers, universities) : []),
    [myRequest, offers, universities],
  );

  const universityMap = useMemo(() => new Map(universities.map((u) => [u.id, u])), [universities]);
  const universityById = useCallback((id: string) => universityMap.get(id), [universityMap]);

  const value: AppState = {
    session,
    profile,
    universities,
    universityById,
    myRequest,
    loaded,
    offers,
    matches,
    favorites,
    conversations,
    unreadCount: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    swapCount,
    refresh,
    refreshConversations,
    refreshProfile,
    setMyRequest,
    toggleFavorite,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
