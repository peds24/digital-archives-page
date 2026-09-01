import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { getAccessTokenFromRefreshToken } from './lib/spotify-client.mjs';
import {
  fetchAllPlaylists,
  fetchPlaylistTracks,
  fetchLikedSongs,
  createPlaylist,
  addTracksToPlaylist,
} from './lib/spotify-api.mjs';
import { syncQueue, pruneArchived, planFill } from './lib/liked-songs-queue.mjs';
import { collectArchivedTrackIds } from './lib/archived-tracks.mjs';
import { parseArchiveNumber, run as buildArchives } from './build-archives.mjs';

export async function run({
  token,
  userId,
  queue,
  archivedTrackIds,
  fetchLikedSongs: fetchLikedSongsFn,
  fetchAllPlaylists: fetchAllPlaylistsFn,
  fetchPlaylistTracks: fetchPlaylistTracksFn,
  createPlaylist: createPlaylistFn,
  addTracksToPlaylist: addTracksToPlaylistFn,
  log = console.log,
}) {
  const knownIds = new Set([...queue.map((t) => t.id), ...archivedTrackIds]);
  const likedSongs = await fetchLikedSongsFn(token, knownIds);

  let updatedQueue = syncQueue(queue, likedSongs);
  updatedQueue = pruneArchived(updatedQueue, archivedTrackIds);

  const playlists = await fetchAllPlaylistsFn(token);
  const archives = playlists
    .map((p) => ({ ...p, number: parseArchiveNumber(p.name) }))
    .filter((p) => p.number !== null)
    .sort((a, b) => b.number - a.number);

  const latest = archives[0] ?? null;
  let openArchive = null;
  if (latest) {
    const latestTracks = await fetchPlaylistTracksFn(token, latest.id);
    if (latestTracks.length < 30) {
      openArchive = { id: latest.id, trackCount: latestTracks.length };
    }
  }

  const plan = planFill(updatedQueue, openArchive);

  let addedCount = 0;
  if (plan.topOff.length > 0) {
    await addTracksToPlaylistFn(token, openArchive.id, plan.topOff.map((t) => t.uri));
    addedCount += plan.topOff.length;
  }

  let nextNumber = latest ? latest.number + 1 : 1;
  let createdCount = 0;
  for (const batch of plan.newArchives) {
    const playlist = await createPlaylistFn(token, userId, `Digital Archive #${nextNumber}`);
    await addTracksToPlaylistFn(token, playlist.id, batch.map((t) => t.uri));
    addedCount += batch.length;
    createdCount += 1;
    nextNumber += 1;
  }

  log(
    `Synced ${likedSongs.length} liked song(s). ` +
      `Added ${addedCount} track(s) (${createdCount} new archive(s) created). ` +
      `${plan.remaining.length} pending.`
  );

  return { queue: plan.remaining, addedCount, createdCount, pendingCount: plan.remaining.length };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dataDir = new URL('../public/data/', import.meta.url);
  const stateDir = new URL('./state/', import.meta.url);
  const statePath = fileURLToPath(new URL('liked-songs-queue.json', stateDir));

  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('SPOTIFY_REFRESH_TOKEN is not set — run npm run authorize first');
  }
  const userId = process.env.SPOTIFY_USER_ID;
  if (!userId) {
    throw new Error('SPOTIFY_USER_ID is not set — add it to .env');
  }

  const token = await getAccessTokenFromRefreshToken({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken,
  });

  const archiveFiles = existsSync(dataDir)
    ? readdirSync(dataDir).filter((f) => /^archive-\d+\.json$/.test(f))
    : [];
  const archiveSummaries = archiveFiles.map((f) => JSON.parse(readFileSync(new URL(f, dataDir), 'utf-8')));
  const archivedTrackIds = collectArchivedTrackIds(archiveSummaries);

  const queue = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf-8')).tracks : [];

  const result = await run({
    token,
    userId,
    queue,
    archivedTrackIds,
    fetchLikedSongs,
    fetchAllPlaylists,
    fetchPlaylistTracks,
    createPlaylist: dryRun
      ? async (t, u, name) => {
          console.log(`[dry-run] would create playlist: ${name}`);
          return { id: `dry-run-${name}` };
        }
      : createPlaylist,
    addTracksToPlaylist: dryRun
      ? async (t, playlistId, uris) => {
          console.log(`[dry-run] would add ${uris.length} track(s) to ${playlistId}`);
        }
      : addTracksToPlaylist,
  });

  if (result.addedCount > 0 && !dryRun) {
    mkdirSync(dataDir, { recursive: true });
    await buildArchives({
      token,
      fetchAllPlaylists,
      fetchPlaylistTracks,
      writeFile: (name, contents) => writeFileSync(new URL(name, dataDir), contents),
    });
  }

  if (dryRun) {
    console.log(`[dry-run] would leave ${result.queue.length} pending track(s) in the ledger.`);
    return;
  }

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify({ tracks: result.queue }, null, 2));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
