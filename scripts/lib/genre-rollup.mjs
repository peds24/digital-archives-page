const GENRE_BUCKETS = [
  { bucket: 'hip-hop', match: ['hip hop', 'rap', 'trap'] },
  { bucket: 'r&b', match: ['r&b', 'soul', 'neo soul'] },
  { bucket: 'pop', match: ['pop'] },
  { bucket: 'rock', match: ['rock'] },
  { bucket: 'indie', match: ['indie'] },
  { bucket: 'electronic', match: ['edm', 'electro', 'house', 'techno', 'synth', 'electronic'] },
  { bucket: 'folk', match: ['folk', 'singer-songwriter'] },
  { bucket: 'jazz', match: ['jazz'] },
  { bucket: 'metal', match: ['metal'] },
  { bucket: 'classical', match: ['classical', 'orchestra'] },
  { bucket: 'country', match: ['country'] },
  { bucket: 'latin', match: ['latin', 'reggaeton'] },
  { bucket: 'reggae', match: ['reggae', 'dancehall'] },
  { bucket: 'punk', match: ['punk'] },
];

export function rollupGenres(artistGenres, maxGenres = 3) {
  const counts = new Map();
  for (const raw of artistGenres) {
    const lower = raw.toLowerCase();
    const bucket = GENRE_BUCKETS.find((b) => b.match.some((m) => lower.includes(m)));
    const key = bucket ? bucket.bucket : 'other';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxGenres)
    .map(([bucket]) => bucket);
}
