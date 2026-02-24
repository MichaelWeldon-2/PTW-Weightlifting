import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

const seasonOrder = {
  Summer: 1,
  Fall: 2,
  Winter: 3,
  Spring: 4
};

export default function AthleteProgress({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [workouts, setWorkouts] = useState([]);
  const [liveMaxes, setLiveMaxes] = useState(null);
  const [historicalMaxes, setHistoricalMaxes] = useState([]);

  /* ================= LOAD TEAM ATHLETES ================= */

  useEffect(() => {
    if (!team?.members?.length) {
      setAthletes([]);
      return;
    }

    const q = query(
      collection(db, "users"),
      where("__name__", "in", team.members.slice(0, 10))
    );

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "athlete");

      setAthletes(list);
    });

    return () => unsub();
  }, [team?.members]);

  /* ================= AUTO SELECT SELF ================= */

  useEffect(() => {
    if (profile?.role === "athlete") {
      setSelectedAthlete(profile.uid);
    }
  }, [profile]);

  /* ================= LOAD WORKOUTS ================= */

  useEffect(() => {

    if (!selectedAthlete) {
      setWorkouts([]);
      return;
    }

    const q = query(
      collection(db, "workouts"),
      where("athleteId", "==", selectedAthlete)
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

  }, [selectedAthlete]);

  /* ================= LOAD LIVE MAXES ================= */

  useEffect(() => {

    if (!selectedAthlete) {
      setLiveMaxes(null);
      return;
    }

    const loadLive = async () => {
      const snap = await getDoc(
        doc(db, "seasonMaxesCurrent", selectedAthlete)
      );

      if (snap.exists()) {
        setLiveMaxes(snap.data());
      } else {
        setLiveMaxes(null);
      }
    };

    loadLive();

  }, [selectedAthlete]);

  /* ================= LOAD HISTORICAL SNAPSHOTS ================= */

  useEffect(() => {

    if (!team?.id || !selectedAthlete) {
      setHistoricalMaxes([]);
      return;
    }

    const loadHistory = async () => {

      const q = query(
        collection(db, "seasonMaxes", team.id, "athletes"),
        where("athleteId", "==", selectedAthlete)
      );

      const snap = await getDocs(q);

      const data = snap.docs.map(d => d.data());

      setHistoricalMaxes(data);
    };

    loadHistory();

  }, [team?.id, selectedAthlete]);

  /* ================= CURRENT TOTAL ================= */

  const currentTotal = useMemo(() => {

    if (!liveMaxes) return 0;

    return (
      (liveMaxes.benchMax || 0) +
      (liveMaxes.squatMax || 0) +
      (liveMaxes.powerCleanMax || 0)
    );

  }, [liveMaxes]);

  /* ================= SORTED HISTORICAL DATA ================= */

  const sortedHistory = useMemo(() => {

    if (!historicalMaxes.length) return [];

    return [...historicalMaxes]
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return seasonOrder[a.season] - seasonOrder[b.season];
      });

  }, [historicalMaxes]);

  /* ================= % CHANGE FROM LAST SEASON ================= */

  const percentChange = useMemo(() => {

    if (sortedHistory.length < 1) return null;

    const lastSeason = sortedHistory[sortedHistory.length - 1];

    const previousTotal = lastSeason.total || 0;

    if (!previousTotal) return null;

    return Math.round(
      ((currentTotal - previousTotal) / previousTotal) * 100
    );

  }, [sortedHistory, currentTotal]);

  /* ================= CHART DATA ================= */

  const chartData = useMemo(() => {

    if (!sortedHistory.length) return [];

    return sortedHistory.map(d => ({
      label: `${d.season} ${d.year}`,
      total: d.total || 0
    }));

  }, [sortedHistory]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📈 Athlete Performance Center</h2>

      {profile?.role === "coach" && (
        <select
          value={selectedAthlete}
          onChange={e => setSelectedAthlete(e.target.value)}
        >
          <option value="">Select Athlete</option>
          {athletes.map(a => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      )}

      <hr />

      {/* ================= LIVE MAXES ================= */}

      {liveMaxes && (
        <div className="dashboard-grid">

          <Metric label="Bench" value={`${liveMaxes.benchMax || 0} lbs`} />
          <Metric label="Squat" value={`${liveMaxes.squatMax || 0} lbs`} />
          <Metric label="Power Clean" value={`${liveMaxes.powerCleanMax || 0} lbs`} />
          <Metric label="TOTAL" value={`${currentTotal} lbs`} />

        </div>
      )}

      {/* ================= % CHANGE ================= */}

      {percentChange !== null && (
        <div style={{ marginTop: 20 }}>
          <strong>
            {percentChange > 0 && "🔥 "}
            {percentChange < 0 && "⚠️ "}
            {percentChange === 0 && "➖ "}
            {percentChange}% Change From Last Season
          </strong>
        </div>
      )}

      <hr />

      {/* ================= HISTORICAL CHART ================= */}

      {chartData.length === 0 && (
        <div>No historical season data yet.</div>
      )}

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#0e28b1"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

    </div>
  );
}

/* ================= METRIC CARD ================= */

function Metric({ label, value }) {
  return (
    <div className="card metric-card">
      <h4>{label}</h4>
      <div className="metric-value">{value}</div>
    </div>
  );
}