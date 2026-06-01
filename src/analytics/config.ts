/**
 * AllHere activity API — client config.
 *
 * Base URL is overridable per-env with `EXPO_PUBLIC_API_URL` (Expo inlines
 * `EXPO_PUBLIC_*` at build time). Defaults to the local `wrangler dev`
 * server for development.
 *
 * ⚠️ A physical device CANNOT reach the Mac's `localhost`. When testing the
 * tracking on a real device, set `EXPO_PUBLIC_API_URL` to the deployed
 * Worker URL (or the Mac's LAN IP, e.g. http://192.168.1.95:8787).
 */
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');

/** Optional shared key matching the Worker's APP_KEY guard (Phase 1.5). */
const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? '';

/** Master switch — a real consent gate lands in Phase 5 (privacy). */
export const ANALYTICS_ENABLED = true;

export const apiUrl = (path: string): string => `${API_BASE}${path}`;

export const apiHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(APP_KEY ? { 'X-App-Key': APP_KEY } : {}),
});
