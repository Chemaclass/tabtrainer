export type AwakeSource = 'player' | 'jam' | 'scroll';

export class ScreenAwake {
  private sources = new Set<AwakeSource>();
  keep(source: AwakeSource, active: boolean) {
    if (active) this.sources.add(source); else this.sources.delete(source);
  }
  get wanted() { return this.sources.size > 0; }
}
