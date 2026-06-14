import { MODULE_METADATA } from "@nestjs/common/constants";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { RolesGuard } from "./common/auth/roles.guard";

type ProviderMetadata = Readonly<{
  provide?: unknown;
  useClass?: unknown;
}>;

function getAppProviders(): readonly ProviderMetadata[] {
  return (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) ?? []) as ProviderMetadata[];
}

describe("AppModule providers", () => {
  it("registers SentryGlobalFilter before other global providers", () => {
    const providers = getAppProviders();

    expect(providers[0]).toEqual({
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    });
  });

  it("keeps the roles guard registered globally", () => {
    expect(getAppProviders()).toContainEqual({
      provide: APP_GUARD,
      useClass: RolesGuard
    });
  });
});
