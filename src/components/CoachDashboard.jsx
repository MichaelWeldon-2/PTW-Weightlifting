import { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function CoachDashboard({ profile }) {

  const [workouts, setWorkouts] = useState([]);
  const [timeFilter, setTimeFilter] = useState(30);

  /* ================= LOAD TEAM WORKOUTS ================= */

  useEffect(() => {

    if (!profile?.teamId) {
      setWorkouts([]);
      return;
    }

    const q = query(
      collection(db, "workouts"),
      where("teamId", "==", profile.teamId)
    );

    const unsub = onSnapshot(q, snap => {
      setWorkouts(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();

  }, [profile?.teamId]);

  /* ================= TIME FILTER ================= */

  const filteredWorkouts = useMemo(() => {

    const cutoff = Date.now() - timeFilter * 86400000;

    return workouts.filter(w =>
      w.createdAt?.seconds &&
      w.createdAt.seconds * 1000 >= cutoff
    );

  }, [workouts, timeFilter]);

  /* ================= INTELLIGENCE ENGINE ================= */

  const analytics = useMemo(() => {

    if (!filteredWorkouts.length) {
      return {
        passRate: 0,
        totalVolume: 0,
        improving: 0,
        declining: 0,
        alerts: 0,
        riskIndex: [],
        athleteOfPeriod: null,
        insights: [],
        teamRecommendations: []
      };
    }

    const sorted = [...filteredWorkouts]
      .filter(w => w.createdAt?.seconds)
      .sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);

    let totalPass = 0;
    let totalAttempts = 0;
    let totalVolume = 0;

    const athleteMap = {};
    const progressMap = {};
    const streakMap = {};
    const insights = [];

    sorted.forEach(w => {

      const weight = Number(w.weight || 0);

      totalAttempts++;
      totalVolume += weight;
      if (w.result === "Pass") totalPass++;

      /* ===== STREAK TRACKING ===== */

      const streakKey = `${w.athleteId}-${w.exercise}-${w.weight}`;

      if (!streakMap[streakKey]) streakMap[streakKey] = 0;

      if (w.result === "Fail") {
        streakMap[streakKey]++;
      } else {
        streakMap[streakKey] = 0;
      }

      /* ===== PROGRESS TRACKING ===== */

      const progressKey = `${w.athleteId}-${w.exercise}`;

      if (!progressMap[progressKey]) {
        progressMap[progressKey] = {
          athleteName: w.athleteName,
          weights: []
        };
      }

      progressMap[progressKey].weights.push(weight);

      /* ===== ATHLETE AGGREGATE ===== */

      if (!athleteMap[w.athleteId]) {
        athleteMap[w.athleteId] = {
          name: w.athleteName,
          volume: 0,
          attempts: 0,
          fails: 0
        };
      }

      athleteMap[w.athleteId].volume += weight;
      athleteMap[w.athleteId].attempts++;
      if (w.result === "Fail") athleteMap[w.athleteId].fails++;

    });

    const passRate =
      totalAttempts > 0
        ? Math.round((totalPass / totalAttempts) * 100)
        : 0;

    /* ===== IMPROVEMENT ===== */

    let improving = 0;
    let declining = 0;

    Object.values(progressMap).forEach(p => {
      if (p.weights.length >= 2) {
        if (p.weights[p.weights.length - 1] > p.weights[0]) improving++;
        if (p.weights[p.weights.length - 1] < p.weights[0]) declining++;
      }
    });

    /* ===== ALERTS ===== */

    const alerts =
      Object.values(streakMap)
        .filter(v => v >= 3).length;

    /* ===== RISK INDEX ===== */

    const riskIndex =
      Object.values(athleteMap)
        .map(a => {

          const failRate =
            a.attempts > 0 ? a.fails / a.attempts : 0;

          let status = "Stable";

          if (failRate >= 0.5) status = "Critical";
          else if (failRate >= 0.3) status = "Warning";

          return {
            name: a.name,
            status
          };

        });

    /* ===== ATHLETE OF PERIOD ===== */

    const athleteOfPeriod =
      Object.values(athleteMap)
        .sort((a,b)=>b.volume - a.volume)[0] || null;

    /* ===== TEAM RECOMMENDATIONS ===== */

    const teamRecommendations = [];

    if (passRate < 65) {
      teamRecommendations.push(
        "Team intensity too high — reduce load"
      );
    }

    if (improving > declining * 2 && improving > 0) {
      teamRecommendations.push(
        "Team progressing well — increase block intensity"
      );
    }

    /* ===== PLATEAU DETECTION ===== */

    Object.values(progressMap).forEach(p => {

      if (p.weights.length >= 6) {

        const last6 = p.weights.slice(-6);

        if (Math.max(...last6) - Math.min(...last6) <= 5) {
          insights.push({
            message: `${p.athleteName} plateauing`
          });
        }

      }

    });

    return {
      passRate,
      totalVolume,
      improving,
      declining,
      alerts,
      riskIndex,
      athleteOfPeriod,
      insights,
      teamRecommendations
    };

  }, [filteredWorkouts]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>🧠 Coach Intelligence Dashboard</h2>

      <select
        value={timeFilter}
        onChange={e => setTimeFilter(Number(e.target.value))}
      >
        <option value={7}>Last 7 Days</option>
        <option value={30}>Last 30 Days</option>
        <option value={90}>Last 90 Days</option>
      </select>

      <div className="dashboard-grid">
        <Metric label="Pass Rate" value={`${analytics.passRate}%`} />
        <Metric label="Total Volume" value={`${analytics.totalVolume.toLocaleString()} lbs`} />
        <Metric label="Improving" value={analytics.improving} />
        <Metric label="Declining" value={analytics.declining} />
        <Metric label="Alerts" value={analytics.alerts} />
      </div>

    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="card metric-card">
      <h4>{label}</h4>
      <div className="metric-value">{value}</div>
    </div>
  );
}