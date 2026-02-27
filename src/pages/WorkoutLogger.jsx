import { useEffect, useState } from "react";
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

  const isCoach = profile?.role === "coach";

  useEffect(() => {
    if (!team?.id) return;

    let q;

    if (isCoach) {
      q = query(
        collection(db, "workouts"),
        where("teamId", "==", team.id),
        orderBy("createdAt", "desc"),
        limit(30)
      );
    } else {
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

  }, [team?.id, profile, isCoach]);

  return (
    <div className="card">

      <h2>📋 Workout Log</h2>

      {workouts.length === 0 && <div>No workouts yet.</div>}

      {workouts.map(w => {

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
              {w.exercise === "Squat"
                ? `${w.selectionValue}%`
                : `Box ${w.selectionValue}`} — {w.result}
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
                <div>Selection: {w.selectionValue}</div>
                {w.overrideReason && (
                  <div>Override: {w.overrideReason}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}