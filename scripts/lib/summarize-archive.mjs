export function summarizeArchive(id, number, tracks) {
  const trackCount = tracks.length;
  const inProgress = trackCount < 30;

  const moodCounts = new Map();
  for (const t of tracks) moodCounts.set(t.mood, (moodCounts.get(t.mood) || 0) + 1);
  const dominantMood = [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mellow';

  const genreCounts = new Map();
  for (const g of tracks.flatMap((t) => t.genres)) genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const dates = tracks.map((t) => t.addedAt).sort();
  const dateRange = { earliest: dates[0] ?? null, latest: dates[dates.length - 1] ?? null };

  const avg = (key) => tracks.reduce((sum, t) => sum + t.audioFeatures[key], 0) / trackCount;
  const audioFeatureAverages = {
    valence: avg('valence'),
    energy: avg('energy'),
    danceability: avg('danceability'),
    tempo: avg('tempo'),
    acousticness: avg('acousticness'),
  };

  return { id, number, trackCount, inProgress, dominantMood, topGenres, dateRange, audioFeatureAverages };
}
