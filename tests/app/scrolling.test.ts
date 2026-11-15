import { describe, expect, it, vi } from 'vitest';
import { AutoScroller, followScrollBehavior } from '../../src/app/scrolling';

const setup = (stride = 1) => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0, bottom = false;
  const scroll = vi.fn(), ended = vi.fn();
  const scroller = new AutoScroller({
    request: cb => { frames.set(++next, cb); return next; },
    cancel: id => { frames.delete(id); },
    scroll, atBottom: () => bottom, ended, speed: () => 15, stride: () => stride,
  });
  const tick = (time: number) => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(time)); };
  return { scroller, frames, scroll, ended, tick, reachBottom: () => { bottom = true; } };
};
describe('continuous scrolling', () => {
  it('keeps one animation loop and cancels it on stop', () => {
    const s = setup(); s.scroller.start(); s.scroller.start(); expect(s.frames.size).toBe(1);
    s.tick(0); s.tick(1000); expect(s.scroll).toHaveBeenCalledWith(15);
    s.scroller.stop(); expect(s.frames.size).toBe(0);
    s.scroller.start(); s.tick(10000); expect(s.scroll).toHaveBeenCalledTimes(1);
  });
  it('stops at the bottom and reports completion once', () => {
    const s = setup(); s.scroller.start(); s.reachBottom(); s.tick(0);
    expect(s.frames.size).toBe(0); expect(s.ended).toHaveBeenCalledTimes(1);
    s.tick(1000); expect(s.ended).toHaveBeenCalledTimes(1);
  });
  it('moves a whole stride at a time and keeps the remainder for later', () => {
    const s = setup(40); s.scroller.start(); s.tick(0);
    s.tick(2000); expect(s.scroll).not.toHaveBeenCalled();
    s.tick(3000); expect(s.scroll).toHaveBeenCalledWith(40);
    s.tick(5000); expect(s.scroll).toHaveBeenCalledTimes(1);
    s.tick(6000); expect(s.scroll).toHaveBeenNthCalledWith(2, 40);
  });
});
describe('following playback', () => {
  it('glides to the next line by default', () => {
    expect(followScrollBehavior(false)).toBe('smooth');
  });
  it('jumps to the next line when the player asks for reduced motion', () => {
    expect(followScrollBehavior(true)).toBe('instant');
  });
});
