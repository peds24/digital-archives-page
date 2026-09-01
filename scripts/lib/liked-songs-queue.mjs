export function syncQueue(queue, likedSongs) {
  const existingIds = new Set(queue.map((t) => t.id));
  const additions = likedSongs.filter((t) => !existingIds.has(t.id));
  return [...queue, ...additions].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
}

export function pruneArchived(queue, archivedTrackIds) {
  return queue.filter((t) => !archivedTrackIds.has(t.id));
}

export function planFill(queue, openArchive) {
  const sorted = [...queue].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
  let cursor = 0;
  let topOff = [];
  if (openArchive) {
    const slots = Math.max(0, 30 - openArchive.trackCount);
    topOff = sorted.slice(0, slots);
    cursor = topOff.length;
  }
  const newArchives = [];
  while (sorted.length - cursor >= 30) {
    newArchives.push(sorted.slice(cursor, cursor + 30));
    cursor += 30;
  }
  const remaining = sorted.slice(cursor);
  return { topOff, newArchives, remaining };
}
