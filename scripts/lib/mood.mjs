const RECIPES = [
  { mood: 'euphoric', test: (f) => f.valence > 0.7 && f.energy > 0.7 },
  { mood: 'melancholic', test: (f) => f.valence < 0.35 && f.energy < 0.4 },
  { mood: 'mellow', test: (f) => f.valence > 0.6 && f.energy < 0.45 },
  { mood: 'intense', test: (f) => f.valence < 0.45 && f.energy > 0.75 },
  { mood: 'chill', test: (f) => f.energy >= 0.3 && f.energy <= 0.55 && f.acousticness > 0.5 },
  { mood: 'dreamy', test: (f) => f.valence >= 0.45 && f.valence <= 0.7 && f.acousticness > 0.6 },
];

export function classifyMood(features) {
  for (const recipe of RECIPES) {
    if (recipe.test(features)) return recipe.mood;
  }
  if (features.valence >= 0.5 && features.energy >= 0.5) return 'euphoric';
  if (features.valence < 0.5 && features.energy < 0.5) return 'melancholic';
  if (features.valence >= 0.5 && features.energy < 0.5) return 'mellow';
  return 'intense';
}
