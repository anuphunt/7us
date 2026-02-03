# Local development env vars

Create a file named `.env.local` in the project root (do **not** commit it) with:

```bash
# Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# Session signing secret (generate a long random string)
SESSION_SECRET=

# Optional: pin a specific store row UUID. If empty, the API uses the first store row.
STORE_ID=
```

Notes:
- `NEXT_PUBLIC_*` values come from Supabase Project Settings → API
- `SUPABASE_SECRET_KEY` should be the **service role** key (server-only)
- `SESSION_SECRET` should be long and random (32+ chars)

## Local verification checklist
1) Ensure you have at least 1 `stores` row (so `/api/store` can return a store).
2) Seed an admin user in the `users` table (example: `00/1234`) so you can log in and set the geofence.

> Security note: the current code compares PINs as plaintext (`pin_hash === pin`). This must be replaced with Argon2id before real use.
