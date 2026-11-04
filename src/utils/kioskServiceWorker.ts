/**
 * The kiosk video-cache worker (/kiosk-sw.js) and the intranet app worker
 * (/sw.js) both want scope "/". A browser keeps only ONE worker per scope, so
 * registering one silently replaces the other — which would kill the intranet's
 * update prompts and its push notifications on that device.
 *
 * The kiosk page therefore registers its own worker only when the intranet
 * worker is not already in charge.
 */

export const APP_SW_PATH = "/sw.js";
export const KIOSK_SW_PATH = "/kiosk-sw.js";

type SwLike = { scriptURL?: string } | null | undefined;
type RegLike = {
  active?: SwLike;
  waiting?: SwLike;
  installing?: SwLike;
} | null | undefined;

/** Path of a worker script URL, "" when it cannot be read. */
export function swScriptPath(scriptURL: string | undefined | null): string {
  if (!scriptURL) return "";
  try {
    return new URL(scriptURL, "http://localhost/").pathname;
  } catch {
    return "";
  }
}

/** True when the intranet worker (sw.js) already owns scope "/". */
export function appWorkerOwnsScope(reg?: RegLike): boolean {
  if (!reg) return false;
  return [reg.active, reg.waiting, reg.installing].some(
    (worker) => swScriptPath(worker?.scriptURL) === APP_SW_PATH,
  );
}

/**
 * Same rule as plain script text, for the standalone kiosk page (public/kiosk.html),
 * which cannot import this module.
 */
export const KIOSK_GUARD_SCRIPT = `
  function __icmppSwPath(u){ if(!u) return ''; try { return new URL(u, location.href).pathname; } catch(e){ return ''; } }
  function __icmppAppWorkerOwns(reg){
    if(!reg) return false;
    return [reg.active, reg.waiting, reg.installing].some(function(w){
      return !!w && __icmppSwPath(w.scriptURL) === '/sw.js';
    });
  }
`;
