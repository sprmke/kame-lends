# Cloudflare R2 object storage

Kame Lends stores valid IDs, e-signatures, payment receipts, and contract signing captures in a **private** Cloudflare R2 bucket when configured. Postgres keeps a `storage:{objectKey}` reference in the existing URL columns; legacy `data:image/...` values still work until backfilled.

## Provision R2

1. Cloudflare dashboard → R2 → Create bucket (e.g. `kame-lends`). Keep it **private**.
2. R2 → Manage R2 API tokens → Create API token with Object Read & Write on that bucket.
3. Copy account ID, access key ID, and secret access key.

## Environment

Set locally in `.env.local` and in Vercel (Production + Preview as needed):

```bash
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="kame-lends"
# Optional override; default is https://<account_id>.r2.cloudflarestorage.com
# R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
PUBLIC_R2_ENABLED="true"
```

Without these vars (or with `PUBLIC_R2_ENABLED` unset), uploads stay as compressed data URLs in Postgres.

## API surface

| Route                                   | Role                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `POST /api/storage/upload`              | Authenticated server-side PUT to R2 (browser uploads here; no R2 CORS needed) |
| `POST /api/storage/upload-url`          | Optional presigned PUT (requires bucket CORS if called from the browser)      |
| `GET /api/storage/object?ref=storage:…` | RBAC check, then 302 to a short-lived presigned GET                           |

### Optional: R2 bucket CORS (only for direct browser → R2 presigned PUT)

Not required for normal app uploads (`POST /api/storage/upload`). If you use `upload-url` from the browser, set **bucket → Settings → CORS policy**:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://pawn-tracker.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add your production domain to `AllowedOrigins`.

Implementation: `src/lib/server/storage/`.

## Migrate existing data URLs

After R2 is configured and env is loaded:

```bash
# Preview counts / keys only
bun run db:backfill:storage -- --dry-run

# Upload bytes to R2 and rewrite DB columns
bun run db:backfill:storage
```

Uses `DATABASE_URL` from the shell or `.env.local`, and `R2_*` from `.env.local`. Run against Singapore QA before production.

```bash
# Optional: target a specific Neon URL without editing .env.local
export DATABASE_URL="postgresql://..."
bun run db:backfill:storage -- --dry-run
```

## Notes

- Neon Postgres region does not need to match R2; objects are fetched over HTTPS from SvelteKit server routes and Vercel functions.
- Do not make the bucket public. All reads go through `/api/storage/object` after RBAC.
- Contract PDF generation resolves `storage:` refs server-side before `@react-pdf/renderer` embeds JPEG/PNG.
