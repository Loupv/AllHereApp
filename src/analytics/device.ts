/**
 * Anonymous device identity. The server mints the id (so we never need a
 * client-side UUID): we POST /v1/device with whatever we have stored and
 * persist whatever comes back. Survives cold starts via the stored id.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { kv } from '../content/kv';
import { apiUrl, apiHeaders } from './config';

const DEVICE_KEY = 'ah_device_id_v1';

let deviceId: string | null = null;
let inflight: Promise<string | null> | null = null;

/** Read the stored id, surviving native cold start (kv.get is empty until
 *  its own async backfill lands, so read AsyncStorage directly as a fallback). */
const readStoredId = async (): Promise<string | null> => {
  const sync = kv.get<string>(DEVICE_KEY);
  if (sync) return sync;
  if (Platform.OS === 'web') return null;
  try {
    const raw = await AsyncStorage.getItem(DEVICE_KEY);
    return raw ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
};

/**
 * Ensure we have a device id (register on first run / re-assert on boot).
 * Idempotent + de-duped; never throws. Returns null only if offline AND
 * we've never registered before.
 */
export const ensureDevice = (appVersion: string): Promise<string | null> => {
  if (deviceId) return Promise.resolve(deviceId);
  if (inflight) return inflight;
  inflight = (async () => {
    const existing = await readStoredId();
    try {
      const res = await fetch(apiUrl('/v1/device'), {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          device_id: existing ?? undefined,
          platform: Platform.OS,
          app_version: appVersion,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { device_id?: string };
        if (data.device_id) {
          deviceId = data.device_id;
          kv.set(DEVICE_KEY, deviceId);
          return deviceId;
        }
      }
    } catch {
      /* offline — fall back to the stored id so events can still queue */
    }
    deviceId = existing;
    return deviceId;
  })();
  return inflight;
};

/** Synchronous accessor — null until `ensureDevice` has resolved. */
export const getDeviceId = (): string | null => deviceId;
