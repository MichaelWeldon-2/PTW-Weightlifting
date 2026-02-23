import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc
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

export default function AthleteProgress({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [workouts, setWorkouts] = useState([]);
  const [maxData, setMaxData] = useState(null);

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

  /* ================= LOAD MAX DOCUMENT ================= */

  useEffect(() => {

    if (!selectedAthlete) {
      setMaxData(null);
      return;
    }

    const loadMax = async () => {
      const snap = await getDoc(doc(db, "seasonMaxes", selectedAthlete));

      if (snap.exists()) {
        setMaxData(snap.data());
      } else {
        setMaxData(null);
      }
    };

    loadMax();

  }, [selectedAthlete]);

  /* ================= CHART DATA ================= */

  const chartData = useMemo(() => {

    if (!workouts.length) return [];

    return workouts
      .filter(w => w.createdAt?.seconds)
      .sort((a, b) =>
        a.createdAt.seconds - b.createdAt.seconds
      )
      .map(w => ({
        date: new Date(w.createdAt.seconds * 1000)
          .toLocaleDateString(),
        weight: Number(w.weight) || 0
      }));

  }, [workouts]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📈 Athlete Progress</h2>

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

      {/* ================= CURRENT MAXES ================= */}

      {maxData && (
        <div className="dashboard-grid">

          <div className="card metric-card">
            <h4>Bench Max</h4>
            <div className="metric-value">
              {maxData.benchMax || 0} lbs
            </div>
          </div>

          <div className="card metric-card">
            <h4>Squat Max</h4>
            <div className="metric-value">
              {maxData.squatMax || 0} lbs
            </div>
          </div>

          <div className="card metric-card">
            <h4>Power Clean Max</h4>
            <div className="metric-value">
              {maxData.powerCleanMax || 0} lbs
            </div>
          </div>

        </div>
      )}

      <hr />

      {/* ================= CHART ================= */}

      {chartData.length === 0 && (
        <div>No workout data available.</div>
      )}

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#0e28b1"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

    </div>
  );
}