import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import HeroHeader from "./HeroHeader";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

export default function DailyProgress({ profile, team }) {

  const [roster, setRoster] = useState([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [workouts, setWorkouts] = useState([]);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */
  useEffect(() => {
    if (!team?.id) return;

    const unsub = onSnapshot(
      collection(db, "athletes", team.id, "roster"),
      snap => {
        setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => unsub();
  }, [team?.id]);

  /* ================= AUTO SELECT SELF (ATHLETE) ================= */
  useEffect(() => {
    if (!profile || isCoach) return;

    const match = roster.find(r => r.linkedUid === profile.uid);
    if (match) setSelectedRosterId(match.id);

  }, [profile, roster, isCoach]);

  /* ================= LOAD WORKOUTS ================= */
  useEffect(() => {
    if (!selectedRosterId) return;

    const q = query(
      collection(db, "workouts"),
      where("athleteRosterId", "==", selectedRosterId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, snap => {
      setWorkouts(snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
    });

    return () => unsub();
  }, [selectedRosterId]);

  /* ================= BUILD GRAPH DATA ================= */
  const chartData = useMemo(() => {

    return workouts.map(w => ({
      date: w.createdAt?.seconds
        ? new Date(w.createdAt.seconds * 1000).toLocaleDateString()
        : "",
      Bench: w.exercise === "Bench" ? w.weight : null,
      Squat: w.exercise === "Squat" ? w.weight : null,
      PowerClean: w.exercise === "PowerClean" ? w.weight : null,
      result: w.result,
      selection: w.selectionValue
    }));

  }, [workouts]);

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "Daily Progress";

  return (
    <div className="workout-wrapper">

      <HeroHeader
        title="Daily Progress"
        image={team?.pageImages?.progress}
      />

      <div className="hero-header">
        <h2>{athleteName}</h2>
      </div>

      <div className="card workout-card">

        <h3>Workout Performance Trend</h3>

        {/* Coach Athlete Selector */}
        {isCoach && (
          <select
            value={selectedRosterId}
            onChange={e => setSelectedRosterId(e.target.value)}
            style={{ marginBottom: 20 }}
          >
            <option value="">Select Athlete</option>
            {roster.map(r => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </select>
        )}

        {!selectedRosterId ? (
          <div>Select an athlete to view data.</div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Legend />

    {/* BENCH */}
    <Line
      type="monotone"
      dataKey="Bench"
      stroke="#3498db"
      strokeWidth={3}
      dot={(props) => {
        const { cx, cy, payload } = props;
        if (payload.Bench == null) return null;

        return (
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill={payload.result === "Pass" ? "#2ecc71" : "#e74c3c"}
            stroke="#ffffff"
            strokeWidth={2}
          />
        );
      }}
    />

    {/* SQUAT */}
    <Line
      type="monotone"
      dataKey="Squat"
      stroke="#e74c3c"
      strokeWidth={3}
      dot={(props) => {
        const { cx, cy, payload } = props;
        if (payload.Squat == null) return null;

        return (
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill={payload.result === "Pass" ? "#2ecc71" : "#e74c3c"}
            stroke="#ffffff"
            strokeWidth={2}
          />
        );
      }}
    />

    {/* POWER CLEAN */}
    <Line
      type="monotone"
      dataKey="PowerClean"
      stroke="#2ecc71"
      strokeWidth={3}
      dot={(props) => {
        const { cx, cy, payload } = props;
        if (payload.PowerClean == null) return null;

        return (
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill={payload.result === "Pass" ? "#2ecc71" : "#e74c3c"}
            stroke="#ffffff"
            strokeWidth={2}
          />
        );
      }}
    />

  </LineChart>
</ResponsiveContainer>
        )}

      </div>
    </div>
  );
}