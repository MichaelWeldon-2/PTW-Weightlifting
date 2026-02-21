import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  documentId
} from "firebase/firestore";
import { db } from "../firebase";

export default function Workouts({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [exercise, setExercise] = useState("Bench");
  const [weight, setWeight] = useState(135);
  const [result, setResult] = useState("Pass");
  const [successFlash, setSuccessFlash] = useState(false);

  /* ================= LOAD TEAM ATHLETES ================= */

  useEffect(() => {

    if (!team?.members?.length) {
      setAthletes([]);
      return;
    }

    const memberIds = team.members;

    const chunks = [];
    for (let i = 0; i < memberIds.length; i += 10) {
      chunks.push(memberIds.slice(i, i + 10));
    }

    const results = [];

    chunks.forEach(chunk => {

      const q = query(
        collection(db, "users"),
        where(documentId(), "in", chunk)
      );

      onSnapshot(q, snap => {
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.role === "athlete") {
            results.push({ id: d.id, ...data });
          }
        });

        setAthletes([...results]);
      });
    });

  }, [team]);

  /* ================= SAVE WORKOUT ================= */

  const saveWorkout = async () => {

    const athleteId =
      profile?.role === "coach"
        ? selectedAthlete
        : profile.uid;

    if (!athleteId) {
      alert("Select athlete");
      return;
    }

    try {

      await addDoc(collection(db, "workouts"), {
        athleteId,
        teamId: team.id,
        exercise,
        weight: Number(weight),
        result,
        createdAt: serverTimestamp()
      });

      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 800);

      if (profile?.role === "coach") {
        setSelectedAthlete("");
      }

    } catch (err) {
      console.error("Workout save error:", err);
    }
  };

  /* ================= UI ================= */

  return (
    <div className={`card ${successFlash ? "success-flash" : ""}`}>

      <h2>Log Workout</h2>

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

      <select
        value={exercise}
        onChange={e => setExercise(e.target.value)}
      >
        <option>Bench</option>
        <option>Squat</option>
        <option>PowerClean</option>
      </select>

      <select
        value={weight}
        onChange={e => setWeight(e.target.value)}
      >
        {Array.from({ length: 60 }, (_, i) => 95 + i * 5).map(w => (
          <option key={w} value={w}>
            {w} lbs
          </option>
        ))}
      </select>

      <select
        value={result}
        onChange={e => setResult(e.target.value)}
      >
        <option>Pass</option>
        <option>Fail</option>
      </select>

      <button onClick={saveWorkout}>
        Save Workout
      </button>

    </div>
  );
}