import { spotifyFetch } from './spotify-client.mjs';

export async function fetchAllPlaylists(token, userId, fetchImpl) {
  const playlists = [];
  let url = `/me/playlists?limit=50`;
  while (url) {
    const page = await spotifyFetch(token, url, fetchImpl);
    playlists.push(...page.items);
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return playlists;
}

export async function fetchPlaylistTracks(token, playlistId, fetchImpl) {
  const tracks = [];
  let url = `/playlists/${playlistId}/items?limit=100`;
  while (url) {
    const page = await spotifyFetch(token, url, fetchImpl);
    for (const item of page.items) {
      const t = item.item;
      if (!t) continue;
      // Skip non-track items (e.g., episodes) — playlists can contain mixed types
      if (t.type && t.type !== 'track') continue;
      tracks.push({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        artistIds: t.artists.map((a) => a.id),
        album: t.album.name,
        coverUrl: t.album.images?.[0]?.url ?? '',
        releaseDate: t.album.release_date,
        durationMs: t.duration_ms,
        addedAt: item.added_at,
        spotifyUrl: t.external_urls?.spotify ?? '',
      });
    }
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return tracks;
}

export async function fetchAudioFeaturesBatch(token, trackIds, fetchImpl) {
  const featureMap = new Map();
  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100);
    const data = await spotifyFetch(token, `/audio-features?ids=${batch.join(',')}`, fetchImpl);
    for (const f of data.audio_features) {
      if (!f) continue;
      featureMap.set(f.id, {
        valence: f.valence,
        energy: f.energy,
        danceability: f.danceability,
        tempo: f.tempo,
        acousticness: f.acousticness,
      });
    }
  }
  return featureMap;
}

export async function fetchArtistGenres(token, artistIds, fetchImpl) {
  const uniqueIds = [...new Set(artistIds)];
  const genreMap = new Map();
  for (const id of uniqueIds) {
    const artist = await spotifyFetch(token, `/artists/${id}`, fetchImpl);
    if (!artist) continue;
    genreMap.set(artist.id, artist.genres ?? []);
  }
  return genreMap;
}
