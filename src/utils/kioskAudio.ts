export const canStartKioskAudio = (hostname: string, isInIframe: boolean): boolean => {
  return Boolean(hostname) && !isInIframe;
};

/**
 * Equivalent addresses for a radio stream, in the order to try them.
 * Some Samsung TVs cannot open the HTTPS stream on a non-standard port,
 * so the Shoutcast legacy path and the plain-HTTP address act as fallbacks.
 */
export const radioStreamCandidates = (url: string): string[] => {
  const list = [url];
  const base = url.replace(/\/+$/, '');
  const isStream = /\/stream$/.test(base);
  if (isStream) list.push(base.replace(/\/stream$/, '/;'));
  if (/^https:\/\//i.test(url)) {
    const http = url.replace(/^https:\/\//i, 'http://');
    list.push(http);
    if (isStream) list.push(http.replace(/\/+$/, '').replace(/\/stream$/, '/;'));
  }
  return list;
};
