# Environment Variables

Use service-specific env files as the local source of truth. The root `.env` is optional and only for ad-hoc shell commands run from the repository root.

## Local Setup

| Service | Local file | Example file | Owner |
| --- | --- | --- | --- |
| Web app | `apps/web/.env.local` | `apps/web/.env.local.example` | Next.js and Vercel-facing vars |
| API | `apps/api/.env` | `apps/api/.env.example` | Nest API and Railway-facing vars |
| Database | `packages/database/.env` | `packages/database/.env.example` | Prisma CLI local `DATABASE_URL` |

Copy only the example for the service you are configuring. Keep real values out of git.

## Deployment Sources

| Target | Configure env vars in |
| --- | --- |
| Vercel web app | Vercel project settings for `apps/web` |
| Railway API | Railway service variables for `apps/api` |
| Local Prisma CLI | `packages/database/.env` |

## Root `.env`

Do not use root `.env` as shared configuration. It can exist locally for one-off root commands, but service runtimes should read from their own env files or deployment platform variables.

## Safety Checklist

- Real env files stay ignored: `.env`, `.env.*`, `apps/api/.env`, `apps/web/.env.local`, and `packages/database/.env`.
- Example env files are tracked and contain placeholders only.
- Do not copy Vercel web secrets into Railway API variables, or API secrets into the web app unless that service reads them.
