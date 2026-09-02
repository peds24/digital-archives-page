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
5. Uploads generated cover art (see below) to any archive that doesn't
   have one yet — normally just the archive this run created, if any.

Run `npm run archive-liked-songs:dry-run` first to see what it *would* do
(no Spotify writes, no file writes, just log output) before running it for
real. Dry-run skips the cover-art step entirely, same as the other writes.

Requires the `user-library-read`, `playlist-modify-public`, and
`ugc-image-upload` scopes — if `.env` was set up before these features
existed, re-run `npm run authorize` once to pick them up. Also requires
`SPOTIFY_USER_ID` in `.env` — your Spotify username, visible in
`open.spotify.com/user/<id>` or via `https://api.spotify.com/v1/me`.

A cover-art upload failure is treated as cosmetic — logged as a warning,
never fails the run — since it can hit Spotify's undocumented burst limit
on that endpoint (see below) independently of whether the actual archiving
work succeeded.

Ordinarily this runs weekly via a scheduled Claude Code agent rather than
by hand.

## Syncing generated cover art to Spotify

Each archive tile on the site is a seeded generative pattern, not a photo — see
`src/algorithms/tileAlgorithms.ts`. `npm run upload-cover-art` renders that same
pattern per "Digital Archive #NNN" playlist (same algorithm, seed, and color
stops as `ArchiveTile.tsx`, so the Spotify cover matches what the site shows)
and uploads it as the playlist's custom cover image via Spotify's
[Add Custom Playlist Cover Image](https://developer.spotify.com/documentation/web-api/reference/upload-custom-playlist-cover)
endpoint, replacing Spotify's default auto-generated mosaic.

This is also the last step of `archive-liked-songs` (above), so in normal
operation you don't need to run it by hand — it's here for the initial
backfill and for manually re-covering a specific archive.

```bash
npm run upload-cover-art:dry-run   # render + log without uploading
npm run upload-cover-art           # upload to every archive that doesn't have one yet
npm run upload-cover-art -- --number=12   # force re-upload just archive #12
```

Requires the `ugc-image-upload` scope — if `.env` was set up before this
feature existed, re-run `npm run authorize` once to pick it up.

A committed ledger at `scripts/state/cover-art-uploaded.json` tracks which
archive numbers already have a generated cover, so a normal run only touches
newly-created archives — Spotify's API has no reliable way to ask "does this
playlist already have a custom cover," so the script tracks it locally
instead. `--number=N` bypasses the ledger for a one-off re-upload.

Spotify enforces a strict, undocumented rate limit on this endpoint that can
show up as a bare `401` partway through a run rather than a proper `429` with
`Retry-After` (which `scripts/lib/spotify-client.mjs` already handles). The
ledger is written after every individual upload, not batched at the end, so
if a run gets cut off, re-running picks up right where it left off instead of
re-uploading everything.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite
npm run lint     # lint
npm run build    # typecheck + production build
```
