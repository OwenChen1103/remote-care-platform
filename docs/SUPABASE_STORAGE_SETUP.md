# Supabase Storage Setup — Provider Photos (G12)

> **One-time setup** for the Provider profile photo upload feature.
> Without these steps, `POST /api/v1/provider/me/photo` returns `SERVER_ERROR`
> "照片上傳功能尚未啟用".

---

## 1. Create the storage bucket

In the Supabase dashboard for project `qaeqmfniibvcvyxjyksu`:

1. Go to **Storage** → **Create new bucket**
2. **Name**: `provider-photos`
3. **Public bucket**: ✅ **Yes** (so candidate cards / admin pages can `<img src>` directly)
4. **File size limit**: `5 MB`
5. **Allowed MIME types**: `image/jpeg, image/png, image/webp`
6. Click **Create bucket**

---

## 2. RLS (Row-Level Security) policies

The bucket needs two policies. In **Storage** → **Policies** → **New policy** on `provider-photos`:

### Policy A: Public read (anyone can `<img src>` the photos)

- **Policy name**: `Public read provider photos`
- **Allowed operation**: `SELECT`
- **Target roles**: `anon, authenticated`
- **Definition (USING)**:
  ```sql
  bucket_id = 'provider-photos'
  ```

### Policy B: Server-only writes (service-role bypasses RLS)

We do NOT need an INSERT/UPDATE/DELETE policy because:
- Our backend `apps/web/lib/storage.ts` uses the service-role key
- Service-role bypasses RLS entirely
- This means **no client (browser/mobile) can write directly** — all uploads go through our API

If you'd rather add an explicit deny policy for clarity:
- **Policy name**: `Block direct client writes`
- **Allowed operation**: `INSERT, UPDATE, DELETE`
- **Definition (USING)**: `false`

---

## 3. Environment variables

Add to **all** environments where the web API runs (local `.env`, Vercel project settings, etc.):

```bash
# Server-only — NEVER prefix with NEXT_PUBLIC_
SUPABASE_URL="https://qaeqmfniibvcvyxjyksu.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key from dashboard → Settings → API>"
```

The service-role key is in the dashboard at:
**Project Settings** → **API** → **Project API keys** → **`service_role`** (not `anon`!).

⚠️ **Security**: this key bypasses RLS. Treat it like a database password:
- Never commit to git
- Never include in mobile bundles
- Never log it

---

## 4. Verify

Once set up, test from local:

```bash
# Provider must be logged in (cookie or Bearer token)
curl -X POST http://localhost:3000/api/v1/provider/me/photo \
  -H "Authorization: Bearer <jwt>" \
  -F "photo=@/path/to/test.jpg"
```

Expected response:
```json
{ "success": true, "data": { "id": "...", "photo_url": "https://qaeqmfniibvcvyxjyksu.supabase.co/storage/v1/object/public/provider-photos/{providerId}.jpg?t=...", ... } }
```

The photo should also be visible at the returned URL in any browser.

---

## 5. Object naming convention

- **Filename**: `{providerId}.jpg`
- **Cache busting**: `?t={Date.now()}` is appended to `Provider.photo_url` after each upload
- **Re-upload**: overwrites the same key (`x-upsert: true`)
- **Delete**: removes the key + clears `Provider.photo_url`

This means each provider has at most one photo file in storage. Renaming on re-upload is unnecessary.

---

## 6. Costs (rough)

For MVP-scale (~100 providers, average 200KB photo):
- Storage: ~20MB → free tier
- Bandwidth: depends on caregiver candidate-view traffic; cache-busting via `?t=` query lets CDN cache aggressively after first load
- Both well within Supabase free tier

---

## 7. Removing this feature later

If you ever need to switch storage providers (Cloudflare R2, S3, Cloudinary):
1. Re-implement `apps/web/lib/storage.ts`'s 3 exported functions:
   - `uploadProviderPhoto(providerId, file): Promise<string>`
   - `deleteProviderPhoto(providerId): Promise<void>`
   - `isStorageConfigured(): boolean`
2. The route handler `apps/web/app/api/v1/provider/me/photo/route.ts` doesn't need to change.
3. Existing `Provider.photo_url` values become invalid; either migrate the storage objects or null out the column.
