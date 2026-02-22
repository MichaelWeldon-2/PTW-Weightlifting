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

  /* ================= ANALYTICS ENGINE ================= */

  const analytics = useMemo(() => {

    if (!filteredWorkouts.length) {
      return {
        passRate: 0,
        totalVolume: 0,
        improving: 0,
        declining: 0,
        athleteOfPeriod: null,
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

    sorted.forEach(w => {

      if (!w.weight) return;

      const weight = Number(w.weight);

      totalAttempts++;
      totalVolume += weight;
      if (w.result === "Pass") totalPass++;

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

      if (!progressMap[w.athleteId]) {
        progressMap[w.athleteId] = [];
      }

      progressMap[w.athleteId].push(weight);

    });

    const passRate =
      totalAttempts > 0
        ? Math.round((totalPass / totalAttempts) * 100)
        : 0;

    let improving = 0;
    let declining = 0;

    Object.values(progressMap).forEach(weights => {
      if (weights.length >= 2) {
        if (weights[weights.length - 1] > weights[0]) improving++;
        if (weights[weights.length - 1] < weights[0]) declining++;
      }
    });

    const athleteOfPeriod =
      Object.values(athleteMap)
        .sort((a,b)=>b.volume - a.volume)[0] || null;

    const teamRecommendations = [];

    if (passRate < 65) {
      teamRecommendations.push(
        "Team intensity likely too high — adjust program"
      );
    }

    if (improving > declining * 2 && improving > 0) {
      teamRecommendations.push(
        "Team progressing well — increase block intensity"
      );
    }

    return {
      passRate,
      totalVolume,
      improving,
      declining,
      athleteOfPeriod,
      teamRecommendations
    };

  }, [filteredWorkouts]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>🧠 Coach Intelligence Dashboard</h2>

      <div style={{ marginBottom: 20 }}>
        <select
          value={timeFilter}
          onChange={e => setTimeFilter(Number(e.target.value))}
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      <div className="dashboard-grid">
        <Metric label="Pass Rate" value={`${analytics.passRate}%`} />
        <Metric label="Total Volume" value={`${analytics.totalVolume.toLocaleString()} lbs`} />
        <Metric label="Improving" value={analytics.improving} />
        <Metric label="Declining" value={analytics.declining} />
      </div>

      <hr />

      <h3>🏆 Athlete of Period</h3>
      <p>
        {analytics.athleteOfPeriod?.name || "N/A"}
      </p>

      <hr />

      <h3>🧭 Team Programming Direction</h3>

      {analytics.teamRecommendations.length === 0 && (
        <p>No changes recommended</p>
      )}

      {analytics.teamRecommendations.map((r, i) => (
        <div key={i} className="recommendation-box">
          {r}
        </div>
      ))}

    </div>
  );
}

/* ================= METRIC COMPONENT ================= */

function Metric({ label, value }) {
  return (
    <div className="card metric-card">
      <h4>{label}</h4>
      <div className="metric-value">{value}</div>
    </div>
  );
}