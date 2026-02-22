import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  documentId,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";

export default function Workouts({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [exercise, setExercise] = useState("Bench");
  const [weight, setWeight] = useState(135);
  const [result, setResult] = useState("Pass");

  const [percentageMode, setPercentageMode] = useState(false);
  const [max, setMax] = useState(0);

  const [successFlash, setSuccessFlash] = useState(false);

  /* ================= LOAD TEAM ATHLETES ================= */

  useEffect(() => {

    if (!team?.members?.length) {
      setAthletes([]);
      return;
    }

    const q = query(
      collection(db, "users"),
      where(documentId(), "in", team.members.slice(0, 10))
    );

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "athlete");

      setAthletes(list);
    });

    return () => unsub();

  }, [team]);

  /* ================= LOAD MAX FOR PERCENTAGE MODE ================= */

  useEffect(() => {

    if (!percentageMode) return;

    const athleteId =
      profile?.role === "coach"
        ? selectedAthlete
        : profile?.uid;

    if (!athleteId) return;

    const loadMax = async () => {

      const q = query(
        collection(db, "seasonMaxes"),
        where("athleteId", "==", athleteId),
        where("exercise", "==", exercise)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        setMax(snap.docs[0].data().max || 0);
      } else {
        setMax(0);
      }
    };

    loadMax();

  }, [percentageMode, exercise, selectedAthlete, profile]);

  /* ================= SAVE WORKOUT ================= */

  const saveWorkout = async () => {

    if (!team?.id) {
      alert("Team not loaded.");
      return;
    }

    const athleteId =
      profile?.role === "coach"
        ? selectedAthlete
        : profile?.uid;

    if (!athleteId) {
      alert("Select athlete");
      return;
    }

    let athleteName = profile?.displayName;

    if (profile?.role === "coach") {
      const selected = athletes.find(a => a.id === selectedAthlete);
      if (!selected) {
        alert("Invalid athlete selection.");
        return;
      }
      athleteName = selected.displayName;
    }

    const finalWeight = percentageMode
      ? Math.round((Number(weight) / 100) * Number(max))
      : Number(weight);

    try {

      await addDoc(collection(db, "workouts"), {
        athleteId,
        athleteName,
        teamId: team.id,
        exercise,
        weight: finalWeight,
        percentageMode,
        percentageUsed: percentageMode ? Number(weight) : null,
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
      alert(err.message);
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

      <label style={{ marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={percentageMode}
          onChange={() => setPercentageMode(!percentageMode)}
        />
        {" "}Use Percentage
      </label>

      <select
        value={exercise}
        onChange={e => setExercise(e.target.value)}
      >
        <option>Bench</option>
        <option>Squat</option>
        <option>PowerClean</option>
      </select>

      {percentageMode ? (
        <select
          value={weight}
          onChange={e => setWeight(e.target.value)}
        >
          {Array.from({ length: 31 }, (_, i) => 50 + i * 5).map(p => (
            <option key={p} value={p}>
              {p}%
            </option>
          ))}
        </select>
      ) : (
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
      )}

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

      {successFlash && (
        <div style={{ marginTop: 12, color: "var(--success)" }}>
          ✅ Workout Saved
        </div>
      )}

    </div>
  );
}