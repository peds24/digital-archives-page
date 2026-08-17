import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { buildAuthorizeUrl, exchangeAuthorizationCode } from './lib/spotify-client.mjs';

const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPES = ['playlist-read-private', 'playlist-read-collaborative'];
const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

function printAuthorizeInstructions() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new Error('SPOTIFY_CLIENT_ID is not set — add it to .env first');
  }
  const url = buildAuthorizeUrl({ clientId, redirectUri: REDIRECT_URI, scopes: SCOPES });
  console.log('1. Open this URL in your browser:');
  console.log(`\n   ${url}\n`);
  console.log('2. Log in and approve access.');
  console.log(
    `3. You will land on ${REDIRECT_URI}?code=... — this will likely show a browser error page ` +
      "since nothing is listening on that port. That's expected."
  );
  console.log('4. Copy the value of the `code` query-string parameter from the address bar.');
  console.log('5. Run: node scripts/authorize.mjs <code>');
}

function upsertEnvLine(contents, key, value) {
  const line = `${key}=${value}`;
  const lines = contents.length > 0 ? contents.split('\n') : [];
  const pattern = new RegExp(`^${key}=`);
  const index = lines.findIndex((l) => pattern.test(l));
  if (index >= 0) {
    lines[index] = line;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push(line);
    } else if (lines.length > 0) {
      lines[lines.length - 1] = line;
    } else {
      lines.push(line);
    }
  }
  return lines.join('\n');
}

async function exchangeAndSave(code) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }
  const { refreshToken } = await exchangeAuthorizationCode({
    clientId,
    clientSecret,
    code,
    redirectUri: REDIRECT_URI,
  });

  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf-8') : '';
  const updated = upsertEnvLine(existing, 'SPOTIFY_REFRESH_TOKEN', refreshToken);
  writeFileSync(ENV_PATH, updated);

  console.log('Saved SPOTIFY_REFRESH_TOKEN to .env. You can now run: npm run build-archives');
}

async function main() {
  const code = process.argv[2];
  if (!code) {
    printAuthorizeInstructions();
    return;
  }
  await exchangeAndSave(code);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
