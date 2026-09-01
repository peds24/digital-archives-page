# Digital Archives test

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

## Automating the weekly archive move

`npm run archive-liked-songs` is the automated version of "like 30 songs →
make a playlist → move them → rebuild the site":

1. Fetches Liked Songs incrementally — only pages until it reaches a track
   it's already seen, rather than the whole library every time.
2. Cross-references against `public/data/archive-*.json` to know what's
   already archived, and keeps everything else in a small committed
   ledger at `scripts/state/liked-songs-queue.json` — this ledger, not
   Spotify's live Liked Songs list, is the source of truth for "what's
   pending," since songs are intentionally never unliked.
3. Tops off the current open "Digital Archive #NNN" playlist, then opens
   new ones (30 tracks each) as long as enough pending songs remain.
4. Regenerates `public/data/*.json` using the same logic as
   `build-archives`.

Run `npm run archive-liked-songs:dry-run` first to see what it *would* do
(no Spotify writes, no file writes, just log output) before running it for
real.

Requires the `user-library-read` and `playlist-modify-public` scopes — if
`.env` was set up before this feature existed, re-run `npm run authorize`
once to pick them up.

Ordinarily this runs weekly via a scheduled Claude Code agent rather than
by hand.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite
npm run lint     # lint
npm run build    # typecheck + production build
```
