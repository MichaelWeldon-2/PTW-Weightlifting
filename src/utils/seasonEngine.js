export const seasonOrder = {
  Summer: 1,
  Fall: 2,
  Winter: 3,
  Spring: 4
};

/*
  TRAINING YEAR RULE:

  Summer + Fall = calendar year
  Winter + Spring = previous calendar year training cycle
*/

export function getTrainingYear(season, year) {
  if (season === "Winter" || season === "Spring") {
    return year - 1;
  }
  return year;
}

export function getSeasonIndex(season, year) {
  const trainingYear = getTrainingYear(season, year);
  const order = seasonOrder[season] || 0;

  return trainingYear * 10 + order;
}

/*
  Sort helper for any season array
*/
export function sortSeasonsChronologically(data) {
  return [...data].sort((a, b) => {
    return (
      getSeasonIndex(a.season, a.year) -
      getSeasonIndex(b.season, b.year)
    );
  });
}