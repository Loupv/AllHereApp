import { ContentCard } from './ContentCard';
import { useTrackDownload } from '../hooks/useTrackDownload';
import type { AudioTrack } from '../content/catalog';

type Props = {
  track: AudioTrack;
  duration?: string;
  meta?: string;
  expanded: boolean;
  onToggle: () => void;
  onPlay: () => void;
  accent?: string;
};

/**
 * ContentCard preset for an audio track in the SM / QM volet lists.
 * Adds the offline-download chip in the expanded panel by wiring the
 * `useTrackDownload` hook to the card's download props. Extracted as
 * its own component because parent screens render cards inside a
 * forEach loop and React hooks can't be called conditionally.
 */
export function TrackCard({ track, duration, meta, expanded, onToggle, onPlay, accent }: Props) {
  const { state, progress, download } = useTrackDownload(track);
  return (
    <ContentCard
      title={track.title}
      duration={duration}
      meta={meta}
      kind="audio"
      description={track.description}
      expanded={expanded}
      onToggle={onToggle}
      onPlay={onPlay}
      accent={accent}
      downloadState={state}
      downloadProgress={progress}
      onDownload={download}
    />
  );
}
