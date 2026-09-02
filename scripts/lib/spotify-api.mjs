import { spotifyFetch } from './spotify-client.mjs';

export async function fetchAllPlaylists(token, fetchImpl) {
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
  let trackIndex = 0;
  let url = `/playlists/${playlistId}/items?limit=100`;
  while (url) {
    const page = await spotifyFetch(token, url, fetchImpl);
    for (const item of page.items) {
      trackIndex += 1;
      const t = item.item;
      // Skip non-track items (e.g., episodes) — playlists can contain mixed types.
      // These are excluded entirely, not placeholders: they were never "a song here".
      if (t && t.type && t.type !== 'track') continue;
      // Fully delisted from Spotify's catalog since it was added — no recoverable data
      // at all. Keep a visible placeholder rather than silently shrinking the archive.
      if (!t) {
        tracks.push({
          id: `${playlistId}-unavailable-${trackIndex}`,
          name: 'Track removed from Spotify',
          artists: [],
          album: '',
          coverUrl: '',
          releaseDate: null,
          durationMs: 0,
          addedAt: item.added_at,
          spotifyUrl: '',
          unavailable: true,
        });
        continue;
      }
      // Local file — Spotify reports type:'track' for these but there's no catalog id
      // (and therefore no usable spotifyUrl/coverUrl/artist). Keep the real name as a
      // placeholder rather than dropping it or showing a broken link.
      if (t.is_local) {
        tracks.push({
          id: `${playlistId}-unavailable-${trackIndex}`,
          name: t.name,
          artists: [],
          album: '',
          coverUrl: '',
          releaseDate: null,
          durationMs: t.duration_ms,
          addedAt: item.added_at,
          spotifyUrl: '',
          unavailable: true,
        });
        continue;
      }
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
        unavailable: false,
      });
    }
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return tracks;
}

export async function fetchLikedSongs(token, knownIds = new Set(), fetchImpl) {
  const tracks = [];
  let url = `/me/tracks?limit=50`;
  let stop = false;
  while (url && !stop) {
    const page = await spotifyFetch(token, url, fetchImpl);
    for (const item of page.items) {
      const t = item.track;
      if (!t || t.is_local) continue;
      if (knownIds.has(t.id)) {
        stop = true;
        break;
      }
      tracks.push({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        addedAt: item.added_at,
        uri: t.uri,
      });
    }
    url = !stop && page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return tracks;
}

export async function createPlaylist(token, userId, name, fetchImpl) {
  // Spotify's Feb/Mar 2026 API migration removed POST /users/{user_id}/playlists —
  // playlists are now always created for the authenticated user via /me/playlists.
  // userId is kept as a parameter for interface stability but is no longer used here.
  return spotifyFetch(token, `/me/playlists`, fetchImpl, {
    method: 'POST',
    body: { name, public: true, collaborative: false },
  });
}

export async function addTracksToPlaylist(token, playlistId, uris, fetchImpl) {
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    // Renamed from /playlists/{id}/tracks to /playlists/{id}/items in the same migration.
    await spotifyFetch(token, `/playlists/${playlistId}/items`, fetchImpl, {
      method: 'POST',
      body: { uris: chunk },
    });
  }
}

export async function updatePlaylistDetails(token, playlistId, details, fetchImpl) {
  await spotifyFetch(token, `/playlists/${playlistId}`, fetchImpl, {
    method: 'PUT',
    body: details,
  });
}

// base64Jpeg is the base64-encoded body of a JPEG under Spotify's 256KB limit (no
// data: URL prefix). Requires the ugc-image-upload scope on the token.
export async function uploadPlaylistCoverImage(token, playlistId, base64Jpeg, fetchImpl) {
  await spotifyFetch(token, `/playlists/${playlistId}/images`, fetchImpl, {
    method: 'PUT',
    body: base64Jpeg,
    contentType: 'image/jpeg',
    rawBody: true,
  });
}
