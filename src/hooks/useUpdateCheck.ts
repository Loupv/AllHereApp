import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import appConfig from '../../app.json';
import { kv } from '../content/kv';

// Soft update check. On launch we fetch a tiny version.json off R2 and,
// if it advertises a release newer than the installed binary, surface a
// dismissible "Update available" popup linking to the store. No OTA
// (expo-updates is disabled) and no forced update — this is purely a
// nudge the user can skip.
//
// version.json shape (editable without an app re-ship):
//   {
//     "latest": "1.4.0",
//     "url_ios": "https://apps.apple.com/app/idXXXXXXXXX",
//     "url_android": "https://play.google.com/store/apps/details?id=org.allhere.silentmind",
//     "url_web": "https://allhere.org"
//   }

const VERSION_URL =
  'https://pub-6a724d9bbeda4ced9917d2f1e7611501.r2.dev/version.json';

// Once the user taps "Later" we record the version they dismissed so we
// don't nag on every launch — they'll only see the popup again when an
// even newer version ships.
const DISMISS_KEY = 'updateDismissedVersion';

// Installed version comes from app.json (the canonical release number,
// bumped every release). package.json drifts out of sync, and
// Constants.expoConfig?.version is unreliable on web, so app.json is
// the safest single source here.
const INSTALLED: string = (appConfig as { expo: { version: string } }).expo.version;

type RemoteVersion = {
  latest?: string;
  url_ios?: string;
  url_android?: string;
  url_web?: string;
};

// Compare dotted numeric versions. Returns true when `a` is strictly
// newer than `b` (e.g. isNewer('1.4.0', '1.3.2') === true).
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export type AvailableUpdate = { version: string; url: string };

export function useUpdateCheck() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${VERSION_URL}?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as RemoteVersion;
        if (!data?.latest || !isNewer(data.latest, INSTALLED)) return;
        // Respect a prior "Later" for this exact version.
        if (kv.get<string>(DISMISS_KEY) === data.latest) return;
        const url =
          Platform.OS === 'ios'
            ? data.url_ios
            : Platform.OS === 'android'
              ? data.url_android
              : data.url_web;
        if (!url) return;
        if (!cancelled) setUpdate({ version: data.latest, url });
      } catch {
        // Offline / bad JSON / 404 — stay silent, no popup.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    if (update) kv.set(DISMISS_KEY, update.version);
    setUpdate(null);
  };

  return { update, dismiss };
}
