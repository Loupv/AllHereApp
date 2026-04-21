import { create } from 'zustand';
import { silentMindVolets } from '../content/catalog';

type State = {
  listened: Record<string, true>;
  markListened: (id: string) => void;
  isListened: (id: string) => boolean;
  nextTrackId: () => string | undefined;
};

const orderedTrackIds = (): string[] =>
  silentMindVolets.flatMap(v =>
    [...v.tracks, ...(v.qmTracks ?? [])]
      .filter(t => !t.comingSoon)
      .map(t => t.id),
  );

export const useProgress = create<State>((set, get) => ({
  listened: {},
  markListened: (id) => set(s => (s.listened[id] ? s : { listened: { ...s.listened, [id]: true } })),
  isListened: (id) => !!get().listened[id],
  nextTrackId: () => {
    const listened = get().listened;
    return orderedTrackIds().find(id => !listened[id]);
  },
}));
