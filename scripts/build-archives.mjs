import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { getAccessTokenFromRefreshToken } from './lib/spotify-client.mjs';
import { fetchAllPlaylists, fetchPlaylistTracks } from './lib/spotify-api.mjs';
import { summarizeArchive } from './lib/summarize-archive.mjs';

const ARCHIVE_NAME_PATTERN = /^Digital Archive #(\d+)$/;

export function parseArchiveNumber(name) {
  const match = ARCHIVE_NAME_PATTERN.exec(name ?? '');
  return match ? Number(match[1]) : null;
}

export async function run({
  token,
  fetchAllPlaylists: fetchPlaylistsFn,
  fetchPlaylistTracks: fetchTracksFn,
  writeFile,
  log = console.log,
}) {
  const playlists = await fetchPlaylistsFn(token);
  const archivePlaylists = playlists
    .map((p) => ({ ...p, number: parseArchiveNumber(p.name) }))
    .filter((p) => p.number !== null);

  const summaries = [];
  for (const playlist of archivePlaylists) {
    const rawTracks = await fetchTracksFn(token, playlist.id);

    const tracks = rawTracks.map((raw) => ({
      id: raw.id, name: raw.name, artists: raw.artists, album: raw.album,
      coverUrl: raw.coverUrl, releaseDate: raw.releaseDate, durationMs: raw.durationMs,
      addedAt: raw.addedAt, spotifyUrl: raw.spotifyUrl, unavailable: raw.unavailable,
    }));

    const id = `archive-${String(playlist.number).padStart(3, '0')}`;

    const summary = { ...summarizeArchive(id, playlist.number, tracks), spotifyUrl: playlist.external_urls?.spotify ?? '' };
    const detail = { ...summary, tracks };
    writeFile(`${id}.json`, JSON.stringify(detail, null, 2));
    summaries.push(summary);
  }

  summaries.sort((a, b) => a.number - b.number);
  writeFile('index.json', JSON.stringify({ archives: summaries }, null, 2));
  log(`Wrote ${summaries.length} archive(s) to public/data/`);
  return summaries;
}

async function main() {
  const outDir = new URL('../public/data/', import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('SPOTIFY_REFRESH_TOKEN is not set — run npm run authorize first');
  }
  const token = await getAccessTokenFromRefreshToken({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken,
  });
  await run({
    token,
    fetchAllPlaylists,
    fetchPlaylistTracks,
    writeFile: (name, contents) => writeFileSync(new URL(name, outDir), contents),
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
