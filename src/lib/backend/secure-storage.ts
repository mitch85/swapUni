import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session storage for supabase-js. On iOS/Android values are kept encrypted in the
 * Keychain / Android Keystore. SecureStore limits the size of a single value, so long
 * values (JWT sessions) are split into chunks.
 */
const CHUNK_SIZE = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = safeKey(key);
    const count = await SecureStore.getItemAsync(`${base}.n`);
    if (count == null) return null;
    const parts = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${base}.${i}`)),
    );
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const base = safeKey(key);
    await nativeStorage.removeItem(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [''];
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${base}.${i}`, chunk)));
    await SecureStore.setItemAsync(`${base}.n`, String(chunks.length));
  },
  async removeItem(key: string): Promise<void> {
    const base = safeKey(key);
    const count = Number((await SecureStore.getItemAsync(`${base}.n`)) ?? 0);
    await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${base}.${i}`)));
    await SecureStore.deleteItemAsync(`${base}.n`);
  },
};

const webStorage = {
  async getItem(key: string) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export const secureStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
