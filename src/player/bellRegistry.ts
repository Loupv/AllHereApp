/**
 * Registry of session-bell variants the user can pick from in
 * Settings. Add new bells by dropping a `.mp3` into `assets/audio/`
 * and appending an entry below — they show up automatically in the
 * Settings radio list.
 *
 * The `'none'` entry is special: `source: null` means "no bell at
 * all"; callers must guard before calling `play()`.
 */
export type BellSound = {
  id: string;
  label: string;
  /** `require()` result, or null for the "None" entry. */
  source: number | null;
};

export const BELL_SOUNDS: BellSound[] = [
  { id: 'classic', label: 'Classic', source: require('../../assets/audio/bell.mp3') },
  { id: 'short',   label: 'Short',   source: require('../../assets/audio/bell_short.mp3') },
  { id: 'none',    label: 'None',    source: null },
];

/** Lookup helper used by the QM timer + Player. Falls back to the
 *  default 'classic' bell if the persisted id no longer exists (e.g.
 *  after we remove a sound in a future update). */
export function getBellSource(id: string): number | null {
  const found = BELL_SOUNDS.find(b => b.id === id);
  if (found) return found.source;
  return BELL_SOUNDS[0]?.source ?? null;
}
