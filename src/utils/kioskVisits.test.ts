import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Exercise the actual Samsung-compatible script, not a duplicate implementation.
const html = readFileSync(resolve(process.cwd(), 'public/kiosk.html'), 'utf8');
const start = html.indexOf('var __visits =');
const end = html.indexOf('// ── Settings', start);
if (start < 0 || end < 0) throw new Error('Kiosk visit script not found');
const script = html.slice(start, end);

function setup() {
  const requests: Array<{
    status: number;
    responseText: string;
    timeout: number;
    onload: () => void;
    ontimeout: () => void;
    onerror: () => void;
  }> = [];
  const intervals: Array<{ callback: () => void; delay: number }> = [];
  const box = { style: { display: 'none' } };
  const context = {
    SUPABASE_URL: 'https://example.test',
    SUPABASE_KEY: 'test',
    Date: class extends Date {
      constructor() { super('2026-10-22T05:50:00Z'); }
    },
    document: {
      getElementById: (id: string) => id === 'visitWelcome' ? box : { textContent: '' },
      addEventListener: () => {},
    },
    XMLHttpRequest: class {
      status = 200;
      responseText = '[]';
      timeout = 0;
      onload = () => {};
      ontimeout = () => {};
      onerror = () => {};
      open() {}
      setRequestHeader() {}
      send() { requests.push(this); }
    },
    setInterval: (callback: () => void, delay: number) => intervals.push({ callback, delay }),
  };
  runInNewContext(script, context);
  const reply = (visits: unknown[]) => {
    const request = requests.at(-1);
    if (!request) throw new Error('Expected a pending request');
    request.responseText = JSON.stringify(visits);
    request.onload();
  };
  const refresh = intervals.find(interval => interval.delay === 30000);
  if (!refresh) throw new Error('Expected a 30-second visit refresh');
  return { requests, reply, refresh, box };
}

const activeVisit = { visit_time: '08:50', institution: 'Colegiul test testul', participants: 10 };

describe('kiosk welcome visit synchronization', () => {
  it('removes the cancelled visit on the next 30-second refresh', () => {
    const { requests, reply, refresh, box } = setup();
    reply([activeVisit]);
    expect(box.style.display).toBe('block');
    refresh.callback();
    expect(requests).toHaveLength(2);
    // The RPC omits cancelled visits, even if their saved status is approved.
    reply([]);
    expect(box.style.display).toBe('none');
  });

  it('discards stale visits after a 15-second request timeout and retries', () => {
    const { requests, reply, refresh, box } = setup();
    reply([activeVisit]);
    refresh.callback();
    const pending = requests.at(-1);
    if (!pending) throw new Error('Expected a pending request');
    expect(pending.timeout).toBe(15000);
    pending.ontimeout();
    expect(box.style.display).toBe('none');
    refresh.callback();
    expect(requests).toHaveLength(3);
    reply([activeVisit]);
    expect(box.style.display).toBe('block');
  });

  it('does not overlap slow requests or keep stale visits after an error', () => {
    const { requests, reply, refresh, box } = setup();
    reply([activeVisit]);
    refresh.callback();
    refresh.callback();
    expect(requests).toHaveLength(2);
    const pending = requests.at(-1);
    if (!pending) throw new Error('Expected a pending request');
    pending.status = 503;
    pending.onload();
    expect(box.style.display).toBe('none');
  });
});