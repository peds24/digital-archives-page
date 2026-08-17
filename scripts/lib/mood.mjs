const GENRE_TO_MOOD = {
  pop: 'euphoric',
  electronic: 'euphoric',
  latin: 'euphoric',
  'hip-hop': 'euphoric',
  rock: 'intense',
  metal: 'intense',
  punk: 'intense',
  jazz: 'chill',
  reggae: 'chill',
  'r&b': 'chill',
  folk: 'mellow',
  country: 'mellow',
  indie: 'dreamy',
  classical: 'dreamy',
};

export function classifyMood(genres) {
  const topGenre = genres?.[0];
  return GENRE_TO_MOOD[topGenre] ?? 'melancholic';
}

export const MOOD_FEATURE_CENTROIDS = {
  euphoric: { valence: 0.8, energy: 0.8, danceability: 0.7, tempo: 120, acousticness: 0.1 },
  melancholic: { valence: 0.2, energy: 0.2, danceability: 0.3, tempo: 80, acousticness: 0.7 },
  mellow: { valence: 0.75, energy: 0.3, danceability: 0.4, tempo: 90, acousticness: 0.4 },
  intense: { valence: 0.3, energy: 0.85, danceability: 0.6, tempo: 150, acousticness: 0.05 },
  chill: { valence: 0.5, energy: 0.4, danceability: 0.5, tempo: 100, acousticness: 0.65 },
  dreamy: { valence: 0.55, energy: 0.6, danceability: 0.5, tempo: 95, acousticness: 0.7 },
};
