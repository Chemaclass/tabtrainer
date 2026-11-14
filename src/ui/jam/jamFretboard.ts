import type { Jam, Mixer } from '../../app/jam';
import { barChords, isBassInstrument, jamFretboard, type JamFretboardSettings } from '../../app/jamFretboard';
import { FIRST_FRET, LAST_FRET } from '../../app/fretboardSheet';
import type { LoopEngine } from '../../audio/loopEngine';
import type { GrooveBar } from '../../core/grooveTimeline';
import { isScaleId, scaleById } from '../../core/scales';
import { byId } from '../dom';
import { fretboardSvg } from '../fretboard/fretboardSvg';
import { setSelectValue } from '../shell/dropdown';

const FIRST_BAR = 0;

/** A live region reads every text change aloud, so the same chord twice in a row stays silent. */
function announceOnce(liveElement: HTMLElement, text: string) {
  if (liveElement.textContent !== text) liveElement.textContent = text;
}

export function jamFretboardView(jam: Jam, mixer: Pick<Mixer, 'plays'>, settings: JamFretboardSettings, engine: Pick<LoopEngine, 'on'>) {
  const scaleSelect = byId('jamScale', HTMLSelectElement);
  const bassSelect = byId('jamStrings', HTMLSelectElement);
  const bassField = byId('jamStringsField');
  const degreesToggle = byId('jamDegrees', HTMLButtonElement);
  const chordLine = byId('jamFretboardChord');
  const scaleLine = byId('jamFretboardScale');
  const nextChordLine = byId('jamFretboardNext');
  const board = byId('jamFretboardBoard');
  let bars: readonly GrooveBar[] = [];
  let playingBar = FIRST_BAR;

  scaleSelect.onchange = () => {
    const scale = scaleSelect.value;
    if (!isScaleId(scale) || !jam.setScale(scale)) return;
    show();
  };
  bassSelect.onchange = () => {
    const bass = bassSelect.value;
    if (!isBassInstrument(bass) || !settings.setBass(bass)) return;
    show();
  };
  degreesToggle.onclick = () => {
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
    scaleSelect.replaceChildren(...jam.scales.map(id => new Option(scaleById(id).name, id)));
    setSelectValue(scaleSelect, jam.scale);
    setSelectValue(bassSelect, settings.bass);
    bassField.hidden = mixer.plays !== 'bass';
    degreesToggle.setAttribute('aria-pressed', String(settings.labels === 'degrees'));
  }

  function draw() {
    if (!bars.length) return;
    const { chord, nextChord } = barChords(bars, playingBar);
    const drawing = jamFretboard({
      instrument: settings.instrumentFor(mixer.plays),
      key: jam.key,
      scale: jam.scale,
      labels: settings.labels,
      chord,
      nextChord,
    });
    announceOnce(chordLine, drawing.chordText);
    scaleLine.textContent = drawing.scaleText;
    nextChordLine.textContent = drawing.nextChordText;
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
