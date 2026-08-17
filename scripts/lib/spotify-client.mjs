const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

export async function getClientCredentialsToken(fetchImpl = fetch) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function spotifyFetch(token, path, fetchImpl = fetch, retryCount = 0) {
  const res = await fetchImpl(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    if (retryCount >= 4) {
      throw new Error(`Spotify API rate limit exceeded after 5 retries: ${path}`);
    }
    const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return spotifyFetch(token, path, fetchImpl, retryCount + 1);
  }
  if (!res.ok) {
    throw new Error(`Spotify API request failed (${res.status}): ${path}`);
  }
  return res.json();
}
