import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
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

  /* ================= TOTAL ================= */

  const total =
    (liveMaxes.benchMax || 0) +
    (liveMaxes.squatMax || 0) +
    (liveMaxes.powerCleanMax || 0);

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

  /* ================= SAVE ================= */

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

    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 1000);
    setOverrideReason("");
  };

  /* ================= UI ================= */

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "Workout";

  return (
    <div className="workout-wrapper">

      {/* HERO SECTION */}
      <div className="hero-header">
        <div>
          <h2>{athleteName}</h2>
          <div style={{ opacity: 0.85 }}>
            Current Total: <strong>{total} lbs</strong>
          </div>
        </div>
      </div>

      {/* LAST WORKOUT CARD */}
      {lastWorkout && (
        <div className="card">
          <h3>Last Workout</h3>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {lastWorkout.exercise}
          </div>
          <div>{lastWorkout.weight} lbs</div>
          <div>Result: {lastWorkout.result}</div>
        </div>
      )}

      {/* PRESCRIPTION CARD */}
      <div className={`card workout-card ${successFlash ? "success-flash" : ""}`}>

        <h3>Today's Prescription</h3>

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

        {/* AUTO RENDERED SETS */}
        <div style={{ marginTop: 20 }}>
          {calculatedSets.map((set, i) => (
            <div key={i} style={{ padding: "6px 0" }}>
              <strong>Set {i+1}</strong>: {set.reps} reps × {set.weight} lbs
            </div>
          ))}
        </div>

        {/* RESULT SECTION */}
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