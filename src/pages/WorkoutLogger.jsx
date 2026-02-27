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

  /* ================= LOAD ROSTER (FOR COACH FILTER) ================= */

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
      // Coach sees all OR filtered athlete
      if (selectedAthlete) {
        q = query(
          collection(db, "workouts"),
          where("teamId", "==", team.id),
          where("athleteRosterId", "==", selectedAthlete),
          orderBy("createdAt", "desc"),
          limit(30)
        );
      } else {
        q = query(
          collection(db, "workouts"),
          where("teamId", "==", team.id),
          orderBy("createdAt", "desc"),
          limit(30)
        );
      }
    } else {
      // Athlete sees only theirs
      q = query(
        collection(db, "workouts"),
        where("teamId", "==", team.id),
        where("athleteRosterId", "==", profile.athleteId),
        orderBy("createdAt", "desc"),
        limit(30)
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

    const prMap = {}; // highest weight per athlete + exercise

    return workouts.map(w => {

      const key = `${w.athleteRosterId}_${w.exercise}`;

      if (!prMap[key] || w.weight > prMap[key]) {
        prMap[key] = w.weight;
        return { ...w, isPR: true };
      }

      return { ...w, isPR: false };

    });

  }, [workouts]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📋 Workout Log</h2>

      {/* ===== COACH FILTER ===== */}
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

      {workoutsWithPR.length === 0 && (
        <div>No workouts yet.</div>
      )}

      {workoutsWithPR.map(w => {

        const date = w.createdAt?.seconds
          ? new Date(w.createdAt.seconds * 1000)
          : null;

        const isOpen = expanded === w.id;

        return (
          <div
            key={w.id}
            className="card metric-card"
            style={{ marginBottom: 10, cursor: "pointer" }}
            onClick={() => setExpanded(isOpen ? null : w.id)}
          >
            <strong>
              {w.exercise} — {w.weight} lbs — 
              {w.selectionValue === "Max"
                ? "Max Attempt"
                : `Box ${w.selectionValue}`} — 
              {w.result}
              {w.isPR && " 🏆"}
            </strong>

            {isCoach && (
              <div style={{ fontSize: 12 }}>
                {w.athleteDisplayName}
              </div>
            )}

            <div style={{ fontSize: 12 }}>
              {date?.toLocaleDateString()}
            </div>

            {isOpen && (
              <div style={{ marginTop: 10 }}>
                <div>Box: {w.selectionValue || "-"}</div>
                <div>Override Reason: {w.overrideReason || "-"}</div>
              </div>
            )}

          </div>
        );
      })}

    </div>
  );
}