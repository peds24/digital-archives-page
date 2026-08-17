const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
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

export function buildAuthorizeUrl({ clientId, redirectUri, scopes }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode({ clientId, clientSecret, code, redirectUri }, fetchImpl = fetch) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Spotify authorization code exchange failed: ${res.status}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function getAccessTokenFromRefreshToken({ clientId, clientSecret, refreshToken }, fetchImpl = fetch) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Spotify refresh token request failed: ${res.status}`);
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
