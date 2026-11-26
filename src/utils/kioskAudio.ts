export const canStartKioskAudio = (hostname: string, isInIframe: boolean): boolean => {
  return Boolean(hostname) && !isInIframe;
};
