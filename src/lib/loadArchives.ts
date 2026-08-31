import type { ArchiveIndex, ArchiveDetail, DiscoverableTrack } from './types';

export interface ArchiveLibrary {
  archives: ArchiveDetail[];
  trackPool: DiscoverableTrack[];
}

export async function loadAllArchives(baseUrl = `${import.meta.env.BASE_URL}data`): Promise<ArchiveLibrary> {
  const indexRes = await fetch(`${baseUrl}/index.json`);
  if (!indexRes.ok) throw new Error(`Failed to load archive index: ${indexRes.status}`);
  const index = (await indexRes.json()) as ArchiveIndex;

  const archives = await Promise.all(
    index.archives.map(async (summary) => {
      const res = await fetch(`${baseUrl}/${summary.id}.json`);
      if (!res.ok) throw new Error(`Failed to load ${summary.id}: ${res.status}`);
      return (await res.json()) as ArchiveDetail;
    })
  );

  const trackPool: DiscoverableTrack[] = archives.flatMap((archive) =>
    archive.tracks.map((track) => ({ ...track, archiveId: archive.id, archiveNumber: archive.number }))
  );

  return { archives, trackPool };
}
