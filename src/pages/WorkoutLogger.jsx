import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

export default function WorkoutLogger({ team, profile }) {

  const [workouts, setWorkouts] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [roster, setRoster] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id || !isCoach) return;

    const unsub = onSnapshot(
      collection(db, "athletes", team.id, "roster"),
      snap => {
        const list = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setRoster(list);
      }
    );

    return () => unsub();
  }, [team?.id, isCoach]);

  /* ================= LOAD WORKOUTS ================= */

  useEffect(() => {
    if (!team?.id) return;

    let q;

    if (isCoach) {
      if (selectedAthlete) {
        q = query(
          collection(db, "workouts"),
          where("teamId", "==", team.id),
          where("athleteRosterId", "==", selectedAthlete),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      } else {
        q = query(
          collection(db, "workouts"),
          where("teamId", "==", team.id),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      }
    } else {
      q = query(
        collection(db, "workouts"),
        where("teamId", "==", team.id),
        where("athleteRosterId", "==", profile.athleteId),
        orderBy("createdAt", "desc"),
        limit(50)
      );
    }

    const unsub = onSnapshot(q, snap => {
      setWorkouts(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();

  }, [team?.id, isCoach, selectedAthlete, profile]);

  /* ================= PR DETECTION ================= */

  const workoutsWithPR = useMemo(() => {

    if (!workouts.length) return [];

    const prMap = {};

    return workouts.map(w => {

      const key = `${w.athleteRosterId}_${w.exercise}`;

      if (!prMap[key] || w.weight > prMap[key]) {
        prMap[key] = w.weight;
        return { ...w, isPR: true };
      }

      return { ...w, isPR: false };

    });

  }, [workouts]);

  /* ================= GROUP BY DATE ================= */

  const groupedWorkouts = useMemo(() => {

    const groups = {};

    workoutsWithPR.forEach(w => {

      const dateKey = w.createdAt?.seconds
        ? new Date(w.createdAt.seconds * 1000).toLocaleDateString()
        : "Unknown Date";

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(w);

    });

    return Object.entries(groups).sort(
      (a, b) => new Date(b[0]) - new Date(a[0])
    );

  }, [workoutsWithPR]);

  /* ================= FORMAT SELECTION ================= */

  const formatSelection = (w) => {
    if (w.selectionValue === "Max") return "Max Attempt";

    if (w.exercise === "Squat") {
      return `${w.selectionValue}%`;
    }

    return `Box ${w.selectionValue}`;
  };

  const formatExpandedSelection = (w) => {
    if (!w.selectionValue) return "-";

    if (w.exercise === "Squat") {
      return w.selectionValue === "Max"
        ? "Max"
        : `${w.selectionValue}%`;
    }

    return w.selectionValue === "Max"
      ? "Max"
      : `Box ${w.selectionValue}`;
  };

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📋 Workout Log</h2>

      {isCoach && (
        <select
          value={selectedAthlete}
          onChange={e => setSelectedAthlete(e.target.value)}
          style={{ marginBottom: 15 }}
        >
          <option value="">All Athletes</option>
          {roster.map(r => (
            <option key={r.id} value={r.id}>
              {r.displayName}
            </option>
          ))}
        </select>
      )}

      {groupedWorkouts.length === 0 && (
        <div>No workouts yet.</div>
      )}

      {groupedWorkouts.map(([date, lifts]) => {

        const isOpen = expanded === date;

        return (
          <div
            key={date}
            className="card metric-card"
            style={{ marginBottom: 12, cursor: "pointer" }}
            onClick={() => setExpanded(isOpen ? null : date)}
          >

            <strong>{date}</strong>

            {isCoach && lifts[0]?.athleteDisplayName && (
              <div style={{ fontSize: 12 }}>
                {lifts[0].athleteDisplayName}
              </div>
            )}

            {lifts.map(lift => (

              <div key={lift.id} style={{ marginTop: 5 }}>

                {lift.exercise} — {lift.weight} lbs —{" "}
                {formatSelection(lift)} —{" "}
                <span
                  style={{
                    color:
                      lift.result === "Pass"
                        ? "#22c55e"
                        : lift.result === "Fail"
                        ? "#ef4444"
                        : "#f59e0b"
                  }}
                >
                  {lift.result}
                </span>

                {lift.isPR && " 🏆"}

                {isOpen && (
                  <div style={{ fontSize: 12, marginLeft: 10 }}>
                    Selection: {formatExpandedSelection(lift)}
                    <br />
                    Override Reason: {lift.overrideReason || "-"}
                  </div>
                )}

              </div>

            ))}

          </div>
        );
      })}

    </div>
  );
}
