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

1. Start the API:

   ```bash
   pnpm --filter @adpropia/api dev
   ```

2. Start the web app:

   ```bash
   pnpm --filter @adpropia/web dev
   ```

3. Open the web app in the browser.

4. Click the login CTA and complete Auth0 login.

5. Confirm the app redirects back to the dashboard.

6. Confirm the protected dashboard loads user/tenant bootstrap data.

7. Confirm the frontend bridge endpoint works while authenticated:

   ```text
   /api/auth/me
   ```

   Expected: JSON bootstrap payload from the API.

8. Log out and confirm protected dashboard access requires authentication again.

## Notes

- Do not paste Auth0 or R2 secrets in chat, issues, PRs, or logs.
- If `/api/auth/me` returns `401`, verify Auth0 session and audience configuration.
- If `/api/auth/me` returns `502`, verify `ADPROPIA_API_BASE_URL` and API availability.
- If the R2 smoke fails with missing env vars, verify `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_REGION`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` locally.
