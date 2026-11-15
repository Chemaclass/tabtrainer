const bound = (value: number, fallback: number, count: number) => Math.max(1, Math.min(Math.max(1, count), Number.isFinite(value) ? Math.trunc(value) : fallback));

export class Passage {
  private count = 0;
  private first = 1;
  private last = 1;
  private repeat = false;
  private selected = 0;

  setSong(count: number, reset: boolean) {
    this.count = count; this.deselect();
    if (reset || this.last > count) { this.first = 1; this.last = Math.max(1, count); }
  }
  setRange(first: number, last: number, repeat: boolean) {
    this.first = bound(first, 1, this.count);
    this.last = Math.max(this.first, bound(last, this.count, this.count));
    this.repeat = repeat;
    if (this.range() && !this.includes(this.selected)) this.selected = this.first;
  }
  clear() { this.first = 1; this.last = Math.max(1, this.count); this.repeat = false; }
  deselect() { this.selected = 0; }
  select(bar: number) {
    if (!Number.isInteger(bar) || bar < 1 || bar > this.count) return false;
    if (this.range() && !this.includes(bar)) this.clear();
    this.selected = bar; return true;
  }
  startAt(bar: number) { this.setRange(bar, this.last, this.repeat); }
  endAt(bar: number) { this.setRange(Math.min(this.first, bar), bar, this.repeat); }
  loopTo(bar: number) {
    if (!Number.isInteger(bar) || bar < 1 || bar > this.count) return;
    const loop = this.range();
    if (!loop) this.setRange(bar, bar, true);
    else if (this.isLoopEnd(bar)) this.clear();
    else { this.repeat = true; if (bar < loop[0]) this.startAt(bar); else this.endAt(bar); }
  }
  loopSelection() { if (this.selected) this.setRange(this.selected, this.selected, true); }
  isLoopEnd(bar: number) { const loop = this.range(); return loop !== null && (bar === loop[0] || bar === loop[1]); }
  loopsSelection() { return this.selected > 0 && this.repeat && this.first === this.selected && this.last === this.selected; }
  toggleRepeat() { this.setRange(this.first, this.last, !this.repeat); }
  startAtSelection() { if (this.selected) this.startAt(this.selected); }
  endAtSelection() { if (this.selected) this.endAt(this.selected); }
  selectStart() { this.selected = this.first; }
  includes(bar: number) { return bar >= this.first && bar <= this.last; }
  label() {
    const range = this.range();
    if (!range) return null;
    const [first, last] = range;
    if (first === last) return this.repeat ? `Loop ${first}` : `Bar ${first}`;
    return this.repeat ? `Loop ${first}-${last}` : `Bars ${first}-${last}`;
  }
  range(): [number, number] | null { return this.repeat || this.first > 1 || this.last < this.count ? [this.first, this.last] : null; }
  summary() {
    return `${this.selected ? `Selected bar ${this.selected}. ` : ''}${this.range() ? `Bars ${this.first}-${this.last}, ${this.repeat ? 'repeating' : 'play once'}.` : 'Whole song, play once.'}`;
  }
  snapshot() { return { count: this.count, first: this.first, last: this.last, repeat: this.repeat, selected: this.selected, active: this.range() !== null }; }
}
