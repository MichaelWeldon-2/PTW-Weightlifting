import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc
} from "firebase/firestore";
import { db } from "../firebase";
import HeroHeader from "./HeroHeader";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

export default function DailyProgress({ profile, team }) {

  const [roster, setRoster] = useState([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [selectedLift, setSelectedLift] = useState("Bench");
  const [workouts, setWorkouts] = useState([]);
  const [liveMaxes, setLiveMaxes] = useState({});

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

  /* ================= AUTO SELECT SELF ================= */
  useEffect(() => {
    if (!profile || isCoach) return;
    const match = roster.find(r => r.linkedUid === profile.uid);
    if (match) setSelectedRosterId(match.id);
  }, [profile, roster, isCoach]);

  /* ================= LOAD LIVE MAXES ================= */
  useEffect(() => {
    if (!selectedRosterId) return;

    const unsub = onSnapshot(
      doc(db, "seasonMaxesCurrent", selectedRosterId),
      snap => {
        setLiveMaxes(snap.exists() ? snap.data() : {});
      }
    );

    return () => unsub();
  }, [selectedRosterId]);

  /* ================= LOAD LAST 25 LIFTS FOR SELECTED EXERCISE ================= */
  useEffect(() => {
    if (!selectedRosterId) return;

    const q = query(
      collection(db, "workouts"),
      where("athleteRosterId", "==", selectedRosterId),
      where("exercise", "==", selectedLift),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse(); // reverse so graph goes oldest → newest

      setWorkouts(data);
    });

    return () => unsub();
  }, [selectedRosterId, selectedLift]);

  /* ================= BUILD GRAPH DATA ================= */
  const chartData = useMemo(() => {
    return workouts.map((w, index) => ({
      attempt: index + 1,
      weight: w.weight,
      result: w.result,
      selection: w.selectionValue
    }));
  }, [workouts]);

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "Daily Progress";

  const liftColors = {
    Bench: "#2563eb",
    PowerClean: "#facc15",   // Yellow
    Squat: "#9333ea"         // Purple
  };

  return (
    <div className="workout-wrapper">

      <HeroHeader
        title="Daily Progress"
        image={team?.pageImages?.progress}
      />

      <div className="hero-header">
        <h2>{athleteName}</h2>
      </div>

      {/* ================= LIVE MAX CARD ================= */}
      {selectedRosterId && (
        <div className="card workout-card" style={{ marginBottom: 20 }}>
          <h3>Current Maxes</h3>
          <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center" }}>
            <div>
              <strong>Bench</strong>
              <div>{liveMaxes?.benchMax || 0} lbs</div>
            </div>
            <div>
              <strong>Squat</strong>
              <div>{liveMaxes?.squatMax || 0} lbs</div>
            </div>
            <div>
              <strong>Power Clean</strong>
              <div>{liveMaxes?.powerCleanMax || 0} lbs</div>
            </div>
          </div>
        </div>
      )}

      {/* ================= GRAPH ================= */}
      <div className="card workout-card">

        <h3>Last 25 {selectedLift} Workouts</h3>

        {/* Coach Selector */}
        {isCoach && (
          <select
            value={selectedRosterId}
            onChange={e => setSelectedRosterId(e.target.value)}
            style={{ marginBottom: 15 }}
          >
            <option value="">Select Athlete</option>
            {roster.map(r => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </select>
        )}

        {/* Lift Selector */}
        <select
          value={selectedLift}
          onChange={e => setSelectedLift(e.target.value)}
          style={{ marginBottom: 20 }}
        >
          <option value="Bench">Bench</option>
          <option value="PowerClean">Power Clean</option>
          <option value="Squat">Squat</option>
        </select>

        {!selectedRosterId ? (
          <div>Select an athlete to view data.</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="attempt" />
              <YAxis />
              <Tooltip
                formatter={(value, name, props) => {
                  const selection = props.payload.selection;
                  if (selectedLift === "Squat") {
                    return [`${value} lbs (${selection}%)`, "Weight"];
                  }
                  return selection === "Max"
                    ? [`${value} lbs (Max)`, "Weight"]
                    : [`${value} lbs (Box ${selection})`, "Weight"];
                }}
              />

              {/* BLACK CONNECTING LINE */}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#000000"
                strokeWidth={3}
                dot={({ cx, cy, payload }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.result === "Pass" ? "#22c55e" : "#ef4444"}
                    stroke={liftColors[selectedLift]}
                    strokeWidth={2}
                  />
                )}
              />

            </LineChart>
          </ResponsiveContainer>
        )}

      </div>
    </div>
  );
}