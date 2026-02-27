export function calculateTeamAnalytics(workouts, roster, days = 30) {

  if (!workouts?.length) {
    return {
      passRate: 0,
      totalVolume: 0,
      improving: 0,
      declining: 0,
      improvingList: [],
      decliningList: [],
      alerts: 0,
      topPerformer: null,
      mostImproved: null,
      fatigueStatus: "Stable"
    };
  }

  const cutoff = Date.now() - days * 86400000;

  const filtered = workouts.filter(w => {
    const ts = w.createdAt?.seconds
      ? w.createdAt.seconds * 1000
      : null;
    return ts && ts >= cutoff;
  });

  if (!filtered.length) {
    return {
      passRate: 0,
      totalVolume: 0,
      improving: 0,
      declining: 0,
      improvingList: [],
      decliningList: [],
      alerts: 0,
      topPerformer: null,
      mostImproved: null,
      fatigueStatus: "Stable"
    };
  }

  let totalPass = 0;
  let totalAttempts = 0;
  let totalVolume = 0;

  const athleteMap = {};
  const progressMap = {};
  const streakMap = {};

  // ✅ ADD THESE (you were missing them)
  const improvingList = [];
  const decliningList = [];

  filtered.forEach(w => {

    const weight = Number(w.weight) || 0;
    if (!weight || w.result === "Override") return;

    totalAttempts++;
    totalVolume += weight;
    if (w.result === "Pass") totalPass++;

    const rosterEntry = roster.find(r => r.id === w.athleteRosterId);
    const name =
      rosterEntry?.displayName ||
      w.athleteDisplayName ||
      "Unknown";

    /* ===== STREAK TRACKING ===== */

    const streakKey = `${w.athleteRosterId}-${w.exercise}-${w.weight}`;
    if (!streakMap[streakKey]) streakMap[streakKey] = 0;

    if (w.result === "Fail") streakMap[streakKey]++;
    else streakMap[streakKey] = 0;

    /* ===== PROGRESS TRACKING ===== */

    const progressKey = `${w.athleteRosterId}-${w.exercise}`;
    if (!progressMap[progressKey]) {
      progressMap[progressKey] = {
        athleteId: w.athleteRosterId,
        athleteName: name,
        weights: []
      };
    }

    progressMap[progressKey].weights.push(weight);

    /* ===== ATHLETE AGGREGATE ===== */

    if (!athleteMap[w.athleteRosterId]) {
      athleteMap[w.athleteRosterId] = {
        id: w.athleteRosterId,
        name,
        volume: 0,
        weights: [],
        fails: 0
      };
    }

    athleteMap[w.athleteRosterId].volume += weight;
    athleteMap[w.athleteRosterId].weights.push(weight);

    if (w.result === "Fail") {
      athleteMap[w.athleteRosterId].fails++;
    }
  });

  /* ===== PASS RATE ===== */

  const passRate =
    totalAttempts > 0
      ? Math.round((totalPass / totalAttempts) * 100)
      : 0;

  /* ===== IMPROVEMENT LOGIC ===== */

  Object.values(progressMap).forEach(p => {
    if (p.weights.length >= 2) {
      const first = p.weights[0];
      const last = p.weights[p.weights.length - 1];
      const diff = last - first;

      if (diff > 0) {
        improvingList.push({ name: p.athleteName, diff });
      }

      if (diff < 0) {
        decliningList.push({ name: p.athleteName, diff });
      }
    }
  });

  /* ===== ALERTS ===== */

  const alerts =
    Object.values(streakMap).filter(v => v >= 3).length;

  /* ===== TOP PERFORMER ===== */

  const topPerformer =
    Object.values(athleteMap)
      .sort((a,b)=>b.volume - a.volume)[0] || null;

  /* ===== MOST IMPROVED ===== */

  let mostImproved = null;
  let bestImprovement = 0;

  Object.values(athleteMap).forEach(a => {
    if (a.weights.length >= 2) {
      const improvement =
        a.weights[a.weights.length - 1] - a.weights[0];

      if (improvement > bestImprovement) {
        bestImprovement = improvement;
        mostImproved = a;
      }
    }
  });

  /* ===== FATIGUE ===== */

  const totalFails =
    Object.values(athleteMap)
      .reduce((sum,a)=>sum+a.fails,0);

  const failRate =
    totalAttempts > 0
      ? totalFails / totalAttempts
      : 0;

  let fatigueStatus = "Stable";
  if (failRate >= 0.5) fatigueStatus = "Critical";
  else if (failRate >= 0.3) fatigueStatus = "Warning";

  return {
    passRate,
    totalVolume,
    fatigueStatus,
    topPerformer,
    mostImproved,
    improving: improvingList.length,
    declining: decliningList.length,
    improvingList,
    decliningList,
    alerts
  };
}