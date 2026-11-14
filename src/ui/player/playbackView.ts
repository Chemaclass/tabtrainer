import { onsetAt, onsetsOf } from '../../core/timeline';
import type { Player, PlayerState } from '../../audio/player';
import type { scoreView } from '../practice/scoreView';
import type { transport } from './transport';

interface PlaybackViews {
  transport: ReturnType<typeof transport>;
  score: Pick<ReturnType<typeof scoreView>, 'clear' | 'highlight' | 'showBar' | 'followLine'>;
  follows: () => boolean;
}

export function playbackView(player: Player, { transport, score, follows }: PlaybackViews, on: { started: () => void; stopped: () => void }) {
  let onsets: number[] = [];
  let wasActive = false;
  return {
    load() { onsets = onsetsOf(player.notes); },
    show(state: PlayerState) {
      transport.show(state);
      if (state.phase === 'counting-in') { wasActive = false; return; }
      const started = player.playing && !wasActive; wasActive = player.playing;
      if (started) on.started();
      if (state.beat === null) { on.stopped(); score.clear(); transport.showBar(null); return; }
      score.highlight(state.playing ? onsetAt(onsets, state.beat) : null);
      const bar = player.barAt(state.beat); transport.showBar(bar);
      const newLine = score.showBar(bar);
      if (follows() && player.playing && (newLine || started)) score.followLine();
    },
  };
}
