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
  updatePlaylistDetails,
  uploadPlaylistCoverImage,
} from './lib/spotify-api.mjs';
import { syncQueue, pruneArchived, planFill } from './lib/liked-songs-queue.mjs';
import { collectArchivedTrackIds } from './lib/archived-tracks.mjs';
import { buildDateRangeDescription } from './lib/archive-description.mjs';
import { parseArchiveNumber, run as buildArchives } from './build-archives.mjs';
import { renderCoverArt } from './lib/generate-cover-art.mjs';
import { run as uploadCoverArt, loadUploadedNumbers, saveUploadedNumbers } from './upload-cover-art.mjs';

export async function run({
  token,
  userId,
  queue,
  archivedTrackIds,
  localMaxArchiveNumber = 0,
  fetchLikedSongs: fetchLikedSongsFn,
  fetchAllPlaylists: fetchAllPlaylistsFn,
  fetchPlaylistTracks: fetchPlaylistTracksFn,
  createPlaylist: createPlaylistFn,
  addTracksToPlaylist: addTracksToPlaylistFn,
  updatePlaylistDetails: updatePlaylistDetailsFn,
  log = console.log,
}) {
  const knownIds = new Set([...queue.map((t) => t.id), ...archivedTrackIds]);
  const likedSongs = await fetchLikedSongsFn(token, knownIds);

  let updatedQueue = syncQueue(queue, likedSongs);

  const playlists = await fetchAllPlaylistsFn(token);
  const archives = playlists
    .map((p) => ({ ...p, number: parseArchiveNumber(p.name) }))
    .filter((p) => p.number !== null)
    .sort((a, b) => a.number - b.number);

  const latest = archives.length > 0 ? archives[archives.length - 1] : null;

  // Reconcile every archive playlist Spotify actually has that isn't yet reflected in
  // local public/data/*.json (numbered >= localMaxArchiveNumber), not just the single
  // latest one — a rerun after a crash mid-way through a previous run (e.g. archive N
  // was created and filled, then archive N+1 was created but its fill or the ledger
  // persist step failed) must not re-add tracks already sitting in archive N just
  // because archive N+1 now exists and is technically "the latest".
  const unreconciled = archives.filter((a) => a.number >= localMaxArchiveNumber);

  let openArchive = null;
  let openArchiveTracks = [];
  const liveExcludedIds = [];
  for (const archive of unreconciled) {
    const tracks = await fetchPlaylistTracksFn(token, archive.id);
    for (const t of tracks) {
      if (!t.unavailable) liveExcludedIds.push(t.id);
    }
    if (tracks.length < 30) {
      openArchive = { id: archive.id, trackCount: tracks.length };
      openArchiveTracks = tracks;
    } else {
      openArchive = null;
      openArchiveTracks = [];
    }
  }

  // A description-update failure is cosmetic — it must never abort a run that already
  // made real Spotify writes, which would lose ledger persistence and re-arm the
  // duplicate-track risk the crash-recovery logic above exists to prevent.
  const updateDescription = async (playlistId, tracks) => {
    try {
      await updatePlaylistDetailsFn(token, playlistId, { description: buildDateRangeDescription(tracks) });
    } catch (err) {
      log(`Warning: failed to update playlist description for ${playlistId}: ${err.message}`);
    }
  };

  const excludedIds = new Set([...archivedTrackIds, ...liveExcludedIds]);
  updatedQueue = pruneArchived(updatedQueue, excludedIds);

  const plan = planFill(updatedQueue, openArchive);

  let addedCount = 0;
  if (plan.topOff.length > 0) {
    await addTracksToPlaylistFn(token, openArchive.id, plan.topOff.map((t) => t.uri));
    addedCount += plan.topOff.length;
    await updateDescription(openArchive.id, [...openArchiveTracks, ...plan.topOff]);
  }

  let nextNumber = latest ? latest.number + 1 : 1;
  let createdCount = 0;
  for (const batch of plan.newArchives) {
    const playlist = await createPlaylistFn(token, userId, `Digital Archive #${nextNumber}`);
    await addTracksToPlaylistFn(token, playlist.id, batch.map((t) => t.uri));
    await updateDescription(playlist.id, batch);
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
  const localMaxArchiveNumber = archiveFiles.reduce((max, f) => {
    const match = /^archive-(\d+)\.json$/.exec(f);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  const queue = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf-8')).tracks ?? [] : [];

  const result = await run({
    token,
    userId,
    queue,
    archivedTrackIds,
    localMaxArchiveNumber,
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
    updatePlaylistDetails: dryRun
      ? async (t, playlistId, details) => {
          console.log(`[dry-run] would set description on ${playlistId}: ${details.description}`);
        }
      : updatePlaylistDetails,
  });

  if (dryRun) {
    console.log(`[dry-run] would leave ${result.queue.length} pending track(s) in the ledger.`);
    return;
  }

  // Persist the ledger immediately after the Spotify writes above, before the
  // (separately fallible) archive regeneration below — so a crash partway through
  // regenerating public/data/*.json still leaves the ledger reflecting what's
  // actually pending, rather than re-arming the duplicate-track risk on the next run.
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify({ tracks: result.queue }, null, 2));

  mkdirSync(dataDir, { recursive: true });
  await buildArchives({
    token,
    fetchAllPlaylists,
    fetchPlaylistTracks,
    writeFile: (name, contents) => writeFileSync(new URL(name, dataDir), contents),
  });

  // A cover-art upload failure (Spotify's undocumented burst limit on this endpoint —
  // see upload-cover-art.mjs) is cosmetic and must never mark this run as failed; any
  // archive it doesn't reach this week is picked up automatically on the next run,
  // same as a crash would be.
  try {
    const uploadedNumbers = loadUploadedNumbers();
    await uploadCoverArt({
      token,
      numbers: null,
      uploadedNumbers,
      fetchAllPlaylists,
      renderCoverArt,
      uploadPlaylistCoverImage,
      onUploaded: (number) => {
        uploadedNumbers.add(number);
        saveUploadedNumbers(uploadedNumbers);
      },
      log: console.log,
    });
  } catch (err) {
    console.log(`Warning: cover-art upload did not finish: ${err.message}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
