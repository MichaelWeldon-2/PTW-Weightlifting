export function calculateSets(template = [], baseWeight = 0) {

  if (!Array.isArray(template) || typeof baseWeight !== "number") {
    return [];
  }

  return template.map(set => {

    // Handle MAX special case
    if (set.percent === "MAX") {
      return {
        reps: set.reps,
        weight: baseWeight
      };
    }

    const percent = typeof set.percent === "number"
      ? set.percent
      : 1;

    // Round to nearest 5 lbs
    const calculatedWeight =
      Math.round((baseWeight * percent) / 5) * 5;

    return {
      reps: set.reps,
      weight: calculatedWeight
    };
  });

}