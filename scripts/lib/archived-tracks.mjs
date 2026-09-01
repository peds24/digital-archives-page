export function collectArchivedTrackIds(archiveSummaries) {
  const ids = new Set();
  for (const archive of archiveSummaries) {
    for (const track of archive.tracks ?? []) {
      if (!track.unavailable) ids.add(track.id);
    }
  }
  return ids;
}
