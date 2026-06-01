# gallery-upload

Cloudflare Worker upload gateway for the gallery.

It does not store files. It verifies a short-lived HMAC upload ticket from the Vercel app, then streams the browser multipart upload body to the imgbed `/upload` endpoint with `uploadNameType=origin`.

## Dashboard Bindings

Configure these in Cloudflare Dashboard for the Worker. Do not commit real values.

Use **Secrets** for all of these. Wrangler deploy treats dashboard Variables as config drift, but omitted secrets are preserved across deploys.

- `IMGBED_TOKEN`: real imgbed API token with upload permission.
- `UPLOAD_TICKET_SECRET`: shared HMAC secret also configured in Vercel.
- `IMGBED_BASE_URL`: imgbed deployment origin, for example `https://img.example.com`.
- `ALLOWED_ORIGINS`: comma-separated allowed browser origins, for example `https://gallery.example.com,http://localhost:3000`.
- `MAX_UPLOAD_BYTES`: optional byte limit enforced from `Content-Length`.

## Deploy

```bash
pnpm exec wrangler deploy --config worker/gallery-upload/wrangler.jsonc --keep-vars
```

Local dev:

```bash
pnpm exec wrangler dev --config worker/gallery-upload/wrangler.jsonc
```

## Request

```http
POST /upload
Authorization: UploadTicket <payload>.<signature>
Content-Type: multipart/form-data; boundary=...
```

The Worker does not parse multipart data. Ticket verification happens from headers, then the original request body is streamed to imgbed.

Ticket payload fields:

```ts
{
  exp: number;
  originalFileName: string;
  uploadFolder: string;
  maxBytes?: number;
  metadataId?: string;
}
```

The Worker only validates the top-level request is `multipart/form-data`. It deliberately does not inspect individual multipart file parts.
