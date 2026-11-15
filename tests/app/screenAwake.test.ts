import { describe, expect, it } from 'vitest';
import { ScreenAwake } from '../../src/app/screenAwake';

describe('keeping the screen awake', () => {
  it('stays asleep until something runs', () => {
    expect(new ScreenAwake().wanted).toBe(false);
  });
  it('stays awake while continuous scrolling runs after the player pauses', () => {
    const awake = new ScreenAwake();
    awake.keep('player', true); awake.keep('scroll', true);
    awake.keep('player', false); expect(awake.wanted).toBe(true);
    awake.keep('scroll', false); expect(awake.wanted).toBe(false);
  });
  it('counts a source once however often it reports', () => {
    const awake = new ScreenAwake();
    awake.keep('jam', true); awake.keep('jam', true); awake.keep('jam', false);
    expect(awake.wanted).toBe(false);
  });
});
