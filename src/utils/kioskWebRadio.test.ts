import { describe, expect, it } from 'vitest';
import { isTizenTv, mp3FrameLen, mp3LastCut } from './kioskWebRadio';

// MPEG-1 Layer III, 128 kbps, 44.1 kHz, no padding → 417 bytes per frame.
const header = [0xff, 0xfb, 0x90, 0x00];
const frames = (n: number) => {
  const b = new Uint8Array(417 * n + 10);
  for (let f = 0; f < n; f++) b.set(header, f * 417);
  return b;
};

describe('kiosk web radio', () => {
  it('uses the Web Audio radio on Samsung TVs only', () => {
    expect(isTizenTv('Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) SamsungBrowser/4.0')).toBe(true);
    expect(isTizenTv('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0')).toBe(false);
  });
  it('reads the frame length of a 128 kbps stream', () => {
    expect(mp3FrameLen(frames(1), 0)).toBe(417);
  });
  it('cuts the stream only at a whole frame boundary', () => {
    expect(mp3LastCut(frames(5))).toBe(417 * 4);
  });
});
