# צבע בקליק — Node.js site

Node.js/Express-free (zero-dependency) server for the landing page site. No `npm install` needed — it only uses Node's built-in modules.

## Run it

```
cp .env.example .env
# edit .env and paste your real web3forms access key
node server.js
```

Then open http://localhost:3000

## What changed from the static version

- Pages now live in `public/` and are served by `server.js`.
- The lead form (`index.html`) no longer calls `api.web3forms.com` directly from the browser. It posts to `/api/lead` on this server instead.
- `server.js` handles `/api/lead`: it validates the input, checks the honeypot field, and only then calls web3forms — using the access key from `.env` (`WEB3FORMS_ACCESS_KEY`), which is never sent to the browser or visible in page source.
- `.env` is gitignored so the key won't get committed.

## Files

- `server.js` — the whole server (static file serving + the `/api/lead` route)
- `public/` — index.html, thank-you.html, privacy.html, accessibility.html
- `.env.example` — copy to `.env` and fill in `WEB3FORMS_ACCESS_KEY`

## Note

The original `index.html`, `thank-you.html`, `privacy.html`, `accessibility.html` at the project root are the old static versions and are no longer used by the server — the live copies are in `public/`. They weren't deleted automatically; let me know if you'd like them removed.
