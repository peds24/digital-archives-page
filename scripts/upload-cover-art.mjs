import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { getAccessTokenFromRefreshToken } from './lib/spotify-client.mjs';
import { fetchAllPlaylists, uploadPlaylistCoverImage } from './lib/spotify-api.mjs';
import { parseArchiveNumber } from './build-archives.mjs';
import { renderCoverArt } from './lib/generate-cover-art.mjs';

// Spotify's cover-image upload has a strict, undocumented per-account rate limit —
// space requests out rather than firing them back to back.
const UPLOAD_DELAY_MS = 3000;

export async function run({
  token,
  numbers, // optional: archive numbers to force-upload regardless of uploadedNumbers, e.g. from --number=3
  uploadedNumbers = new Set(), // archive numbers that already have a generated cover — skipped unless in `numbers`
  fetchAllPlaylists: fetchAllPlaylistsFn,
  renderCoverArt: renderCoverArtFn,
  uploadPlaylistCoverImage: uploadPlaylistCoverImageFn,
  onUploaded = () => {}, // called with the archive number right after each successful upload, so callers can persist progress before a later item can fail
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
}) {
  const playlists = await fetchAllPlaylistsFn(token);
  const archives = playlists
    .map((p) => ({ ...p, number: parseArchiveNumber(p.name) }))
    .filter((p) => p.number !== null && (numbers ? numbers.includes(p.number) : !uploadedNumbers.has(p.number)))
    .sort((a, b) => a.number - b.number);

  let uploadedCount = 0;
  for (const archive of archives) {
    const jpeg = renderCoverArtFn(archive.number);
    try {
      await uploadPlaylistCoverImageFn(token, archive.id, jpeg.toString('base64'));
    } catch (err) {
      log(
        `Stopped after ${uploadedCount}/${archives.length} upload(s): ${err.message}. ` +
          `Spotify's cover-upload endpoint has a strict, undocumented burst limit that can surface as a ` +
          `plain 401 rather than 429 — wait a bit and re-run; already-uploaded archives are skipped.`
      );
      throw err;
    }
    uploadedCount += 1;
    onUploaded(archive.number);
    log(`Uploaded generated cover art to "${archive.name}" (${jpeg.length} bytes).`);
    if (uploadedCount < archives.length) {
      await delay(UPLOAD_DELAY_MS);
    }
  }

  log(`Uploaded ${uploadedCount} cover(s).`);
  return { uploadedCount };
}

const STATE_PATH = fileURLToPath(new URL('./state/cover-art-uploaded.json', import.meta.url));

export function loadUploadedNumbers() {
  if (!existsSync(STATE_PATH)) return new Set();
  const data = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  return new Set(data.numbers ?? []);
}

export function saveUploadedNumbers(uploadedNumbers) {
  mkdirSync(new URL('./state/', import.meta.url), { recursive: true });
  const numbers = [...uploadedNumbers].sort((a, b) => a - b);
  writeFileSync(STATE_PATH, JSON.stringify({ numbers }, null, 2));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const numberArg = process.argv.find((a) => a.startsWith('--number='));
  const numbers = numberArg ? [Number(numberArg.split('=')[1])] : null;

  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('SPOTIFY_REFRESH_TOKEN is not set — run npm run authorize first');
  }

  const token = await getAccessTokenFromRefreshToken({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken,
  });

  const uploadedNumbers = loadUploadedNumbers();

  await run({
    token,
    numbers,
    uploadedNumbers,
    fetchAllPlaylists,
    renderCoverArt,
    uploadPlaylistCoverImage: dryRun
      ? async (t, playlistId, base64) => {
          console.log(`[dry-run] would upload ${base64.length}-char cover to playlist ${playlistId}`);
        }
      : uploadPlaylistCoverImage,
    // Persisted synchronously per-upload (not batched at the end) so a later item
    // failing — e.g. the 401 above — doesn't lose progress already made.
    onUploaded: dryRun
      ? () => {}
      : (number) => {
          uploadedNumbers.add(number);
          saveUploadedNumbers(uploadedNumbers);
        },
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
