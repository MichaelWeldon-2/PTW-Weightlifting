import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
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
import HeroHeader from "./HeroHeader";
import { setDoc } from "firebase/firestore";
export default function Workouts({ profile, team }) {

  const [roster, setRoster] = useState([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [liveMaxes, setLiveMaxes] = useState({});
  const [workouts, setWorkouts] = useState([]);

  const [exercise, setExercise] = useState("Bench");
  const [selectionValue, setSelectionValue] = useState("1");
  const [selectedWeight, setSelectedWeight] = useState(135);
  const [result, setResult] = useState("Pass");
  const [overrideReason, setOverrideReason] = useState("");

  const [teamTemplate] = useState(defaultTemplate);
  const [successFlash, setSuccessFlash] = useState(false);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */
  useEffect(() => {
    if (!team?.id) return;

    const unsub = onSnapshot(
      collection(db, "athletes", team.id, "roster"),
      snap => {
        setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => unsub();
  }, [team?.id]);

  /* ================= AUTO SELECT SELF ================= */
  useEffect(() => {
    if (!profile || isCoach) return;
    const match = roster.find(r => r.linkedUid === profile.uid);
    if (match) setSelectedRosterId(match.id);
  }, [profile, roster, isCoach]);

  /* ================= LOAD LAST 30 WORKOUTS ================= */
  useEffect(() => {
    if (!selectedRosterId) return;

    const q = query(
      collection(db, "workouts"),
      where("athleteRosterId", "==", selectedRosterId),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(q, snap => {
      setWorkouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [selectedRosterId]);

  /* ================= LAST WORKOUT PER EXERCISE ================= */
  const lastWorkoutByExercise = useMemo(() => {
    const map = {};
    workouts.forEach(w => {
      if (!map[w.exercise]) {
        map[w.exercise] = w;
      }
    });
    return map;
  }, [workouts]);

  /* ================= LOAD LIVE MAXES ================= */
  useEffect(() => {
    if (!selectedRosterId) return;

    const load = async () => {
      const snap = await getDoc(
        doc(db, "seasonMaxesCurrent", selectedRosterId)
      );
      setLiveMaxes(snap.exists() ? snap.data() : {});
    };

    load();
  }, [selectedRosterId]);

  /* ================= CALCULATED SETS ================= */
  const calculatedSets = useMemo(() => {

    const currentMax = {
      Bench: liveMaxes?.benchMax || 0,
      Squat: liveMaxes?.squatMax || 0,
      PowerClean: liveMaxes?.powerCleanMax || 0
    }[exercise] || 0;

    let baseWeight;

    if (exercise === "Squat" && selectionValue !== "Max") {
      const percent = Number(selectionValue) / 100;
      const rawWeight = percent * currentMax;
      baseWeight = Math.round(rawWeight / 5) * 5;
    } else {
      baseWeight = Number(selectedWeight);
    }

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

  }, [exercise, selectionValue, selectedWeight, liveMaxes, teamTemplate]);

  /* ================= SAVE WORKOUT ================= */
/* ================= SAVE WORKOUT ================= */
const saveWorkout = async () => {

  if (!selectedRosterId) return alert("Select athlete.");

  let finalWeight = Number(selectedWeight);

  if (exercise === "Squat" && selectionValue !== "Max") {
    const percent = Number(selectionValue) / 100;
    const rawWeight = percent * (liveMaxes?.squatMax || 0);
    finalWeight = Math.round(rawWeight / 5) * 5;
  }

  // Save workout first
  await addDoc(collection(db, "workouts"), {
    teamId: team.id,
    athleteRosterId: selectedRosterId,
    athleteDisplayName:
      roster.find(r => r.id === selectedRosterId)?.displayName,
    exercise,
    weight: finalWeight,
    selectionValue,
    result,
    overrideReason:
      result === "Override" ? overrideReason : null,
    createdAt: serverTimestamp()
  });

  /* ================= AUTO UPDATE CURRENT MAX ================= */
  if (selectionValue === "Max" && result === "Pass") {

    const maxRef = doc(db, "seasonMaxesCurrent", selectedRosterId);
    const snap = await getDoc(maxRef);
    const currentData = snap.exists() ? snap.data() : {};

    const fieldMap = {
      Bench: "benchMax",
      Squat: "squatMax",
      PowerClean: "powerCleanMax"
    };

    const field = fieldMap[exercise];

    if (field) {
      const currentMax = currentData[field] || 0;

      // Only update if new max is greater
      if (finalWeight > currentMax) {
        await setDoc(
          maxRef,
          { [field]: finalWeight },
          { merge: true }
        );
      }
    }
  }

  setSuccessFlash(true);
  setTimeout(() => setSuccessFlash(false), 1000);
  setOverrideReason("");
};

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "Workout";

  const formatExerciseName = (name) => {
    if (name === "PowerClean") return "Power Clean";
    return name;
  };

  const formatSelection = (lift) => {
    if (!lift) return "";

    if (lift.exercise === "Squat") {
      if (lift.selectionValue === "Max") return "Max";
      return `${lift.selectionValue}%`;
    }

    if (lift.selectionValue === "Max") return "Max";
    return `Box ${lift.selectionValue}`;
  };

  return (
    <div className="workout-wrapper">

      <HeroHeader
        title="Workouts"
        image={team?.pageImages?.workouts}
      />

      <div className="hero-header">
        <h2>{athleteName}</h2>
      </div>

      {/* ================= LAST RECORDED LIFTS ================= */}
      {selectedRosterId && (
        <div className="card workout-card" style={{ marginBottom: 20 }}>
          <h3>Last Recorded Lifts</h3>

          {["Bench", "Squat", "PowerClean"].map(liftName => {
            const lift = lastWorkoutByExercise[liftName];

            return (
              <div key={liftName} style={{ marginBottom: 12 }}>
                <strong>{formatExerciseName(liftName)}</strong>

                {lift ? (
                  <div>
                    {lift.weight} lbs — {formatSelection(lift)} —{" "}
                    <span
                      style={{
                        color:
                          lift.result === "Pass"
                            ? "#2ecc71"
                            : lift.result === "Fail"
                            ? "#e74c3c"
                            : "#f39c12"
                      }}
                    >
                      {lift.result}
                    </span>
                  </div>
                ) : (
                  <div>No record yet</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= CURRENT WORKOUT ================= */}
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

        {exercise === "Squat" ? (
          <select
            value={selectionValue}
            onChange={e => setSelectionValue(e.target.value)}
          >
            {[25,30,35,40,45,50,55,60,65,70,75,80,85,90].map(p => (
              <option key={p} value={p}>{p}%</option>
            ))}
            <option value="Max">Max</option>
          </select>
        ) : (
          <select
            value={selectionValue}
            onChange={e => setSelectionValue(e.target.value)}
          >
            {[1,2,3,4,5,6].map(b => (
              <option key={b} value={b}>Box {b}</option>
            ))}
            <option value="Max">Max</option>
          </select>
        )}

        {exercise !== "Squat" && (
          <select
            value={selectedWeight}
            onChange={e => setSelectedWeight(Number(e.target.value))}
          >
            {Array.from({ length: 60 }, (_, i) => 135 + i * 5).map(w => (
              <option key={w} value={w}>{w} lbs</option>
            ))}
          </select>
        )}

        <div style={{ marginTop: 20 }}>
          {calculatedSets.map((set, i) => (
            <div key={i}>
              <strong>Set {i + 1}</strong>: {set.reps} reps × {set.weight} lbs
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