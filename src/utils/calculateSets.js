export function calculateSets(template, baseWeight) {

  if (!template || !Array.isArray(template)) return [];

  return template.map(set => ({
    reps: set.reps,
    weight: Math.round(baseWeight * (set.percent || 1))
  }));

}