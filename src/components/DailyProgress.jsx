import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDocs
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
  const [selectedLift, setSelectedLift] = useState("All");
  const [workouts, setWorkouts] = useState([]);
  const [liveMaxes, setLiveMaxes] = useState({});

  const isCoach = profile?.role === "coach";

  const liftColors = {
    Bench: "#2563eb",
    PowerClean: "#facc15",
    Squat: "#9333ea"
  };

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

 /* ================= LOAD WORKOUTS ================= */
useEffect(() => {
  if (!selectedRosterId) return;

  const q = query(
    collection(db, "workouts"),
    where("athleteRosterId", "==", selectedRosterId),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  const unsub = onSnapshot(q, snap => {
    const allData = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // ---------- ALL MODE ----------
    if (selectedLift === "All") {

      const latestPerLift = {};

      for (const workout of allData) {
        if (!latestPerLift[workout.exercise]) {
          latestPerLift[workout.exercise] = workout;
        }
      }

      const results = Object.values(latestPerLift)
        .sort((a, b) =>
          (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );

      setWorkouts(results);
      return;
    }

    // ---------- SINGLE LIFT MODE ----------
    const filtered = allData
      .filter(w => w.exercise === selectedLift)
      .slice(0, 25)
      .reverse();

    setWorkouts(filtered);
  });

  return () => unsub();

}, [selectedRosterId, selectedLift]);

  /* ================= BUILD GRAPH DATA ================= */
  const chartData = useMemo(() => {

    if (selectedLift === "All") {
      return workouts.map((w, index) => ({
        label: w.exercise,
        weight: w.weight,
        result: w.result,
        exercise: w.exercise,
        selection: w.selectionValue
      }));
    }

    return workouts.map((w, index) => ({
      label: index + 1,
      weight: w.weight,
      result: w.result,
      selection: w.selectionValue
    }));

  }, [workouts, selectedLift]);

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "Daily Progress";

  const lineColor =
    selectedLift === "All"
      ? "#000000"
      : liftColors[selectedLift];

  return (
    <div className="workout-wrapper">

      <HeroHeader
        title="Daily Progress"
        image={team?.pageImages?.progress}
      />

      {/* ================= LIVE MAX CARD ================= */}
      {selectedRosterId && (
        <div className="card workout-card" style={{ marginBottom: 20 }}>
          <h3>{athleteName}-Current Maxes</h3>
          <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center" }}>
            <div><strong>Bench</strong><div>{liveMaxes?.benchMax || 0} lbs</div></div>
            <div><strong>Squat</strong><div>{liveMaxes?.squatMax || 0} lbs</div></div>
            <div><strong>Power Clean</strong><div>{liveMaxes?.powerCleanMax || 0} lbs</div></div>
          </div>
        </div>
      )}

      {/* ================= GRAPH ================= */}
      <div className="card workout-card">

        <h3>
          {selectedLift === "All"
            ? "Most Recent Workout Per Lift"
            : `Last 25 ${selectedLift} Workouts`}
        </h3>

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
          <option value="All">All</option>
          <option value="Bench">Bench</option>
          <option value="PowerClean">Power Clean</option>
          <option value="Squat">Squat</option>
        </select>

        {!selectedRosterId ? (
          <div>Select an athlete to view data.</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                formatter={(value, name, props) => {
                  const selection = props.payload.selection;

                  if (selectedLift === "All") {
                    return [`${value} lbs`, props.payload.exercise];
                  }

                  if (selectedLift === "Squat") {
                    return [`${value} lbs (${selection}%)`, "Weight"];
                  }

                  return selection === "Max"
                    ? [`${value} lbs (Max)`, "Weight"]
                    : [`${value} lbs (Box ${selection})`, "Weight"];
                }}
              />

              <Line
                type="monotone"
                dataKey="weight"
                stroke={lineColor}
                strokeWidth={3}
                dot={({ cx, cy, payload }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.result === "Pass" ? "#22c55e" : "#ef4444"}
                    stroke={
                      selectedLift === "All"
                        ? liftColors[payload.exercise]
                        : liftColors[selectedLift]
                    }
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