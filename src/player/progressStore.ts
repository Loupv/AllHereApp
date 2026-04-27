import { create } from 'zustand';
import { silentMindVolets, qmVolets } from '../content/catalog';
import { kv } from '../content/kv';

type State = {
  listened: Record<string, true>;
  markListened: (id: string) => void;
  isListened: (id: string) => boolean;
  /** First playable track that hasn't been listened, walking SM first
   *  (intro → Part 1 → Part 2 → Part 3, plus their qmTracks if any),
   *  then the QM-only volets. Returns undefined when everything is
   *  listened. */
  nextTrackId: () => string | undefined;
  /** Wipe every "listened" mark — surfaces under the user account
   *  menu so a returning user can start the journey from the top. */
  resetProgress: () => void;
};

const orderedTrackIds = (): string[] => {
  const sm = silentMindVolets.flatMap(v =>
    [...v.tracks, ...(v.qmTracks ?? [])]
      .filter(t => !t.comingSoon)
      .map(t => t.id),
  );
  const qm = qmVolets.flatMap(v =>
    v.tracks.filter(t => !t.comingSoon).map(t => t.id),
  );
  // SM comes first so a fresh user lands on the welcome / SM journey;
  // QM tail picks up once the SM stream is done.
  return [...sm, ...qm];
};

const STORAGE_KEY = 'ah_progress_v1';

// Hand-rolled persistence — zustand's `persist` middleware was breaking
// the web bundle's mount in this project (no error, just an empty root).
// Sync localStorage on web (and best-effort AsyncStorage cache on native
// via `kv`) is plenty for a tiny `Record<string, true>` payload.
const initialListened: Record<string, true> =
  kv.get<Record<string, true>>(STORAGE_KEY) ?? {};

export const useProgress = create<State>((set, get) => ({
  listened: initialListened,
  markListened: (id) => {
    const cur = get().listened;
    if (cur[id]) return;
    const next = { ...cur, [id]: true as const };
    set({ listened: next });
    kv.set(STORAGE_KEY, next);
  },
  isListened: (id) => !!get().listened[id],
  nextTrackId: () => {
    const listened = get().listened;
    return orderedTrackIds().find(id => !listened[id]);
  },
  resetProgress: () => {
    set({ listened: {} });
    kv.set(STORAGE_KEY, {});
  },
}));
