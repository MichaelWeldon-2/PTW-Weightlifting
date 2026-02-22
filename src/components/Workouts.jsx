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
  const [selectionValue, setSelectionValue] = useState("1"); // Box or %
  const [weight, setWeight] = useState(135);
  const [result, setResult] = useState("Pass");

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

  /* ================= LOAD MAX ================= */

  useEffect(() => {

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

  }, [exercise, selectedAthlete, profile]);

  /* ================= SET LOGIC ================= */

  const getSets = () => {

    if (selectionValue === "Max") return 1;

    if (exercise === "Squat") return 5;

    // Bench & PowerClean
    if (selectionValue === "1") return 5;

    return 6; // Boxes 2–6
  };

  /* ================= CALCULATE FINAL WEIGHT ================= */

  const calculateWeight = () => {

    if (selectionValue === "Max") {
      return exercise === "Squat" ? max : weight;
    }

    if (exercise === "Squat") {
      return Math.round((Number(selectionValue) / 100) * max);
    }

    // Bench & PowerClean use chosen weight
    return Number(weight);
  };

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

    const finalWeight = calculateWeight();
    const sets = getSets();

    try {

      await addDoc(collection(db, "workouts"), {
        athleteId,
        athleteName,
        teamId: team.id,
        exercise,
        weight: finalWeight,
        sets,
        selectionValue,
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

  /* ================= DROPDOWN OPTIONS ================= */

  const renderDynamicDropdown = () => {

    if (exercise === "Squat") {
      return (
        <select
          value={selectionValue}
          onChange={e => setSelectionValue(e.target.value)}
        >
          {Array.from({ length: 14 }, (_, i) => 25 + i * 5).map(p => (
            <option key={p} value={p}>
              {p}%
            </option>
          ))}
          <option value="Max">Max</option>
        </select>
      );
    }

    // Bench & PowerClean → Box System
    return (
      <>
        <select
          value={selectionValue}
          onChange={e => setSelectionValue(e.target.value)}
        >
          <option value="1">Box 1</option>
          <option value="2">Box 2</option>
          <option value="3">Box 3</option>
          <option value="4">Box 4</option>
          <option value="5">Box 5</option>
          <option value="6">Box 6</option>
          <option value="Max">Max</option>
        </select>

        {selectionValue !== "Max" && (
          <select
            value={weight}
            onChange={e => setWeight(e.target.value)}
          >
            {Array.from({ length: 59 }, (_, i) => 135 + i * 5).map(w => (
              <option key={w} value={w}>
                {w} lbs
              </option>
            ))}
          </select>
        )}
      </>
    );
  };

  /* ================= UI ================= */

  return (
    <div className="workout-wrapper">
      <div className={`card workout-card ${successFlash ? "success-flash" : ""}`}>

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
          onChange={e => {
            setExercise(e.target.value);
            setSelectionValue(e.target.value === "Squat" ? "25" : "1");
          }}
        >
          <option>Bench</option>
          <option>Squat</option>
          <option>PowerClean</option>
        </select>

        {renderDynamicDropdown()}

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
    </div>
  );
}