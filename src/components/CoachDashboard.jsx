import { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function CoachDashboard({ team }) {

  const [workouts, setWorkouts] = useState([]);
  const [timeFilter, setTimeFilter] = useState(30);

  /* ================= LOAD TEAM WORKOUTS ================= */

  useEffect(() => {

    if (!team?.id) {
      setWorkouts([]);
      return;
    }

    const q = query(
      collection(db, "workouts"),
      where("teamId", "==", team.id)
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

  }, [team?.id]);

  /* ================= TIME FILTER ================= */

  const filteredWorkouts = useMemo(() => {

    const cutoff = Date.now() - timeFilter * 86400000;

    return workouts.filter(w => {
      const timestamp = w.createdAt?.seconds
        ? w.createdAt.seconds * 1000
        : null;

      return timestamp && timestamp >= cutoff;
    });

  }, [workouts, timeFilter]);

  /* ================= ANALYTICS ================= */

  const analytics = useMemo(() => {

    if (!filteredWorkouts.length) {
      return {
        passRate: 0,
        totalVolume: 0,
        improving: 0,
        declining: 0,
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

    filteredWorkouts.forEach(w => {

      if (!w?.weight) return;
      if (w.result === "Override") return;

      const weight = Number(w.weight);
      if (!weight || weight <= 0) return;

      totalAttempts++;
      totalVolume += weight;

      if (w.result === "Pass") totalPass++;

      const streakKey = `${w.athleteRosterId}-${w.exercise}-${w.weight}`;
      if (!streakMap[streakKey]) streakMap[streakKey] = 0;

      if (w.result === "Fail") {
        streakMap[streakKey]++;
      } else {
        streakMap[streakKey] = 0;
      }

      const progressKey = `${w.athleteRosterId}-${w.exercise}`;
      if (!progressMap[progressKey]) {
        progressMap[progressKey] = {
          athleteName: w.athleteDisplayName,
          weights: []
        };
      }

      progressMap[progressKey].weights.push(weight);

      if (!athleteMap[w.athleteRosterId]) {
        athleteMap[w.athleteRosterId] = {
          name: w.athleteDisplayName,
          volume: 0,
          attempts: 0,
          fails: 0,
          weights: []
        };
      }

      athleteMap[w.athleteRosterId].volume += weight;
      athleteMap[w.athleteRosterId].attempts++;
      athleteMap[w.athleteRosterId].weights.push(weight);

      if (w.result === "Fail") {
        athleteMap[w.athleteRosterId].fails++;
      }

    });

    const passRate =
      totalAttempts > 0
        ? Math.round((totalPass / totalAttempts) * 100)
        : 0;

    let improving = 0;
    let declining = 0;

    Object.values(progressMap).forEach(p => {
      if (p.weights.length >= 2) {
        const first = p.weights[0];
        const last = p.weights[p.weights.length - 1];

        if (last > first) improving++;
        if (last < first) declining++;
      }
    });

    const alerts =
      Object.values(streakMap)
        .filter(v => v >= 3).length;

    const topPerformer =
      Object.values(athleteMap)
        .sort((a,b)=>b.volume - a.volume)[0] || null;

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

    const totalFails =
      Object.values(athleteMap)
        .reduce((sum,a)=>sum+a.fails,0);

    const failRate =
      totalAttempts > 0 ? totalFails / totalAttempts : 0;

    let fatigueStatus = "Stable";
    if (failRate >= 0.5) fatigueStatus = "Critical";
    else if (failRate >= 0.3) fatigueStatus = "Warning";

    return {
      passRate,
      totalVolume,
      improving,
      declining,
      alerts,
      topPerformer,
      mostImproved,
      fatigueStatus
    };

  }, [filteredWorkouts]);

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
        <Metric label="Top Performer" value={analytics.topPerformer?.name || "N/A"} />
        <Metric label="Most Improved" value={analytics.mostImproved?.name || "N/A"} />
        <Metric label="Improving Athletes" value={analytics.improving} />
        <Metric label="Declining Athletes" value={analytics.declining} />
        <Metric label="Team Fatigue" value={analytics.fatigueStatus} />
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