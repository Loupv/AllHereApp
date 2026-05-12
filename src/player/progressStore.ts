import { create } from 'zustand';
import { silentMindVolets, qmVolets, introAudios, QM_TO_SM_PAIRING } from '../content/catalog';
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

/**
 * Sequential lock walk:
 *
 *  - Introduction tracks (intro-1, intro-2, intro-4) are unlocked from
 *    the start — the user lands on a fresh page with the prologue
 *    immediately accessible.
 *  - Each numbered Part has its own internal SM chain. The first SM
 *    track of every Part (p1-1, p2-1, p3-1) is unlocked at start; SM
 *    track N+1 inside the same Part unlocks once SM track N has been
 *    listened to (the "≥ 80%" threshold elsewhere in the player).
 *  - QM tracks unlock alongside their matching SM track — matched via
 *    the explicit `QM_TO_SM_PAIRING` table in catalog.ts (titles can't
 *    be relied on because the QM versions are renamed, e.g. "QM3 —
 *    Breathing Body" pairs with the SM "Breath and Self-Observation").
 *    A QM with a paired SM inherits its lock state; a QM with no pair
 *    declared (or the SM doesn't exist) stays unlocked as an orphan.
 *  - Coming-soon tracks stay locked regardless (they're rendered with
 *    a separate "SOON" treatment in the list).
 *
 * Pure function over `listened` so the same logic can be called from
 * the SM and QM detail pages (and from the Start screen if we want to
 * surface a "next" hint). Returns `true` when the track is reachable.
 */
export function isTrackUnlocked(
  trackId: string,
  listened: Record<string, true>,
): boolean {
  // Strict-sequential SM journey: only Welcome (intro-1) is unlocked
  // by default; every other SM unlocks once the PREVIOUS SM in
  // catalog journey order has been listened. QMs unlock once their
  // paired SM has been listened (catalog QM_TO_SM_PAIRING table).
  // Quick-meditation pills on the Start screen (home-1min, etc.)
  // are not in the journey at all and stay permissive — caller
  // shouldn't be asking us about them, but if they do we return
  // true rather than blocking access.
  //
  // The previous logic had per-part cross-gates and "intros are
  // always free" — the user simplified to a single sequential rule
  // so first-launch reads as one clear next step (= Welcome) instead
  // of the whole intro + p1-1 cluster offered at once.

  // Build the SM journey order: catalog order across every volet,
  // skipping coming-soon. intro-1 lives at index 0.
  const smJourney: string[] = [];
  for (const v of silentMindVolets) {
    for (const t of v.tracks) {
      if (t.comingSoon) continue;
      smJourney.push(t.id);
    }
  }
  const smIdx = smJourney.indexOf(trackId);
  if (smIdx >= 0) {
    if (smIdx === 0) return true; // Welcome — always unlocked
    return !!listened[smJourney[smIdx - 1]];
  }

  // QM tracks — both the SM-mirrored qmTracks and the standalone
  // qmVolets resolve via QM_TO_SM_PAIRING. The QM is unlocked once
  // its paired SM has been listened.
  const pairedSmId = QM_TO_SM_PAIRING[trackId];
  if (pairedSmId !== undefined) {
    return !!listened[pairedSmId];
  }

  // Track exists in qmVolets but has no pairing declared → orphan,
  // treat as unlocked.
  for (const v of qmVolets) {
    if (v.tracks.some(t => t.id === trackId)) return true;
  }

  // Unknown id (Start screen quick-meditation pills, etc.) — be
  // permissive; the lock model is for the journey volets only.
  return true;
}

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
