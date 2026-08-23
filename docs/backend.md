# TechHub Backend

The backend uses Express, tRPC, Drizzle ORM, MySQL, GitHub OAuth, and JWT session cookies.

## Setup

Copy `.env.example` to `.env`, configure the database and GitHub OAuth values, then run:

```bash
pnpm install
pnpm db:push
pnpm seed
pnpm check
pnpm test
pnpm dev
```

Auth REST routes are mounted under `/api/auth`; tRPC routes are mounted under `/api/trpc`.
