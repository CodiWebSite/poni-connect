/**
 * Radio playback through Web Audio for Samsung (Tizen) TVs.
 * Tizen uses a single hardware media player: the muted presentation video
 * silently takes the sound away from an <audio> element. Decoding the MP3
 * stream in software and playing it through Web Audio avoids that conflict.
 */
const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SR = [44100, 48000, 32000];

export const isTizenTv = (ua: string): boolean => /Tizen|SMART-TV|SmartTV|SamsungBrowser/i.test(ua);

/** Length in bytes of the MP3 (Layer III) frame starting at i, or 0 if no valid header. */
export const mp3FrameLen = (b: Uint8Array, i: number): number => {
  if (i + 3 >= b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return 0;
  const ver = (b[i + 1] >> 3) & 3;
  if (ver === 1 || ((b[i + 1] >> 1) & 3) !== 1) return 0;
  const bri = (b[i + 2] >> 4) & 15;
  const sri = (b[i + 2] >> 2) & 3;
  if (bri === 0 || bri === 15 || sri === 3) return 0;
  const pad = (b[i + 2] >> 1) & 1;
  const sr = SR[sri] / (ver === 3 ? 1 : ver === 2 ? 2 : 4);
  const br = (ver === 3 ? BR1 : BR2)[bri] * 1000;
  return Math.floor(((ver === 3 ? 144 : 72) * br) / sr) + pad;
};

/** Offset of the last complete, verified frame boundary in the buffer, or -1. */
export const mp3LastCut = (b: Uint8Array): number => {
  for (let i = b.length - 8; i > 0; i--) {
    const len = mp3FrameLen(b, i);
    if (len && i + len + 3 < b.length && mp3FrameLen(b, i + len)) return i + len;
  }
  return -1;
};

export const webRadioSupported = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(((window as any).AudioContext || (window as any).webkitAudioContext) && window.fetch && (window as any).ReadableStream);

export type WebRadioState = 'connecting' | 'needGesture' | 'playing' | 'fail';

export interface WebRadio {
  start(): void;
  unlock(): void;
  stop(): void;
}

export const createWebRadio = (
  sources: string[],
  volume: number,
  onState: (state: WebRadioState) => void,
): WebRadio => {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AC();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  gain.connect(ctx.destination);
  const CHUNK = 80 * 1024;
  let idx = 0, failedAll = 0, gen = 0, stopped = false, playing = false, nextTime = 0, lastData = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let pending: Uint8Array | null = null;
  let watchdog: number | null = null;
  let chain: Promise<void> = Promise.resolve();
  ctx.onstatechange = () => { if (playing && !stopped && ctx.state === 'running') onState('playing'); };

  const concat = (a: Uint8Array | null, b: Uint8Array) => {
    if (!a) return b;
    const c = new Uint8Array(a.length + b.length); c.set(a, 0); c.set(b, a.length); return c;
  };
  const decode = (bytes: Uint8Array, myGen: number) => {
    chain = chain.then(() => new Promise<void>((resolve) => {
      if (myGen !== gen) return resolve();
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      let done = false;
      const ok = (buf: AudioBuffer) => {
        if (done) return; done = true;
        if (myGen === gen && buf && buf.duration > 0) {
          const now = ctx.currentTime;
          if (ctx.state !== 'running' && nextTime - now > 20) return resolve();
          if (nextTime < now + 0.05) nextTime = now + 0.25;
          const src = ctx.createBufferSource(); src.buffer = buf; src.connect(gain);
          src.start(nextTime); nextTime += buf.duration;
          if (!playing) { playing = true; failedAll = 0; onState(ctx.state === 'running' ? 'playing' : 'needGesture'); }
        }
        resolve();
      };
      const bad = () => { if (done) return; done = true; resolve(); };
      try {
        const pr = ctx.decodeAudioData(ab, ok, bad) as unknown as Promise<AudioBuffer> | undefined;
        if (pr && typeof pr.then === 'function') pr.then(ok, bad);
      } catch { bad(); }
    }));
  };
  const stopNet = () => {
    gen++;
    if (watchdog) { window.clearInterval(watchdog); watchdog = null; }
    try { reader?.cancel(); } catch { /* ignore */ }
    reader = null; pending = null;
  };
  const next = () => {
    stopNet();
    if (stopped) return;
    idx = (idx + 1) % sources.length;
    failedAll++;
    if (failedAll >= sources.length && !playing) { onState('fail'); return; }
    window.setTimeout(connect, playing ? 2000 : 300);
  };
  const connect = () => {
    if (stopped) return;
    stopNet();
    const myGen = gen;
    playing = false; nextTime = 0;
    onState('connecting');
    lastData = Date.now();
    watchdog = window.setInterval(() => { if (myGen === gen && Date.now() - lastData > 15000) next(); }, 3000);
    const src = sources[idx];
    fetch(src + (src.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', mode: 'cors' })
      .then((res) => {
        if (myGen !== gen) return;
        if (!res.ok || !res.body) throw new Error('http ' + res.status);
        const r = res.body.getReader();
        reader = r;
        const step = (chunk: ReadableStreamReadResult<Uint8Array>): Promise<void> | void => {
          if (myGen !== gen) return;
          if (chunk.done) { next(); return; }
          lastData = Date.now();
          pending = concat(pending, chunk.value);
          if (pending.length >= CHUNK) {
            const cut = mp3LastCut(pending);
            if (cut > 0) {
              const part = pending.subarray(0, cut);
              pending = pending.slice(cut);
              decode(part, myGen);
            } else if (pending.length > CHUNK * 4) pending = null;
          }
          return r.read().then(step);
        };
        return r.read().then(step);
      })
      .catch(() => { if (myGen === gen) next(); });
  };

  return {
    start: () => { stopped = false; try { void ctx.resume(); } catch { /* ignore */ } connect(); },
    unlock: () => { try { void ctx.resume(); } catch { /* ignore */ } },
    stop: () => { stopped = true; stopNet(); try { void ctx.close(); } catch { /* ignore */ } },
  };
};
