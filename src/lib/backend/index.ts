import { DemoBackend } from './demo';
import { SupabaseBackend } from './supabase';
import type { Backend } from './types';

export * from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase when configured via .env, otherwise the local demo backend. */
export const backend: Backend = url && anonKey ? new SupabaseBackend(url, anonKey) : new DemoBackend();
