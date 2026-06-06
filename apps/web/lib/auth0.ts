import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { parseServerEnv } from "./env";

const env = parseServerEnv(process.env);

export const auth0 = new Auth0Client({
  secret: env.AUTH0_SECRET,
  clientId: env.AUTH0_CLIENT_ID,
  clientSecret: env.AUTH0_CLIENT_SECRET,
  appBaseUrl: env.APP_BASE_URL,
  domain: env.AUTH0_DOMAIN,
  authorizationParameters: {
    audience: env.AUTH0_AUDIENCE,
    scope: "openid profile email",
  },
});
