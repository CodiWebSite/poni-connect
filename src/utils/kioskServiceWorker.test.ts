import { describe, expect, it } from "vitest";
import { appWorkerOwnsScope, swScriptPath } from "./kioskServiceWorker";

describe("kiosk worker registration guard", () => {
  it("skips the kiosk worker when the intranet worker is active", () => {
    expect(
      appWorkerOwnsScope({ active: { scriptURL: "https://intranet.icmpp.ro/sw.js" } }),
    ).toBe(true);
  });

  it("also skips it when the intranet worker is still installing or waiting", () => {
    expect(
      appWorkerOwnsScope({ installing: { scriptURL: "https://intranet.icmpp.ro/sw.js" } }),
    ).toBe(true);
    expect(
      appWorkerOwnsScope({ waiting: { scriptURL: "https://intranet.icmpp.ro/sw.js" } }),
    ).toBe(true);
  });

  it("allows the kiosk worker when only the kiosk worker exists", () => {
    expect(
      appWorkerOwnsScope({ active: { scriptURL: "https://intranet.icmpp.ro/kiosk-sw.js" } }),
    ).toBe(false);
  });

  it("allows the kiosk worker when nothing is registered", () => {
    expect(appWorkerOwnsScope(null)).toBe(false);
    expect(appWorkerOwnsScope(undefined)).toBe(false);
    expect(appWorkerOwnsScope({})).toBe(false);
  });

  it("never treats a junk worker URL as the intranet worker", () => {
    expect(appWorkerOwnsScope({ active: { scriptURL: "::::" } })).toBe(false);
    expect(appWorkerOwnsScope({ active: { scriptURL: "https://evil.test/sw.js.evil" } })).toBe(
      false,
    );
    expect(swScriptPath(undefined)).toBe("");
  });
});
