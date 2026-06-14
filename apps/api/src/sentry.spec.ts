import { beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.hoisted(() => vi.fn());

vi.mock("@sentry/nestjs", () => ({
  init: initMock
}));

describe("Sentry initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    initMock.mockClear();
  });

  it.each([undefined, "", "   ", "null", " NULL "])("does not initialize when SENTRY_DSN is %j", async (dsn) => {
    if (dsn === undefined) {
      vi.stubEnv("SENTRY_DSN", undefined);
    } else {
      vi.stubEnv("SENTRY_DSN", dsn);
    }

    const sentry = await import("./sentry");

    expect(sentry.resolveSentryOptions(process.env)).toBeNull();
    expect(initMock).not.toHaveBeenCalled();
  });

  it("initializes with the DSN and optional safe configuration from env", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public@example.ingest.sentry.io/123");
    vi.stubEnv("SENTRY_ENVIRONMENT", "staging");
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0.05");

    await import("./sentry");

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith({
      dsn: "https://public@example.ingest.sentry.io/123",
      environment: "staging",
      tracesSampleRate: 0.05
    });
  });
});
