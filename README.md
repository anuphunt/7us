# 7us

Employee management PWA for a single convenience store.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres)
- Netlify hosting

## Local dev

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Netlify

This repo includes `netlify.toml` and uses `@netlify/plugin-nextjs`.

Set env vars in Netlify:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

