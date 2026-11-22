import type { Jam, Mixer } from '../../app/jam';
import { barChords, isBassInstrument, jamFretboard, type JamFretboardSettings } from '../../app/jamFretboard';
import { FIRST_FRET, LAST_FRET } from '../../app/fretboardMarks';
import { moodLegend, nowText, scaleGroups, type MoodLegend } from '../../app/jamMood';
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

export function jamFretboardView(jam: Jam, mixer: Pick<Mixer, 'plays'>, settings: JamFretboardSettings, engine: Pick<LoopEngine, 'on'>, scaleChanged: () => void) {
  const scaleSelect = byId('jamScale', HTMLSelectElement);
  const bassSelect = byId('jamStrings', HTMLSelectElement);
  const bassField = byId('jamStringsField');
  const degreesToggle = byId('jamDegrees', HTMLButtonElement);
  const chordLine = byId('jamFretboardChord');
  const nextChordLine = byId('jamFretboardNext');
  const nowChord = byId('jamNowChord');
  const nowNotes = byId('jamNowNotes');
  const board = byId('jamFretboardBoard');
  const jobLine = byId('jamFretboardJob');
  const legend = byId('jamMoodLegend');
  const legendNote = byId('jamMoodLegendNote');
  const legendRest = byId('jamMoodLegendRest');
  let bars: readonly GrooveBar[] = [];
  let playingBar = FIRST_BAR;

  scaleSelect.onchange = () => {
    const scale = scaleSelect.value;
    if (!isScaleId(scale) || !jam.setScale(scale)) return;
    scaleChanged();
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
    scaleSelect.replaceChildren(...scaleGroups(jam.mood, jam.scales).flatMap(({ label, scales }) => {
      const options = scales.map(id => new Option(scaleById(id).name, id));
      if (label === null) return options;
      const group = document.createElement('optgroup');
      group.label = label;
      group.append(...options);
      return [group];
    }));
    setSelectValue(scaleSelect, jam.scale);
    setSelectValue(bassSelect, settings.bass);
    bassField.hidden = mixer.plays !== 'bass';
    degreesToggle.setAttribute('aria-pressed', String(settings.labels === 'degrees'));
  }

  function draw() {
    if (!bars.length) return;
    const { chord, nextChord } = barChords(bars, playingBar);
    const moodNote = moodLegend(jam.mood, jam.key, jam.scale);
    const drawing = jamFretboard({
      instrument: settings.instrumentFor(mixer.plays),
      key: jam.key,
      scale: jam.scale,
      labels: settings.labels,
      chord,
      nextChord,
      moodNote: moodNote?.pitchClass ?? null,
    });
    showMoodNote(moodNote);
    const now = nowText(jam, playingBar);
    jobLine.textContent = now.job;
    nextChordLine.textContent = drawing.nextChordText;
    nextChordLine.hidden = !now.showNext;
    nowChord.textContent = drawing.chordName;
    nowNotes.textContent = drawing.chordNotes;
    announceOnce(chordLine, drawing.chordText);
    const svg = fretboardSvg({
      openNames: drawing.openNames,
      firstFret: FIRST_FRET,
      lastFret: LAST_FRET,
      marks: drawing.marks,
      label: drawing.description,
    });
    // The board is sized from its own shape, so it can shrink to end on the first screen
    const box = svg.viewBox.baseVal;
    if (box?.height) board.style.setProperty('--board-ratio', String(box.width / box.height));
    board.replaceChildren(svg);
  }

  /** The first sentence names the note in bold, the rest says where it sits; a scale without the note says so in plain text. */
  function showMoodNote(note: MoodLegend | null) {
    legend.hidden = note === null;
    if (note === null) {
      // The Scale control names this line as its description, and a hidden line is still read
      legendNote.textContent = legendRest.textContent = '';
      return;
    }
    legend.toggleAttribute('data-missing', note.pitchClass === null);
    const split = note.pitchClass === null ? 0 : note.sentence.indexOf('. ') + 1;
    legendNote.textContent = note.sentence.slice(0, split);
    legendRest.textContent = note.sentence.slice(split).trimStart();
  }

  /** Redraws for a new groove, key, progression, scale, instrument or label choice. */
  function show(timelineBars: readonly GrooveBar[] = bars) {
    bars = timelineBars;
    showControls();
    draw();
  }

  return { show };
}
