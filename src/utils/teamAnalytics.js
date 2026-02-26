import { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { calculateTeamAnalytics } from "../utils/teamAnalytics";
export default function CoachDashboard({ team }) {

  const [workouts, setWorkouts] = useState([]);
  const [roster, setRoster] = useState([]);
  const [timeFilter, setTimeFilter] = useState(30);

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) {
      setRoster([]);
      return;
    }

    const rosterRef = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(rosterRef, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setRoster(list);
    });

    return () => unsub();
  }, [team?.id]);

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
  return calculateTeamAnalytics(workouts, roster, timeFilter);
}, [workouts, roster, timeFilter]);

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