import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import { defaultTemplate } from "../utils/boxTemplates";
import { calculateSets } from "../utils/calculateSets";

export default function Workouts({ profile, team }) {

  const [roster, setRoster] = useState([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [liveMaxes, setLiveMaxes] = useState({});
  const [lastWorkout, setLastWorkout] = useState(null);

  const [exercise, setExercise] = useState("Bench");
  const [selectionValue, setSelectionValue] = useState("1");
  const [selectedWeight, setSelectedWeight] = useState(135);
  const [result, setResult] = useState("Pass");
  const [overrideReason, setOverrideReason] = useState("");

  const [teamTemplate, setTeamTemplate] = useState(defaultTemplate);
  const [successFlash, setSuccessFlash] = useState(false);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) return;

    const rosterRef = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(rosterRef, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setRoster(list);
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= AUTO SELECT SELF ================= */

  useEffect(() => {
    if (!profile || isCoach) return;

    const match = roster.find(r => r.linkedUid === profile.uid);
    if (match) setSelectedRosterId(match.id);
  }, [profile, roster, isCoach]);

  /* ================= LOAD NEXT SESSION FROM ROSTER ================= */

  useEffect(() => {
    if (!team?.id || !selectedRosterId) return;

    const loadNextSession = async () => {
      const snap = await getDoc(
        doc(db, "athletes", team.id, "roster", selectedRosterId)
      );

      if (!snap.exists()) return;

      const data = snap.data();

      if (data.nextExercise) setExercise(data.nextExercise);
      if (data.nextBox) setSelectionValue(data.nextBox);
      if (data.nextWeight) setSelectedWeight(data.nextWeight);
    };

    loadNextSession();
  }, [team?.id, selectedRosterId]);

  /* ================= LOAD TEMPLATE ================= */

  useEffect(() => {
    if (!team?.id) return;

    const loadTemplate = async () => {
      const snap = await getDoc(doc(db, "teamTemplates", team.id));
      const t = snap.data()?.template;
      setTeamTemplate(t && Object.keys(t).length ? t : defaultTemplate);
    };

    loadTemplate();
  }, [team?.id]);

  /* ================= LOAD LIVE MAXES ================= */

  useEffect(() => {
    if (!selectedRosterId) return;

    const loadMaxes = async () => {
      const snap = await getDoc(
        doc(db, "seasonMaxesCurrent", selectedRosterId)
      );
      setLiveMaxes(snap.exists() ? snap.data() : {});
    };

    loadMaxes();
  }, [selectedRosterId]);

  /* ================= LOAD LAST WORKOUT ================= */

  useEffect(() => {
    if (!selectedRosterId) return;

    const q = query(
      collection(db, "workouts"),
      where("athleteRosterId", "==", selectedRosterId),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setLastWorkout(snap.docs[0].data());
      }
    });

    return () => unsub();
  }, [selectedRosterId]);

  /* ================= CURRENT MAX ================= */

  const currentMax = {
    Bench: liveMaxes?.benchMax || 0,
    Squat: liveMaxes?.squatMax || 0,
    PowerClean: liveMaxes?.powerCleanMax || 0
  }[exercise] || 0;

  /* ================= CALCULATE SETS ================= */

  const calculatedSets = useMemo(() => {

    const baseWeight =
      exercise === "Squat" && selectionValue !== "Max"
        ? Math.round((Number(selectionValue) / 100) * currentMax)
        : selectedWeight;

    let template;

    if (selectionValue === "Max") template = teamTemplate?.Max;
    else if (exercise === "Squat") template = teamTemplate?.Percentage;
    else template = teamTemplate?.[`Box${selectionValue}`];

    if (!Array.isArray(template)) return [];

    return calculateSets(template, baseWeight);

  }, [exercise, selectionValue, selectedWeight, currentMax, teamTemplate]);

  /* ================= SAVE WORKOUT ================= */

  const saveWorkout = async () => {

    if (!selectedRosterId) return alert("Select athlete.");

    await addDoc(collection(db, "workouts"), {
      teamId: team.id,
      athleteRosterId: selectedRosterId,
      athleteDisplayName: roster.find(r => r.id === selectedRosterId)?.displayName,
      exercise,
      weight: Number(selectedWeight),
      selectionValue,
      result,
      overrideReason: result === "Override" ? overrideReason : null,
      createdAt: serverTimestamp()
    });

    /* ================= CALCULATE NEXT SESSION ================= */

    let nextBox = selectionValue;
    let nextIsMax = false;

    if (result === "Pass") {

      if (selectionValue === "Max") {
        nextBox = "1";
      } else if (Number(selectionValue) >= 6) {
        nextBox = "Max";
        nextIsMax = true;
      } else {
        nextBox = String(Number(selectionValue) + 1);
      }

    }

    await setDoc(
      doc(db, "athletes", team.id, "roster", selectedRosterId),
      {
        nextExercise: exercise,
        nextBox,
        nextWeight: Number(selectedWeight),
        nextIsMax
      },
      { merge: true }
    );

    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 1000);
    setOverrideReason("");
  };

  /* ================= UI ================= */

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "Workout";

  return (
    <div className="workout-wrapper">

      <div className="hero-header">
        <div>
          <h2>{athleteName}</h2>
        </div>
      </div>

      {lastWorkout && (
        <div className="card">
          <h3>Last Workout</h3>
          <div>{lastWorkout.exercise}</div>
          <div>{lastWorkout.weight} lbs</div>
          <div>Result: {lastWorkout.result}</div>
        </div>
      )}

      <div className={`card workout-card ${successFlash ? "success-flash" : ""}`}>

        <h3>Current Workout</h3>

        {isCoach && (
          <select
            value={selectedRosterId}
            onChange={e => setSelectedRosterId(e.target.value)}
          >
            <option value="">Select Athlete</option>
            {roster.map(r => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </select>
        )}

        <select value={exercise} onChange={e => setExercise(e.target.value)}>
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

        {/* WEIGHT DROPDOWN RESTORED */}
        <input
          type="number"
          value={selectedWeight}
          onChange={e => setSelectedWeight(e.target.value)}
        />

        <div style={{ marginTop: 20 }}>
          {calculatedSets.map((set, i) => (
            <div key={i}>
              <strong>Set {i+1}</strong>: {set.reps} reps × {set.weight} lbs
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <select value={result} onChange={e => setResult(e.target.value)}>
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
        </div>

        <button style={{ marginTop: 15 }} onClick={saveWorkout}>
          Save Workout
        </button>

      </div>
    </div>
  );
}