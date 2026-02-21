import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  doc,
  getDoc
} from "firebase/firestore";
import { db } from "../firebase";

export default function Workouts({ profile }) {

  const [athletes, setAthletes] = useState([]);
  const [workoutType, setWorkoutType] = useState("Workout");
  const [teamContext, setTeamContext] = useState(null);
  const [seasonMax, setSeasonMax] = useState(null);
  const [recommendedWeight, setRecommendedWeight] = useState(null);
  const [teamProgram, setTeamProgram] = useState(null);

  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [exercise, setExercise] = useState("Bench");
  const [weight, setWeight] = useState(135);
  const [box, setBox] = useState(1);
  const [percentage, setPercentage] = useState(25);
  const [result, setResult] = useState("Pass");

  const [benchMax, setBenchMax] = useState(135);
  const [squatMax, setSquatMax] = useState(135);
  const [cleanMax, setCleanMax] = useState(135);

  const [successFlash, setSuccessFlash] = useState(false);

  const boxes = [1,2,3,4,5,6,"Max"];
  const percentages = [25,30,35,40,45,50,55,60,65,70,75,80,85,90,"Max"];

  /* ================= LOAD TEAM CONTEXT ================= */

  useEffect(() => {
    if (!profile?.teamId) return;

    const loadTeam = async () => {
      const snap = await getDoc(doc(db, "teams", profile.teamId));
      if (snap.exists()) setTeamContext(snap.data());
    };

    loadTeam();
  }, [profile?.teamId]);

  /* ================= LOAD TEAM PROGRAM (PHASE 4H) ================= */

  useEffect(() => {
    if (!profile?.teamId) return;

    const loadProgram = async () => {
      const snap = await getDoc(doc(db, "teamPrograms", profile.teamId));
      if (snap.exists()) setTeamProgram(snap.data());
    };

    loadProgram();
  }, [profile?.teamId]);

  /* ================= LOAD ATHLETES ================= */

  useEffect(() => {
    if (!profile?.teamId) return;

    const q = query(
      collection(db, "users"),
      where("teamId", "==", profile.teamId),
      where("role", "==", "athlete")
    );

    const unsub = onSnapshot(q, snap => {
      setAthletes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [profile?.teamId]);

  const getAthlete = () => {
    if (profile.role === "coach") {
      return athletes.find(a => a.id === selectedAthlete);
    }
    return profile;
  };

  /* ================= LOAD SEASON MAX ================= */

  useEffect(() => {

    const athlete = getAthlete();
    if (!athlete || !profile?.teamId) return;

    const q = query(
      collection(db, "seasonMaxes"),
      where("athleteId", "==", athlete.id || athlete.uid),
      where("teamId", "==", profile.teamId)
    );

    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const latest = snap.docs
          .sort((a,b)=>b.data().createdAt?.seconds - a.data().createdAt?.seconds)[0]
          .data();

        setSeasonMax(latest);
      }
    });

    return () => unsub();

  }, [selectedAthlete, profile]);

  /* ================= PHASE 4H + 4C RECOMMEND ENGINE ================= */

  useEffect(() => {

    if (!seasonMax || !teamContext || !teamProgram || workoutType !== "Workout") {
      setRecommendedWeight(null);
      return;
    }

    const currentWeek = teamContext.currentWeek;

    let basePercent = 0;

    // 🔥 Get block % from AI program
    for (let block of teamProgram.blocks) {
      if (currentWeek >= block.startWeek && currentWeek <= block.endWeek) {
        const weeklyTarget = block.weeklyTargets[currentWeek];
        if (weeklyTarget) {
          if (exercise === "Bench") basePercent = weeklyTarget.bench / 100;
          if (exercise === "Squat") basePercent = weeklyTarget.squat / 100;
          if (exercise === "PowerClean") basePercent = weeklyTarget.powerClean / 100;
        }
      }
    }

    if (!basePercent) return;

    let maxLift = 0;
    if (exercise === "Bench") maxLift = seasonMax.bench || 0;
    if (exercise === "Squat") maxLift = seasonMax.squat || 0;
    if (exercise === "PowerClean") maxLift = seasonMax.powerClean || 0;

    if (!maxLift) return;

    let adjustment = 0;

    const failRate = seasonMax.failRate || 0;
    const riskStatus = seasonMax.riskStatus || "Stable";

    if (riskStatus === "Warning") adjustment -= 0.05;
    if (riskStatus === "Critical") adjustment -= 0.10;
    if (failRate >= 0.5) adjustment -= 0.05;
    if (seasonMax.trend === "Declining") adjustment -= 0.05;

  let finalPercent = basePercent + adjustment;

  // 🔥 Peak Optimizer Adjustments
  if (teamContext.trainingDayType === "Taper") {
    finalPercent -= 0.05;
  }

  if (teamContext.trainingDayType === "Competition") {
    finalPercent = Math.min(finalPercent + 0.05, 1.0);
    if (teamContext.trainingDayType === "Taper") {
      // reduce volume by recommending lighter loads
      setRecommendedWeight(
        Math.round((recommendedWeight * 0.9) / 5) * 5
      );
    }
  }

  const recommendedValue = Math.round(maxLift * finalPercent / 5) * 5;
  setRecommendedWeight(recommendedValue);

}, [seasonMax, teamContext, teamProgram, workoutType, exercise]);

/* ================= SAVE WORKOUT ================= */

  const saveWorkout = async () => {

    const athlete = getAthlete();

    if (!athlete) {
      alert("Select athlete");
      return;
    }

    if (!teamContext) {
      alert("Team context not loaded");
      return;
    }

    try {

      if (workoutType === "Workout") {

        const workoutData = {
          athleteId: athlete.id || athlete.uid,
          athleteName: athlete.displayName,
          teamId: profile.teamId,
          exercise,
          weight: Number(weight),
          box: exercise !== "Squat" ? box : null,
          percentage: exercise === "Squat" ? percentage : null,
          result,
          season: teamContext.currentSeason,
          block: teamContext.currentBlock,
          week: teamContext.currentWeek,
          trainingDayType: teamContext.trainingDayType,
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "workouts"), workoutData);

        if (result === "Pass") {
          await updateSeasonMax(workoutData);
        }
      }

      if (workoutType === "Max Day") {

        const maxData = {
          athleteId: athlete.id || athlete.uid,
          athleteName: athlete.displayName,
          teamId: profile.teamId,
          bench: Number(benchMax),
          squat: Number(squatMax),
          powerClean: Number(cleanMax),
          total: Number(benchMax) + Number(squatMax) + Number(cleanMax),
          season: teamContext.currentSeason,
          block: teamContext.currentBlock,
          week: teamContext.currentWeek,
          trainingDayType: "Max",
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "seasonMaxes"), maxData);
      }

      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 800);

      if (profile.role === "coach") setSelectedAthlete("");

    } catch (err) {
      console.error("Workout save error:", err);
    }
  };

  /* ================= UPDATE SEASON MAX ================= */

  const updateSeasonMax = async (workoutData) => {

    const seasonQuery = query(
      collection(db, "seasonMaxes"),
      where("athleteId", "==", workoutData.athleteId),
      where("teamId", "==", workoutData.teamId)
    );

    const snap = await getDocs(seasonQuery);
    if (snap.empty) return;

    const latestDoc = snap.docs[0];
    const existing = latestDoc.data();

    let bench = existing.bench || 0;
    let squat = existing.squat || 0;
    let powerClean = existing.powerClean || 0;

    if (workoutData.exercise === "Bench") bench = Math.max(bench, workoutData.weight);
    if (workoutData.exercise === "Squat") squat = Math.max(squat, workoutData.weight);
    if (workoutData.exercise === "PowerClean") powerClean = Math.max(powerClean, workoutData.weight);

    await setDoc(latestDoc.ref, {
      bench,
      squat,
      powerClean,
      total: bench + squat + powerClean,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  /* ================= UI ================= */

  return (
    <div className={`card ${successFlash ? "success-flash" : ""}`}>
      <h2>Log Workout</h2>

      {teamContext && (
        <div className="context-banner">
          {teamContext.currentSeason} — {teamContext.currentBlock} — Week {teamContext.currentWeek}
        </div>
      )}

      {profile.role === "coach" && (
        <select value={selectedAthlete} onChange={e => setSelectedAthlete(e.target.value)}>
          <option value="">Select Athlete</option>
          {athletes.map(a => (
            <option key={a.id} value={a.id}>{a.displayName}</option>
          ))}
        </select>
      )}

      <select value={workoutType} onChange={e => setWorkoutType(e.target.value)}>
        <option>Workout</option>
        <option>Max Day</option>
      </select>

      {workoutType === "Workout" && (
        <>
          <select value={exercise} onChange={e => setExercise(e.target.value)}>
            <option>Bench</option>
            <option>Squat</option>
            <option>PowerClean</option>
          </select>

          {recommendedWeight && (
            <div className="recommendation-box">
              💡 AI Recommended: {recommendedWeight} lbs
              <small style={{ display: "block", opacity: 0.7 }}>
                Block-based + adaptive adjustment
              </small>
            </div>
          )}

          <select value={weight} onChange={e => setWeight(e.target.value)}>
            {Array.from({ length: 58 }, (_, i) => 135 + i * 5).map(w => (
              <option key={w} value={w}>{w} lbs</option>
            ))}
          </select>

          <select value={result} onChange={e => setResult(e.target.value)}>
            <option>Pass</option>
            <option>Fail</option>
          </select>
        </>
      )}

      {workoutType === "Max Day" && (
        <>
          <WeightSelect value={benchMax} setValue={setBenchMax} label="Bench" />
          <WeightSelect value={squatMax} setValue={setSquatMax} label="Squat" />
          <WeightSelect value={cleanMax} setValue={setCleanMax} label="Power Clean" />
        </>
      )}

      <button onClick={saveWorkout}>Save</button>
    </div>
  );
}

function WeightSelect({ value, setValue, label }) {
  return (
    <>
      <h3>{label}</h3>
      <select value={value} onChange={e => setValue(e.target.value)}>
        {Array.from({ length: 58 }, (_, i) => 135 + i * 5).map(w => (
          <option key={w} value={w}>{w} lbs</option>
        ))}
      </select>
    </>
  );
}