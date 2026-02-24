import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  documentId,
  getDoc,
  doc
} from "firebase/firestore";
import { db } from "../firebase";
import { defaultTemplate } from "../utils/boxTemplates";
import { calculateSets } from "../utils/calculateSets";

export default function Workouts({ profile, team }) {

  /* ================= STATE ================= */

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [maxLoaded, setMaxLoaded] = useState(false);

  const [exercise, setExercise] = useState("Bench");
  const [selectionValue, setSelectionValue] = useState("1");
  const [selectedWeight, setSelectedWeight] = useState(135);
  const [result, setResult] = useState("Pass");
  const [overrideReason, setOverrideReason] = useState("");

  const [maxes, setMaxes] = useState({});
  const [successFlash, setSuccessFlash] = useState(false);
  const [teamTemplate, setTeamTemplate] = useState(defaultTemplate);

  const isCoach = profile?.role === "coach";

  /* ================= DEBUG ================= */

  useEffect(() => {
    console.log("TEMPLATE:", teamTemplate);
    console.log("MAXES:", maxes);
  }, [teamTemplate, maxes]);

  /* ================= SAFE TEMPLATE LOAD ================= */

  useEffect(() => {
    if (!team?.id) return;

    const loadTemplate = async () => {
      try {
        const snap = await getDoc(doc(db, "teamTemplates", team.id));
        const firestoreTemplate = snap.data()?.template;

        if (
          firestoreTemplate &&
          typeof firestoreTemplate === "object" &&
          Object.keys(firestoreTemplate).length > 0
        ) {
          setTeamTemplate(firestoreTemplate);
        } else {
          setTeamTemplate(defaultTemplate);
        }
      } catch (err) {
        console.error("Template load error:", err);
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
  }, [team?.members]);

  /* ================= LOAD MAXES ================= */

  useEffect(() => {
    const athleteId = isCoach ? selectedAthlete : profile?.uid;
    if (!athleteId) return;

    setMaxLoaded(false);

    const loadMaxes = async () => {
      try {
        const snap = await getDoc(doc(db, "seasonMaxes", athleteId));
        if (snap.exists()) {
          setMaxes(snap.data());
        } else {
          setMaxes({});
        }
      } catch (err) {
        console.error("Max load error:", err);
        setMaxes({});
      }

      setMaxLoaded(true);
    };

    loadMaxes();
  }, [selectedAthlete, profile?.uid, isCoach]);

  /* ================= CURRENT MAX ================= */

  const currentMax = useMemo(() => {
    return {
      Bench: maxes?.benchMax || 0,
      Squat: maxes?.squatMax || 0,
      PowerClean: maxes?.powerCleanMax || 0
    }[exercise] || 0;
  }, [maxes, exercise]);

  /* ================= CALCULATE SETS ================= */

  const calculatedSets = useMemo(() => {

    if (!maxLoaded) return [];
    if (!teamTemplate || typeof teamTemplate !== "object") return [];

    const baseWeight =
      exercise === "Squat" && selectionValue !== "Max"
        ? Math.round((Number(selectionValue) / 100) * currentMax)
        : selectedWeight;

    let template;

    if (selectionValue === "Max") {
      template = teamTemplate?.Max;
    } else if (exercise === "Squat") {
      template = teamTemplate?.Percentage;
    } else {
      template = teamTemplate?.[`Box${selectionValue}`];
    }

    if (!template || !Array.isArray(template)) return [];

    const sets = calculateSets(template, baseWeight);

    return Array.isArray(sets) ? sets : [];

  }, [
    exercise,
    selectionValue,
    selectedWeight,
    currentMax,
    teamTemplate,
    maxLoaded
  ]);

  /* ================= DROPDOWN UI ================= */

  const weightOptions = Array.from({ length: 59 }, (_, i) => 135 + i * 5);

  const renderDynamicDropdown = () => {

    if (exercise === "Squat") {
      return (
        <>
          <select
            value={selectionValue}
            onChange={e => setSelectionValue(e.target.value)}
          >
            {Array.from({ length: 14 }, (_, i) => 25 + i * 5).map(p => (
              <option key={p} value={p}>{p}%</option>
            ))}
            <option value="Max">Max</option>
          </select>

          <select
            value={selectedWeight}
            onChange={e => setSelectedWeight(Number(e.target.value))}
          >
            {weightOptions.map(w => (
              <option key={w} value={w}>{w} lbs</option>
            ))}
          </select>
        </>
      );
    }

    return (
      <>
        <select
          value={selectionValue}
          onChange={e => setSelectionValue(e.target.value)}
        >
          {[1,2,3,4,5,6].map(b => (
            <option key={b} value={b}>Box {b}</option>
          ))}
          <option value="Max">Max</option>
        </select>

        <select
          value={selectedWeight}
          onChange={e => setSelectedWeight(Number(e.target.value))}
        >
          {weightOptions.map(w => (
            <option key={w} value={w}>{w} lbs</option>
          ))}
        </select>
      </>
    );
  };

  /* ================= SAVE WORKOUT ================= */

  const saveWorkout = async () => {

    if (!team?.id) {
      alert("Team not loaded.");
      return;
    }

    const athleteId = isCoach ? selectedAthlete : profile?.uid;
    if (!athleteId) {
      alert("Select athlete");
      return;
    }

    let athleteName = profile?.displayName;

    if (isCoach) {
      const selected = athletes.find(a => a.id === selectedAthlete);
      if (!selected) {
        alert("Invalid athlete selection.");
        return;
      }
      athleteName = selected.displayName;
    }

    try {

      await addDoc(collection(db, "workouts"), {
        athleteId,
        athleteName,
        teamId: team.id,
        exercise,
        weight: Number(selectedWeight),
        selectionValue,
        result,
        overrideReason: result === "Override" ? overrideReason : null,
        createdAt: serverTimestamp()
      });

      if (selectionValue === "Max" && result === "Pass") {

        const fieldMap = {
          Bench: "benchMax",
          Squat: "squatMax",
          PowerClean: "powerCleanMax"
        };

        await setDoc(
          doc(db, "seasonMaxes", athleteId),
          {
            athleteId,
            athleteName,
            [fieldMap[exercise]]: Number(selectedWeight),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }

      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 1000);
      setOverrideReason("");

    } catch (err) {
      console.error("Workout save error:", err);
      alert("SAVE FAILED: " + err.message);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="workout-wrapper">
      <div className={`card workout-card ${successFlash ? "success-flash" : ""}`}>

        <h2>Log Workout</h2>

        {isCoach && (
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

        <div style={{ marginTop: 15 }}>
          {calculatedSets.map((set, index) => (
            <div key={index}>
              Set {index + 1}: {set.reps} reps x {set.weight} lbs
            </div>
          ))}
        </div>

        <select
          value={result}
          onChange={e => setResult(e.target.value)}
        >
          <option>Pass</option>
          <option>Fail</option>
          <option>Override</option>
        </select>

        {result === "Override" && (
          <input
            value={overrideReason}
            onChange={e => setOverrideReason(e.target.value)}
            placeholder="Reason (injury, fatigue, etc.)"
          />
        )}

        <button onClick={saveWorkout}>
          Save Workout
        </button>

      </div>
    </div>
  );
}