const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const API_BASE = 'https://api.spotify.com/v1';

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

export async function spotifyFetch(token, path, fetchImpl = fetch, options = {}) {
  // contentType/rawBody exist for endpoints like the playlist cover-image upload,
  // which take a raw base64 body under image/jpeg rather than a JSON payload.
  const { method = 'GET', body, retryCount = 0, contentType = 'application/json', rawBody = false } = options;
  const res = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': contentType } : {}),
    },
    ...(body !== undefined ? { body: rawBody ? body : JSON.stringify(body) } : {}),
  });
  if (res.status === 429) {
    if (retryCount >= 4) {
      throw new Error(`Spotify API rate limit exceeded after 5 attempts: ${path}`);
    }
    // Retry-After is *usually* a delay in seconds, but per HTTP spec it may legally be
    // an HTTP-date instead — guard against that (and any other non-numeric value)
    // turning into NaN, which would otherwise skip the backoff delay entirely.
    const raw = res.headers.get('Retry-After');
    const retryAfter = raw && Number.isFinite(Number(raw)) ? Number(raw) : 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return spotifyFetch(token, path, fetchImpl, { method, body, contentType, rawBody, retryCount: retryCount + 1 });
  }
  if (!res.ok) {
    throw new Error(`Spotify API request failed (${res.status}): ${path}`);
  }
  // The cover-image upload returns 204 No Content — nothing to parse.
  if (res.status === 204) return null;

  // Some endpoints (e.g. PUT /playlists/{id}) return 200 with an empty body on
  // success — res.json() throws SyntaxError on an empty string, so fall back to null.
  try {
    return await res.json();
  } catch {
    return null;
  }
}
