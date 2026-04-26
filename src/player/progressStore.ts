import { create } from 'zustand';
import { silentMindVolets, qmVolets } from '../content/catalog';

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

export const useProgress = create<State>((set, get) => ({
  listened: {},
  markListened: (id) => set(s => (s.listened[id] ? s : { listened: { ...s.listened, [id]: true } })),
  isListened: (id) => !!get().listened[id],
  nextTrackId: () => {
    const listened = get().listened;
    return orderedTrackIds().find(id => !listened[id]);
  },
  resetProgress: () => set({ listened: {} }),
}));
