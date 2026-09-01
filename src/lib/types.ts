export interface Track {
  id: string;
  name: string;
  artists: string[];
  album: string;
  coverUrl: string;
  releaseDate: string | null;
  durationMs: number;
  addedAt: string;
  spotifyUrl: string;
  unavailable: boolean;
}

export interface DiscoverableTrack extends Track {
  archiveId: string;
  archiveNumber: number;
}

export interface ArchiveSummary {
  id: string;
  number: number;
  trackCount: number;
  inProgress: boolean;
  dateRange: { earliest: string | null; latest: string | null };
  spotifyUrl: string;
}

export interface ArchiveDetail extends ArchiveSummary {
  tracks: Track[];
}

export interface ArchiveIndex {
  archives: ArchiveSummary[];
}
