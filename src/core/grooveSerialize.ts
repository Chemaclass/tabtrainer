import type { Groove, GrooveGrid } from './groove';

const CHORDS_PER_GROUP = 4;
const BAR_SEPARATOR = ' | ';

function progressionLine(groove: Groove): string {
  const groups: string[] = [];
  const names = groove.progression.map(numeral => numeral.text);
  for (let start = 0; start < names.length; start += CHORDS_PER_GROUP) {
    const group = names.slice(start, start + CHORDS_PER_GROUP);
    groups.push(group.join(' '));
  }
  return `progression: ${groups.join(BAR_SEPARATOR)}`;
}

function headerLines(groove: Groove): string[] {
  const [beats, beatValue] = groove.time;
  const lines = [`title: ${groove.title}`];
  if (groove.genre) lines.push(`genre: ${groove.genre}`);
  if (groove.about) lines.push(`about: ${groove.about}`);
  lines.push(
    `tempo: ${groove.tempo}`,
    `key: ${groove.key}`,
    `time: ${beats}/${beatValue}`,
    `swing: ${groove.swing}`,
    progressionLine(groove),
    `voice: ${groove.voice}`,
    `kit: ${groove.kit}`,
    `fill: ${groove.fill ? 'on' : 'off'}`,
  );
  return lines;
}

/** Bass steps are words, so they keep a space between them; drum and keys steps are single characters. */
function barText(grid: GrooveGrid, steps: readonly string[]): string {
  const stepSeparator = grid.part === 'bass' ? ' ' : '';
  return steps.join(stepSeparator);
}

function gridLine(grid: GrooveGrid, labelWidth: number): string {
  const label = `${grid.part}:`.padEnd(labelWidth);
  const bars = grid.bars.map(steps => barText(grid, steps));
  return `${label} ${bars.join(BAR_SEPARATOR)}`;
}

function gridLines(grids: readonly GrooveGrid[]): string[] {
  const labelWidth = Math.max(0, ...grids.map(grid => grid.part.length + 1));
  return grids.map(grid => gridLine(grid, labelWidth));
}

/** Turn a groove back into the text format; parseGroove reads it back to the same groove. */
export function serializeGroove(groove: Groove): string {
  const lines = headerLines(groove);
  if (groove.grids.length) lines.push('', ...gridLines(groove.grids));
  const trimmed = lines.map(line => line.trimEnd());
  return trimmed.join('\n') + '\n';
}
