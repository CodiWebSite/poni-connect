/**
 * Snapshot / restore of in-progress form data across an automatic reload
 * (triggered when a new service worker takes control after a deploy).
 *
 * Values are stored in sessionStorage, scoped to the current path, and are
 * consumed once (removed after a successful restore). Sensitive fields
 * (passwords, OTP/2FA codes, anything marked data-no-snapshot) are skipped.
 */

const STORAGE_KEY = "icmpp_form_snapshot_v1";
const MAX_AGE_MS = 5 * 60 * 1000;

type SnapshotEntry = { key: string; value: string; type: "value" | "checked" | "html" };
type Snapshot = { path: string; savedAt: number; entries: SnapshotEntry[] };

const SKIPPED_TYPES = new Set(["password", "hidden", "file", "submit", "button", "reset"]);

function isSensitive(el: Element): boolean {
  const html = el as HTMLElement;
  if (html.closest("[data-no-snapshot]")) return true;
  const name = `${html.getAttribute("name") || ""} ${html.id || ""} ${
    html.getAttribute("autocomplete") || ""
  }`.toLowerCase();
  return /pass|parol|otp|cnp|token|secret|pin|code|cod/.test(name);
}

/** Stable-ish identity for a field, so restore lands on the same element. */
function fieldKey(el: Element, index: number): string {
  const html = el as HTMLElement;
  return [
    el.tagName.toLowerCase(),
    html.getAttribute("name") || "",
    html.id || "",
    html.getAttribute("placeholder") || "",
    html.getAttribute("aria-label") || "",
    index,
  ].join("|");
}

function collectFields(): Element[] {
  return Array.from(
    document.querySelectorAll(
      "input, textarea, select, [contenteditable='true'], [contenteditable='']",
    ),
  );
}

/** Serialize current form state into sessionStorage. Safe to call anytime. */
export function saveFormSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    const entries: SnapshotEntry[] = [];

    collectFields().forEach((el, index) => {
      if (isSensitive(el)) return;
      const key = fieldKey(el, index);

      if (el instanceof HTMLInputElement) {
        if (SKIPPED_TYPES.has(el.type)) return;
        if (el.type === "checkbox" || el.type === "radio") {
          if (el.checked) entries.push({ key, value: "1", type: "checked" });
          return;
        }
        if (el.value) entries.push({ key, value: el.value, type: "value" });
        return;
      }

      if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        if (el.value) entries.push({ key, value: el.value, type: "value" });
        return;
      }

      const html = (el as HTMLElement).innerHTML;
      if (html && html !== "<br>") entries.push({ key, value: html, type: "html" });
    });

    if (entries.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    const snapshot: Snapshot = {
      path: window.location.pathname + window.location.search,
      savedAt: Date.now(),
      entries,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* noop — never block the reload */
  }
}

/** Write a value the way React's controlled inputs will notice. */
function setReactValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else (el as HTMLInputElement).value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applySnapshot(snapshot: Snapshot): number {
  const byKey = new Map(snapshot.entries.map((e) => [e.key, e]));
  let restored = 0;

  collectFields().forEach((el, index) => {
    const entry = byKey.get(fieldKey(el, index));
    if (!entry) return;

    if (entry.type === "checked" && el instanceof HTMLInputElement) {
      if (!el.checked) el.click();
      restored++;
      return;
    }

    if (
      entry.type === "value" &&
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement)
    ) {
      if (el.value !== entry.value) setReactValue(el, entry.value);
      restored++;
      return;
    }

    if (entry.type === "html") {
      const html = el as HTMLElement;
      if (!html.innerText.trim()) {
        html.innerHTML = entry.value;
        html.dispatchEvent(new Event("input", { bubbles: true }));
        restored++;
      }
    }
  });

  return restored;
}

/**
 * Restore a snapshot saved for the current path. Retries a few times because
 * React mounts the form asynchronously after the reload.
 */
export function restoreFormSnapshot(onRestored?: (count: number) => void): void {
  if (typeof window === "undefined") return;
  let snapshot: Snapshot | null = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    snapshot = JSON.parse(raw) as Snapshot;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  if (!snapshot) return;

  const stale = Date.now() - snapshot.savedAt > MAX_AGE_MS;
  const samePath = snapshot.path === window.location.pathname + window.location.search;
  if (stale || !samePath) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  let attempts = 0;
  const tick = () => {
    attempts++;
    const restored = applySnapshot(snapshot as Snapshot);
    if (restored > 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      onRestored?.(restored);
      return;
    }
    if (attempts < 10) setTimeout(tick, 400);
    else sessionStorage.removeItem(STORAGE_KEY);
  };
  setTimeout(tick, 300);
}
