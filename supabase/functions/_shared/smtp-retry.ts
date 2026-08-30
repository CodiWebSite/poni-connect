/**
 * SMTP retry + throttling helper.
 *
 * Wraps nodemailer's `transporter.sendMail` so that *temporary* SMTP failures
 * (connection resets, DNS hiccups, 4xx greylisting / "too many connections")
 * are retried with bounded exponential backoff + jitter, while *permanent*
 * failures (5xx, invalid recipient, auth errors) fail fast — retrying them
 * would only produce the same error.
 *
 * It also applies a global throttle so a batch of emails (reminders, HR
 * notifications) never opens more than one SMTP conversation at a time and
 * keeps a minimum interval between sends. This prevents the provider from
 * rate-limiting or temporarily blocking the sender.
 */

export interface SendRetryOptions {
  /** Max total attempts (first try included). Default 4. */
  maxAttempts?: number;
  /** Base backoff delay in ms. Default 800. */
  baseDelayMs?: number;
  /** Upper bound for a single backoff delay. Default 8000. */
  maxDelayMs?: number;
  /** Minimum spacing between two sends, in ms. Default 350. */
  minIntervalMs?: number;
  /** Label used in logs (function name / email type). */
  label?: string;
}

const DEFAULTS = {
  maxAttempts: 4,
  baseDelayMs: 800,
  maxDelayMs: 8_000,
  minIntervalMs: 350,
};

/** Serializes all sends in this isolate and spaces them out. */
let sendChain: Promise<unknown> = Promise.resolve();
let lastSendAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** SMTP status codes / socket errors that are worth retrying. */
const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "EPIPE",
  "EAI_AGAIN",
  "ESOCKET",
  "ETLS",
  "EDNS",
  "ERR_SOCKET_CLOSED",
]);

export function isTransientSmtpError(err: unknown): boolean {
  const e = err as { code?: string; responseCode?: number; message?: string } | null;
  if (!e) return false;

  if (e.code && TRANSIENT_CODES.has(e.code)) return true;

  // 4xx = temporary per RFC 5321 (greylisting, mailbox busy, throttling).
  if (typeof e.responseCode === "number") {
    return e.responseCode >= 400 && e.responseCode < 500;
  }

  const msg = (e.message || "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("socket close") ||
    msg.includes("connection closed") ||
    msg.includes("try again") ||
    msg.includes("too many") ||
    msg.includes("greylist") ||
    msg.includes("temporar") ||
    msg.includes("rate limit") ||
    /\b4\d\d\b/.test(msg)
  );
}

function backoff(attempt: number, opts: Required<Pick<SendRetryOptions, "baseDelayMs" | "maxDelayMs">>) {
  const exp = Math.min(opts.baseDelayMs * 2 ** (attempt - 1), opts.maxDelayMs);
  // full jitter, keeps at least half the delay
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

/**
 * Send one email through the throttle queue, retrying temporary failures.
 * Throws the last error when all attempts are exhausted or the error is permanent.
 */
export function sendMailWithRetry(
  transporter: { sendMail: (opts: Record<string, unknown>) => Promise<unknown> },
  mailOptions: Record<string, unknown>,
  options: SendRetryOptions = {},
): Promise<any> {
  // eslint-disable-next-line -eslint/no-explicit-any
  const cfg = { ...DEFAULTS, ...options };
  const label = options.label || "email";
  const to = String(mailOptions.to ?? "");

  const task = sendChain.then(async () => {
    const since = Date.now() - lastSendAt;
    if (since < cfg.minIntervalMs) await sleep(cfg.minIntervalMs - since);

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
      try {
        const info = await transporter.sendMail(mailOptions);
        lastSendAt = Date.now();
        if (attempt > 1) {
          console.log(`[smtp] ${label} sent to ${to} after ${attempt} attempts`);
        }
        return info;
      } catch (err) {
        lastError = err;
        lastSendAt = Date.now();
        const transient = isTransientSmtpError(err);
        const msg = (err as Error)?.message ?? String(err);

        if (!transient) {
          console.error(`[smtp] ${label} permanent failure for ${to}: ${msg}`);
          throw err;
        }
        if (attempt === cfg.maxAttempts) {
          console.error(
            `[smtp] ${label} giving up for ${to} after ${attempt} attempts: ${msg}`,
          );
          throw err;
        }
        const delay = backoff(attempt, cfg);
        console.warn(
          `[smtp] ${label} temporary failure for ${to} (attempt ${attempt}/${cfg.maxAttempts}): ${msg} — retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  });

  // Keep the chain alive even when this send fails.
  sendChain = task.catch(() => undefined);
  return task;
}

/**
 * Best-effort variant for bulk sends: never throws, returns whether it worked.
 */
export async function trySendMail(
  transporter: { sendMail: (opts: Record<string, unknown>) => Promise<unknown> },
  mailOptions: Record<string, unknown>,
  options: SendRetryOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendMailWithRetry(transporter, mailOptions, options);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? String(err) };
  }
}
