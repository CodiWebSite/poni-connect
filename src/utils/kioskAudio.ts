export const canStartKioskAudio = (hostname: string, isInIframe: boolean): boolean => {
  return Boolean(hostname) && !isInIframe;
};

/**
 * Equivalent addresses for a radio stream, in the order to try them.
 * Some Samsung TVs cannot open the HTTPS stream on a non-standard port,
 * so the Shoutcast legacy path and the plain-HTTP address act as fallbacks.
 */
export const radioStreamCandidates = (url: string): string[] => {
  const list: string[] = [];
  const add = (u: string) => { if (!list.includes(u)) list.push(u); };
  add(url);
  // Panel address (host/PORT/stream) and direct address (host:PORT/stream) are the same stream.
  const panel = url.match(/^(https?:\/\/[^/:]+)\/(\d{2,5})\/(.*)$/i);
  if (panel) add(`${panel[1]}:${panel[2]}/${panel[3]}`);
  if (/^https:\/\//i.test(url)) {
    add(url.replace(/^https:\/\//i, 'http://'));
    if (panel) add(`${panel[1]}:${panel[2]}/${panel[3]}`.replace(/^https:\/\//i, 'http://'));
  }
  return list;
};
