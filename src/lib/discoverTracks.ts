import type { DiscoverableTrack } from './types';

export function discoverTracks(
  pool: DiscoverableTrack[],
  count = 5,
  rnd: () => number = Math.random
): DiscoverableTrack[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const result: DiscoverableTrack[] = [];
  const usedArtists = new Set<string>();
  const usedArchives = new Set<string>();
  for (const track of shuffled) {
    if (result.length >= count) break;
    if (track.artists.some((a) => usedArtists.has(a))) continue;
    // Spread picks across archives where possible — same greedy-with-fallback
    // pattern as the artist constraint above.
    if (usedArchives.has(track.archiveId)) continue;
    result.push(track);
    track.artists.forEach((a) => usedArtists.add(a));
    usedArchives.add(track.archiveId);
  }

  if (result.length < count) {
    for (const track of shuffled) {
      if (result.length >= count) break;
      if (!result.includes(track)) result.push(track);
    }
  }

  return result;
}
