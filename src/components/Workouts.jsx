import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import { defaultTemplate } from "../utils/boxTemplates";
import { calculateSets } from "../utils/calculateSets";

export default function Workouts({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [maxLoaded, setMaxLoaded] = useState(false);
  const [lastWorkout, setLastWorkout] = useState(null);

  const [exercise, setExercise] = useState("Bench");
  const [selectionValue, setSelectionValue] = useState("1");
  const [selectedWeight, setSelectedWeight] = useState(135);
  const [result, setResult] = useState("Pass");
  const [overrideReason, setOverrideReason] = useState("");

  const [maxes, setMaxes] = useState({});
  const [successFlash, setSuccessFlash] = useState(false);
  const [teamTemplate, setTeamTemplate] = useState(defaultTemplate);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD TEMPLATE ================= */

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
      } catch {
        setTeamTemplate(defaultTemplate);
      }
    };

    loadTemplate();
  }, [team?.id]);

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) return;

    const rosterRef = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(rosterRef, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setAthletes(list);
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= DETERMINE ROSTER ID ================= */

  const athleteRosterId = useMemo(() => {
    if (isCoach) return selectedAthlete;

    const match = athletes.find(
      a => a.linkedUid === profile?.uid
    );

    return match?.id || null;
  }, [isCoach, selectedAthlete, athletes, profile?.uid]);

  const athleteDisplayName = useMemo(() => {
    if (isCoach) {
      return athletes.find(a => a.id === selectedAthlete)?.displayName || "";
    }
    return profile?.displayName || "";
  }, [isCoach, selectedAthlete, athletes, profile?.displayName]);

  /* ================= LOAD LIVE MAXES ================= */

  useEffect(() => {
    if (!athleteRosterId) return;

    setMaxLoaded(false);

    const loadMaxes = async () => {
      try {
        const snap = await getDoc(
          doc(db, "seasonMaxesCurrent", athleteRosterId)
        );

        setMaxes(snap.exists() ? snap.data() : {});
      } catch {
        setMaxes({});
      }

      setMaxLoaded(true);
    };

    loadMaxes();
  }, [athleteRosterId]);

  /* ================= LOAD LAST WORKOUT ================= */

  useEffect(() => {
    if (!athleteRosterId || !team?.id) return;

    const loadLastWorkout = async () => {
      const q = query(
        collection(db, "workouts"),
        where("teamId", "==", team.id),
        where("athleteRosterId", "==", athleteRosterId),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        setLastWorkout(snap.docs[0].data());
      } else {
        setLastWorkout(null);
      }
    };

    loadLastWorkout();
  }, [athleteRosterId, team?.id]);

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

    if (!Array.isArray(template)) return [];

    return calculateSets(template, baseWeight);

  }, [
    exercise,
    selectionValue,
    selectedWeight,
    currentMax,
    teamTemplate,
    maxLoaded
  ]);

  /* ================= SAVE WORKOUT ================= */

  const saveWorkout = async () => {

    if (!team?.id) return alert("Team not loaded.");
    if (!athleteRosterId) return alert("Select athlete.");

    try {

      await addDoc(collection(db, "workouts"), {
        teamId: team.id,
        athleteRosterId,
        athleteDisplayName,
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

        const fieldName = fieldMap[exercise];

        const maxRef = doc(
          db,
          "seasonMaxesCurrent",
          athleteRosterId
        );

        const snap = await getDoc(maxRef);

        const existing = snap.exists() ? snap.data() : {
          benchMax: 0,
          squatMax: 0,
          powerCleanMax: 0
        };

        const updated = {
          ...existing,
          [fieldName]: Number(selectedWeight)
        };

        const total =
          (updated.benchMax || 0) +
          (updated.squatMax || 0) +
          (updated.powerCleanMax || 0);

        await setDoc(maxRef, {
          athleteRosterId,
          athleteDisplayName,
          ...updated,
          total,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 1000);
      setOverrideReason("");

    } catch (err) {
      alert("SAVE FAILED: " + err.message);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="workout-wrapper">
      <div className={`card workout-card ${successFlash ? "success-flash" : ""}`}>

        {/* 🔥 LAST WORKOUT CARD */}
        {lastWorkout && (
          <div
            className="card"
            style={{
              marginBottom: 20,
              borderLeft: `6px solid ${
                lastWorkout.result === "Pass" ? "green" : "red"
              }`
            }}
          >
            <h3>Last Session</h3>
            <p><strong>Exercise:</strong> {lastWorkout.exercise}</p>
            <p><strong>Weight:</strong> {lastWorkout.weight} lbs</p>
            <p><strong>Result:</strong> {lastWorkout.result}</p>
          </div>
        )}

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
          {Array.from({ length: 59 }, (_, i) => 135 + i * 5).map(w => (
            <option key={w} value={w}>{w} lbs</option>
          ))}
        </select>

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
            placeholder="Reason"
          />
        )}

        <button onClick={saveWorkout}>
          Save Workout
        </button>

      </div>
    </div>
  );
}