import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function Goals({ profile }) {
  const [goals, setGoals] = useState([]);
  const [exercise, setExercise] = useState("Bench");
  const [target, setTarget] = useState("");

  useEffect(() => {
    if (!profile) return;

    let q;

    if (profile.role === "coach") {
      q = collection(db, "goals");
    } else {
      q = query(
        collection(db, "goals"),
        where("athleteId", "==", profile.uid)
      );
    }

    const unsub = onSnapshot(q, snap => {
      setGoals(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });

    return () => unsub();
  }, [profile]);

  const saveGoal = async () => {
    await addDoc(collection(db, "goals"), {
      athleteId: profile.uid,
      exercise,
      target: Number(target),
      createdAt: serverTimestamp()
    });

    setTarget("");
  };

  return (
    <div className="card">
      <h2>Goals</h2>

      <input
        value={target}
        onChange={e => setTarget(e.target.value)}
        placeholder="Target"
      />

      <button onClick={saveGoal}>Save Goal</button>

      <hr />

      {goals.map(g => (
        <div key={g.id}>
          {g.exercise} — Target {g.target}
        </div>
      ))}
    </div>
  );
}
