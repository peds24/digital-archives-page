# Digital Archives

A static site that browses "Digital Archive #NNN" playlists — batches of 30 liked
songs, sealed off once full — pulled from Spotify. A build script fetches the
playlists and their tracks into `public/data/*.json`; the React app reads that
data at runtime with no server involved.

## Spotify app setup

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1:8888/callback` as a Redirect URI in the app's settings.
3. Copy `.env.example` to `.env` and fill in the app's Client ID and Client Secret:

   ```bash
   cp .env.example .env
   ```

   ```
   SPOTIFY_CLIENT_ID=your-client-id
   SPOTIFY_CLIENT_SECRET=your-client-secret
   ```

## One-time authorization

Spotify's user-playlist endpoints require a user-authorized token, so a one-time
login step mints a long-lived refresh token:

```bash
npm run authorize
```

This prints an authorize URL — open it in your browser and approve access. You'll
land on `http://127.0.0.1:8888/callback?code=...`, which will likely show a
browser error page since nothing is listening on that port; that's expected. Copy
the `code` value from the address bar, then run:

```bash
node scripts/authorize.mjs <code>
```

This exchanges the code for a refresh token and saves it to `.env` as
`SPOTIFY_REFRESH_TOKEN`. You only need to do this once — future runs reuse it.

## Regenerating the archive data

```bash
npm run build-archives
```

This fetches every "Digital Archive #NNN" playlist from your account and
(re)writes `public/data/*.json`. Run it whenever your Spotify playlists change.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite
npm run lint     # lint
npm run build    # typecheck + production build
```
