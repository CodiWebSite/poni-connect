import { describe, expect, it } from 'vitest';
import { canStartKioskAudio } from './kioskAudio';

describe('canStartKioskAudio', () => {
  it('allows audio on the published Lovable address when opened directly on a TV', () => {
    expect(canStartKioskAudio('poni-connect-hub.lovable.app', false)).toBe(true);
  });

  it('allows audio on the institutional address', () => {
    expect(canStartKioskAudio('intranet.icmpp.ro', false)).toBe(true);
  });

  it('keeps the editor preview iframe silent', () => {
    expect(canStartKioskAudio('id-preview--example.lovable.app', true)).toBe(false);
  });
});
