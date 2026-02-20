export function getCurrentSeason() {
  const month = new Date().getMonth(); // 0-11
  const year = new Date().getFullYear();

  if (month >= 5 && month <= 7) {
    return { season: "Summer", year };
  }

  if (month >= 8 && month <= 10) {
    return { season: "Fall", year };
  }

  if (month === 11 || month <= 1) {
    return { season: "Winter", year };
  }

  return { season: "Spring", year };
}
