export function summarizeArchive(id, number, tracks) {
  const trackCount = tracks.length;
  const inProgress = trackCount < 30;

  const dates = tracks.map((t) => t.addedAt).sort();
  const dateRange = { earliest: dates[0] ?? null, latest: dates[dates.length - 1] ?? null };

  return { id, number, trackCount, inProgress, dateRange };
}
