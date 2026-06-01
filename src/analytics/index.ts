/**
 * Analytics bootstrap — call `initAnalytics(version)` once at app start.
 * Registers the anonymous device, syncs progress, emits session events,
 * and drives the flush cadence (paused while backgrounded, per the app's
 * CPU-watchdog discipline — no timers running off-screen).
 *
 * `track(type, fields)` is the public fire-and-forget API used everywhere
 * else (Player, navigation, …).
 */
import { AppState, type AppStateStatus } from 'react-native';
import { ensureDevice } from './device';
import { track, flush, hydrateQueue } from './events';
import { pushProgress, pullProgress } from './progress';
import { useProgress } from '../player/progressStore';

export { track } from './events';
export type { EventType, EventFields } from './events';

const FLUSH_INTERVAL_MS = 30_000;

let started = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

const startTimer = () => {
  if (!flushTimer) flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
};
const stopTimer = () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
};

export const initAnalytics = async (appVersion: string): Promise<void> => {
  if (started) return;
  started = true;

  hydrateQueue();
  await ensureDevice(appVersion); // sets the device id used as actor
  void pullProgress(); // merge server progress into the local store
  void pushProgress(); // and push whatever the device already had

  // A new entry in `listened` = a track was completed. Subscribe (rather
  // than editing the store) so progressStore stays pure.
  useProgress.subscribe((state, prevState) => {
    if (state.listened === prevState.listened) return;
    for (const id of Object.keys(state.listened)) {
      if (!prevState.listened[id]) track('play_complete', { audio_id: id });
    }
    void pushProgress();
  });

  track('app_session', { payload: { phase: 'start' } });
  startTimer();
  void flush();

  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') {
      track('app_session', { payload: { phase: 'foreground' } });
      startTimer();
      void flush();
    } else {
      track('app_session', { payload: { phase: 'background' } });
      stopTimer();
      void flush(); // best-effort final flush before we go quiet
    }
  });
};
