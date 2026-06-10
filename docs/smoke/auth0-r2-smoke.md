# Auth0 + R2 smoke checklist

This checklist validates the real Auth0 and Cloudflare R2 wiring without exposing secrets.

## Automated R2 smoke

Run from the repository root:

```bash
pnpm smoke:r2
```

Expected result:

```text
R2 smoke: saving temporary object smoke-tests/r2-<uuid>.txt
R2 smoke: save/read/delete passed.
```

The script:

- loads `.env` files without printing secret values;
- forces `STORAGE_PROVIDER=r2` for the smoke run;
- saves a temporary object under `smoke-tests/`;
- verifies `exists`, `read`, and `delete`;
- verifies the object no longer exists after deletion.

## Manual Auth0 smoke

1. Set `AUTH0_ORGANIZATION_ID` in the web environment so browser login requests the same Auth0 organization used by the local tenant mapping.

2. Bootstrap the local Auth0 smoke tenant, user, and membership from explicit safe values:

   ```bash
   AUTH0_ORGANIZATION_ID="org_xxx" \
   AUTH0_USER_ID="auth0|xxx" \
   AUTH0_USER_EMAIL="agent@example.com" \
   AUTH0_USER_NAME="Smoke Agent" \
   TENANT_NAME="Smoke Agency" \
   TENANT_SLUG="smoke-agency" \
   TENANT_ROLE="ADMIN" \
   pnpm smoke:auth0
   ```

   Expected: the script prints only local ids, slug, role, and membership id. It refuses `NODE_ENV=production` and must not print Auth0 tokens, client secrets, database URLs, or full environment values.

3. Start the API:

   ```bash
   pnpm --filter @adpropia/api dev
   ```

4. Start the web app:

   ```bash
   pnpm --filter @adpropia/web dev
   ```

5. Open the web app in the browser.

6. If an old app session exists, log out first so the next login receives a fresh organization-scoped Auth0 token.

7. Click the login CTA and complete Auth0 login.

8. Confirm the app redirects back to the dashboard.

9. Confirm local diagnostics show only safe organization context, such as the presence of an Auth0 `org_id`, without printing raw tokens.

10. Confirm the protected dashboard loads user/tenant bootstrap data.

11. Confirm the frontend bridge endpoint works while authenticated:

   ```text
   /api/auth/me
   ```

   Expected: JSON bootstrap payload from the API with `userId`, `tenantId`, `tenantName`, and `role`. The `role` must match local `TenantUser.role`.

12. Check denial paths safely:

   - missing web session or access token returns `401`;
   - missing, inactive, or unauthorized local tenant membership returns `403` from the API path and the bridge surfaces that denial;
   - unreachable API backend returns `502` from `/api/auth/me`.

13. Inspect local logs and response bodies. They may include safe diagnostics such as target URL, token format, `alg`, `kid`, `iss`, `aud`, and whether organization context is present; they must not include raw access tokens, refresh tokens, client secrets, database URLs, or full environment dumps.

14. Log out and confirm protected dashboard access requires authentication again.

## Notes

- Do not paste Auth0 or R2 secrets in chat, issues, PRs, or logs.
- If `/api/auth/me` returns `401`, verify Auth0 session and audience configuration.
- If `/api/auth/me` returns `403`, verify the local `Tenant`, `User`, and active `TenantUser` membership created by `pnpm smoke:auth0`.
- If `/api/auth/me` returns `502`, verify `ADPROPIA_API_BASE_URL` and API availability.
- If the R2 smoke fails with missing env vars, verify `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_REGION`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` locally.
