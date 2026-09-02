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
  numbers, // optional: archive numbers to restrict to, e.g. from --number=3
  fetchAllPlaylists: fetchAllPlaylistsFn,
  renderCoverArt: renderCoverArtFn,
  uploadPlaylistCoverImage: uploadPlaylistCoverImageFn,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
}) {
  const playlists = await fetchAllPlaylistsFn(token);
  const archives = playlists
    .map((p) => ({ ...p, number: parseArchiveNumber(p.name) }))
    .filter((p) => p.number !== null && (!numbers || numbers.includes(p.number)))
    .sort((a, b) => a.number - b.number);

  let uploadedCount = 0;
  for (const archive of archives) {
    const jpeg = renderCoverArtFn(archive.number);
    await uploadPlaylistCoverImageFn(token, archive.id, jpeg.toString('base64'));
    uploadedCount += 1;
    log(`Uploaded generated cover art to "${archive.name}" (${jpeg.length} bytes).`);
    if (uploadedCount < archives.length) {
      await delay(UPLOAD_DELAY_MS);
    }
  }

  log(`Uploaded ${uploadedCount} cover(s).`);
  return { uploadedCount };
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

  await run({
    token,
    numbers,
    fetchAllPlaylists,
    renderCoverArt,
    uploadPlaylistCoverImage: dryRun
      ? async (t, playlistId, base64) => {
          console.log(`[dry-run] would upload ${base64.length}-char cover to playlist ${playlistId}`);
        }
      : uploadPlaylistCoverImage,
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
