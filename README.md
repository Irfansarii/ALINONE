# Personal Content Vault

A local-first personal library built with Next.js, TypeScript, Dexie, and IndexedDB. It can store photos, videos, documents, notes, links, and code snippets in the visitor's own browser.

## Privacy model

- User-created content is written to IndexedDB in the browser.
- There are no API routes, backend database, login, or content upload endpoint in this project.
- Netlify only hosts and serves the application files.
- Opening a saved external link navigates to that third-party site; that site has its own privacy policy.
- The stylesheet imports Google Fonts. If you want to avoid all third-party requests, remove the `@import` line at the top of `src/app/globals.css` and use the local/system font fallback.

## Requirements

- Node.js 20.9+ recommended
- npm

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Netlify

1. Push this project to a Git repository.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Select the repository.
4. Build command: `npm run build`.
5. Publish directory: leave blank for the Next.js Runtime/plugin setup.
6. Deploy. `netlify.toml` configures the Next.js plugin.

Netlify's Next.js adapter may add hosting functions for rendering routes. This app itself does not create server endpoints for personal content.

## Backups

Use **Export backup** to download a JSON backup. It includes binary files encoded in Base64, so backups can be much larger than the original files. Keep backup files private. Use **Import backup** to restore the items into another browser or device. Import adds records rather than overwriting current records.

## Storage limitations

- Browser storage is origin-specific. `localhost` data, Netlify preview-domain data, and the production domain are separate.
- Clearing browser site data can erase the vault.
- Available storage depends on browser, device, and free disk space. Large video files may fail to save with `QuotaExceededError`.
- The app shows an approximate browser-wide storage usage/quota estimate where supported; the estimate is not a guaranteed allowance and may include other data for the same origin.
- The app offers a request for persistent storage where supported, but browsers may decline it.
- Export backups regularly. This is not an encrypted vault; anyone using the same browser profile may potentially access the content.

## Important

This starter stores all content locally, but it does not encrypt the content at rest. Do not use it as a secure password manager or store highly sensitive information in it.
