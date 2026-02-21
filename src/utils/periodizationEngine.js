export function generateProgram({
  seasonLength,
  level,
  emphasisLift
}) {
  const blocks = []

  const volumeWeeks = Math.floor(seasonLength * 0.25)
  const strengthWeeks = Math.floor(seasonLength * 0.25)
  const intensityWeeks = Math.floor(seasonLength * 0.3)
  const peakWeeks = seasonLength - (volumeWeeks + strengthWeeks + intensityWeeks)

  function buildWeeklyTargets(start, end, baseIntensity, increment) {
    const weeklyTargets = {}
    let current = baseIntensity

    for (let week = start; week <= end; week++) {
      weeklyTargets[week] = {
        bench: current,
        squat: current + 2,
        powerClean: current - 2
      }

      if (emphasisLift && weeklyTargets[week][emphasisLift]) {
        weeklyTargets[week][emphasisLift] += 3
      }

      current += increment
    }

    return weeklyTargets
  }

  let currentWeek = 1

  // Volume Block
  const volumeEnd = currentWeek + volumeWeeks - 1
  blocks.push({
    name: "Volume",
    startWeek: currentWeek,
    endWeek: volumeEnd,
    weeklyTargets: buildWeeklyTargets(currentWeek, volumeEnd, 65, 2)
  })
  currentWeek = volumeEnd + 1

  // Strength Block
  const strengthEnd = currentWeek + strengthWeeks - 1
  blocks.push({
    name: "Strength",
    startWeek: currentWeek,
    endWeek: strengthEnd,
    weeklyTargets: buildWeeklyTargets(currentWeek, strengthEnd, 75, 2)
  })
  currentWeek = strengthEnd + 1

  // Intensity Block
  const intensityEnd = currentWeek + intensityWeeks - 1
  blocks.push({
    name: "Intensity",
    startWeek: currentWeek,
    endWeek: intensityEnd,
    weeklyTargets: buildWeeklyTargets(currentWeek, intensityEnd, 85, 1.5)
  })
  currentWeek = intensityEnd + 1

  // Peak Block
  blocks.push({
    name: "Peak",
    startWeek: currentWeek,
    endWeek: seasonLength,
    weeklyTargets: buildWeeklyTargets(currentWeek, seasonLength, 90, 1)
  })

  return blocks
}