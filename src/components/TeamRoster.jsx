import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { getCurrentSeason } from "../utils/getCurrentSeason";

export default function TeamRoster({ teamId }) {
  const [members, setMembers] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [seasonMaxes, setSeasonMaxes] = useState([]);

  const { season: currentSeason, year: currentYear } = getCurrentSeason();

  /* ================= LOAD TEAM MEMBERS ================= */

  useEffect(() => {
    if (!teamId) return;

    const q = query(
      collection(db, "teamMembers"),
      where("teamId", "==", teamId)
    );

    const unsub = onSnapshot(q, snap => {
      setMembers(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    });

    return () => unsub();
  }, [teamId]);

  /* ================= LOAD WORKOUTS ================= */

  useEffect(() => {
    if (!teamId) return;

    const q = query(
      collection(db, "workouts"),
      where("teamId", "==", teamId)
    );

    const unsub = onSnapshot(q, snap => {
      setWorkouts(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    });

    return () => unsub();
  }, [teamId]);

  /* ================= LOAD SEASON MAXES ================= */

  useEffect(() => {
    if (!teamId) return;

    const q = query(
      collection(db, "seasonMaxes"),
      where("teamId", "==", teamId)
    );

    const unsub = onSnapshot(q, snap => {
      setSeasonMaxes(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    });

    return () => unsub();
  }, [teamId]);

  /* ================= ANALYTICS ================= */

  const rosterStats = useMemo(() => {
    return members.map(member => {

      const athleteWorkouts = workouts.filter(
        w => w.athleteId === member.userId
      );

      const workoutCount = athleteWorkouts.length;

      const lastWorkout =
        athleteWorkouts.length > 0
          ? athleteWorkouts
              .sort((a, b) =>
                (b.createdAt?.seconds || 0) -
                (a.createdAt?.seconds || 0)
              )[0]
          : null;

      const seasonRecord = seasonMaxes.find(
        s =>
          s.athleteId === member.userId &&
          s.year === currentYear &&
          s.season === currentSeason
      );

      /* ===== STUCK LOGIC ===== */

      const failMap = {};

      athleteWorkouts.forEach(w => {
        if (w.result === "Fail") {
          const key = w.exercise;
          failMap[key] = (failMap[key] || 0) + 1;
        }
      });

      const stuckExercises = Object.entries(failMap)
        .filter(([_, count]) => count >= 3)
        .map(([exercise]) => exercise);

      return {
        ...member,
        workoutCount,
        lastWorkoutDate:
          lastWorkout?.createdAt?.toDate?.().toLocaleDateString() || null,
        seasonTotal: seasonRecord?.total || 0,
        stuckExercises
      };
    });
  }, [members, workouts, seasonMaxes]);

  /* ================= UI ================= */

  return (
    <div style={{ marginTop: 30 }}>
      <h3>Team Roster</h3>

      {rosterStats.length === 0 && (
        <p>No athletes yet.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginTop: 20
        }}
      >
        {rosterStats.map(member => (
          <div
            key={member.id}
            style={{
              padding: 20,
              borderRadius: 12,
              background: "#ffffff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
            }}
          >
            <h4 style={{ marginBottom: 5 }}>
              {member.displayName}
            </h4>

            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {member.role}
            </div>

            <hr />

            <div>Total Workouts: {member.workoutCount}</div>

            <div>
              Season Total: {member.seasonTotal} lbs
            </div>

            <div>
              Last Activity:{" "}
              {member.lastWorkoutDate || "N/A"}
            </div>

            {member.stuckExercises.length > 0 && (
              <div style={{
                marginTop: 10,
                color: "#f2001d",
                fontWeight: "bold"
              }}>
                ⚠️ Stuck: {member.stuckExercises.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
