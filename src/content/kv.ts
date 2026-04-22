/**
 * Tiny synchronous-style key/value cache shim.
 *
 * - Web: backed by window.localStorage (survives page reloads).
 * - Native: in-memory only (session-scoped) — swap in
 *   @react-native-async-storage/async-storage later without touching callers.
 *
 * Stored values are always JSON-stringified.
 */
import { Platform } from 'react-native';

const mem: Record<string, string> = {};

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;

export const kv = {
  get<T>(key: string): T | undefined {
    try {
      const raw = isWeb ? window.localStorage.getItem(key) : mem[key];
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
      else mem[key] = raw;
    } catch {
      /* quota exceeded or circular ref — drop silently */
    }
  },
  remove(key: string): void {
    try {
      if (isWeb) window.localStorage.removeItem(key);
      else delete mem[key];
    } catch { /* ignore */ }
  },
};
