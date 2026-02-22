export function calculateSets(template, baseWeight) {
  return template.map(set => {

    if (set.percent === "MAX") {
      return {
        reps: set.reps,
        percent: "MAX",
        weight: "MAX ATTEMPT"
      };
    }

    const raw = set.percent * baseWeight;
    const rounded = Math.round(raw / 5) * 5;

    return {
      reps: set.reps,
      percent: set.percent,
      weight: rounded
    };
  });
}