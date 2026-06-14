import * as Sentry from "@sentry/nestjs";

type SentryOptions = Parameters<typeof Sentry.init>[0];
type SentryInit = (options: SentryOptions) => void;

function readOptionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : undefined;
}

function readOptionalSampleRate(value: string | undefined): number | undefined {
  const trimmed = readOptionalEnv(value);

  if (!trimmed) {
    return undefined;
  }

  const sampleRate = Number(trimmed);

  return Number.isFinite(sampleRate) && sampleRate >= 0 && sampleRate <= 1 ? sampleRate : undefined;
}

export function resolveSentryOptions(env: NodeJS.ProcessEnv = process.env): SentryOptions | null {
  const dsn = readOptionalEnv(env.SENTRY_DSN);

  if (!dsn) {
    return null;
  }

  const environment = readOptionalEnv(env.SENTRY_ENVIRONMENT);
  const tracesSampleRate = readOptionalSampleRate(env.SENTRY_TRACES_SAMPLE_RATE);

  return {
    dsn,
    ...(environment ? { environment } : {}),
    ...(tracesSampleRate === undefined ? {} : { tracesSampleRate })
  };
}

export function initializeSentry(env: NodeJS.ProcessEnv = process.env, init: SentryInit = Sentry.init): boolean {
  const options = resolveSentryOptions(env);

  if (!options) {
    return false;
  }

  init(options);

  return true;
}

initializeSentry();
