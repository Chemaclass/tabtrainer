import type { Jam, Mixer } from '../../app/jam';
import { BASS_INSTRUMENTS, barChords, jamFretboard, type JamFretboardSettings } from '../../app/jamFretboard';
import { FIRST_FRET, LAST_FRET } from '../../app/fretboardSheet';
import type { LoopEngine } from '../../audio/loopEngine';
import type { GrooveBar } from '../../core/grooveTimeline';
import { isScaleId, scaleById } from '../../core/scales';
import { byId } from '../dom';
import { fretboardSvg } from '../fretboard/fretboardSvg';
import { setSelectValue } from '../shell/dropdown';

const FIRST_BAR = 0;

export function jamFretboardView(jam: Jam, mixer: Pick<Mixer, 'plays'>, settings: JamFretboardSettings, engine: Pick<LoopEngine, 'on'>) {
  const scale = byId('jamScale', HTMLSelectElement);
  const strings = byId('jamStrings', HTMLSelectElement);
  const stringsField = byId('jamStringsField');
  const degrees = byId('jamDegrees', HTMLButtonElement);
  const now = byId('jamFretboardNow');
  const next = byId('jamFretboardNext');
  const board = byId('jamFretboardBoard');
  let bars: readonly GrooveBar[] = [];
  let playingBar = FIRST_BAR;

  scale.onchange = () => {
    if (isScaleId(scale.value) && jam.setScale(scale.value)) show();
  };
  strings.onchange = () => {
    const bass = BASS_INSTRUMENTS.find(id => id === strings.value);
    if (bass && settings.setBass(bass)) show();
  };
  degrees.onclick = () => {
    settings.toggleLabels();
    show();
  };
  engine.on(state => showBar(state.bar ?? FIRST_BAR));

  function showBar(bar: number) {
    if (bar === playingBar) return;
    playingBar = bar;
    draw();
  }

  function showControls() {
    scale.replaceChildren(...jam.scales.map(id => new Option(scaleById(id).name, id)));
    setSelectValue(scale, jam.scale);
    setSelectValue(strings, settings.bass);
    stringsField.hidden = mixer.plays !== 'bass';
    degrees.setAttribute('aria-pressed', String(settings.labels === 'degrees'));
  }

  function draw() {
    if (!bars.length) return;
    const { chord, next: nextChord } = barChords(bars, playingBar);
    const drawing = jamFretboard({
      instrument: settings.instrumentFor(mixer.plays),
      key: jam.key,
      scale: jam.scale,
      labels: settings.labels,
      chord,
      next: nextChord,
    });
    if (now.textContent !== drawing.summary) now.textContent = drawing.summary;
    next.textContent = drawing.next;
    board.replaceChildren(fretboardSvg({
      openNames: drawing.openNames,
      firstFret: FIRST_FRET,
      lastFret: LAST_FRET,
      marks: drawing.marks,
      label: drawing.description,
    }));
  }

  /** Redraws for a new groove, key, progression, scale, instrument or label choice. */
  function show(timelineBars: readonly GrooveBar[] = bars) {
    bars = timelineBars;
    showControls();
    draw();
  }

  return { show };
}
