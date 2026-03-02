import { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { calculateTeamAnalytics } from "../utils/teamAnalytics";
import HeroHeader from "../components/HeroHeader";
export default function CoachDashboard({ team }) {

  const [workouts, setWorkouts] = useState([]);
  const [roster, setRoster] = useState([]);
  const [timeFilter, setTimeFilter] = useState(30);
  const [showImproving, setShowImproving] = useState(false);
  const [showDeclining, setShowDeclining] = useState(false);

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

  /* ================= LOAD WORKOUTS ================= */

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

        <div
          className="card metric-card"
          onClick={() => setShowImproving(!showImproving)}
          style={{ cursor: "pointer" }}
        >
          <h4>Improving Athletes</h4>
          <div className="metric-value">{analytics.improving}</div>
        </div>

        <div
          className="card metric-card"
          onClick={() => setShowDeclining(!showDeclining)}
          style={{ cursor: "pointer" }}
        >
          <h4>Declining Athletes</h4>
          <div className="metric-value">{analytics.declining}</div>
        </div>

        <Metric label="Team Fatigue" value={analytics.fatigueStatus} />
        <Metric label="Alerts" value={analytics.alerts} />
      </div>

      {/* ================= BREAKDOWN PANELS ================= */}

      {showImproving && (
        <div className="card">
          <h3>📈 Improving Athletes</h3>
          {analytics.improvingList.length === 0 && <div>No improving athletes.</div>}
          {analytics.improvingList.map((a, i) => (
            <div key={i}>
              {a.name} — +{a.diff} lbs
            </div>
          ))}
        </div>
      )}

      {showDeclining && (
        <div className="card">
          <h3>📉 Declining Athletes</h3>
          {analytics.decliningList.length === 0 && <div>No declining athletes.</div>}
          {analytics.decliningList.map((a, i) => (
            <div key={i}>
              {a.name} — {a.diff} lbs
            </div>
          ))}
        </div>
      )}

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
  <HeroHeader
  title="Coach Dashboard"
  image={team?.pageImages?.coach}
/>
}