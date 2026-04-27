/**
 * Tiny key/value store used directly for ad-hoc reads (e.g. the dev
 * notification-seen reset on cold boot) AND surfaced as a `StateStorage`
 * adapter for zustand's `persist` middleware.
 *
 * - Native: `@react-native-async-storage/async-storage` — disk-backed,
 *   survives app relaunches.
 * - Web: `window.localStorage` — survives page reloads.
 *
 * Stored values are always JSON-stringified.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;

const memCache: Record<string, string | undefined> = {};

export const kv = {
  get<T>(key: string): T | undefined {
    try {
      let raw: string | null | undefined = isWeb ? window.localStorage.getItem(key) : memCache[key];
      if (raw == null && !isWeb) {
        AsyncStorage.getItem(key).then(v => { memCache[key] = v ?? undefined; }).catch(() => {});
      }
      if (raw == null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      const raw = JSON.stringify(value);
      if (isWeb) window.localStorage.setItem(key, raw);
      else {
        memCache[key] = raw;
        AsyncStorage.setItem(key, raw).catch(() => {});
      }
    } catch {
      /* quota exceeded or circular ref — drop silently */
    }
  },
  remove(key: string): void {
    try {
      if (isWeb) window.localStorage.removeItem(key);
      else {
        delete memCache[key];
        AsyncStorage.removeItem(key).catch(() => {});
      }
    } catch { /* ignore */ }
  },
};

export const persistStorage: StateStorage = {
  getItem: async (name) => {
    try {
      if (isWeb) return window.localStorage.getItem(name);
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      if (isWeb) window.localStorage.setItem(name, value);
      else await AsyncStorage.setItem(name, value);
    } catch { /* ignore */ }
  },
  removeItem: async (name) => {
    try {
      if (isWeb) window.localStorage.removeItem(name);
      else await AsyncStorage.removeItem(name);
    } catch { /* ignore */ }
  },
};
