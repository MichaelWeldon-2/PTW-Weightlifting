import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  documentId,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { defaultTemplate } from "../utils/boxTemplates";
import { calculateSets } from "../utils/calculateSets";

export default function Workouts({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");

  const [exercise, setExercise] = useState("Bench");
  const [selectionValue, setSelectionValue] = useState("1");

  const [selectedWeight, setSelectedWeight] = useState(135);
  const [result, setResult] = useState("Pass");

  const [max, setMax] = useState(0);
  const [successFlash, setSuccessFlash] = useState(false);
  const [teamTemplate, setTeamTemplate] = useState(defaultTemplate);

  /* ================= LOAD TEAM TEMPLATE ================= */

  useEffect(() => {
    if (!team?.id) return;

    const loadTemplate = async () => {
      const snap = await getDoc(doc(db, "teamTemplates", team.id));

      if (snap.exists()) {
        setTeamTemplate(snap.data().template);
      } else {
        setTeamTemplate(defaultTemplate);
      }
    };

    loadTemplate();
  }, [team?.id]);

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

  /* ================= CALCULATE SETS ================= */

  const getCalculatedSets = () => {

    const baseWeight = selectedWeight;

    if (exercise === "Squat") {
      if (selectionValue === "Max") {
        return calculateSets(teamTemplate["Max"], baseWeight);
      }
      return calculateSets(teamTemplate["Percentage"], baseWeight);
    }

    if (selectionValue === "Max") {
      return calculateSets(teamTemplate["Max"], baseWeight);
    }

    return calculateSets(teamTemplate[`Box${selectionValue}`], baseWeight);
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

  try {

    // 1️⃣ Save workout
    await addDoc(collection(db, "workouts"), {
      athleteId,
      athleteName,
      teamId: team.id,
      exercise,
      weight: Number(selectedWeight),
      selectionValue,
      result,
      createdAt: serverTimestamp()
    });

    // 2️⃣ If Max + Pass → Update max
    if (selectionValue === "Max" && result === "Pass") {

      await setDoc(
        doc(db, "seasonMaxes", `${athleteId}_${exercise}`),
        {
          athleteId,
          exercise,
          max: Number(selectedWeight),
          updatedAt: serverTimestamp()
        }
      );
    }

    // 3️⃣ Success flash
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 1000);

  } catch (err) {
    console.error("Workout save error:", err);
    alert("SAVE FAILED: " + err.message);
  }
};

  /* ================= DROPDOWN UI ================= */

  const renderDynamicDropdown = () => {

    if (exercise === "Squat") {
      return (
        <>
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

          <select
            value={selectedWeight}
            onChange={(e) => setSelectedWeight(Number(e.target.value))}
          >
            {Array.from({ length: 59 }, (_, i) => 135 + i * 5).map(w => (
              <option key={w} value={w}>
                {w} lbs
              </option>
            ))}
          </select>
        </>
      );
    }

    // Bench & PowerClean
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

        <select
          value={selectedWeight}
          onChange={(e) => setSelectedWeight(Number(e.target.value))}
        >
          {Array.from({ length: 59 }, (_, i) => 135 + i * 5).map(w => (
            <option key={w} value={w}>
              {w} lbs
            </option>
          ))}
        </select>
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