import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function PreSeasonMaxEntry({ team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [bench, setBench] = useState("");
  const [squat, setSquat] = useState("");
  const [clean, setClean] = useState("");

  const [season, setSeason] = useState("Fall");
  const [year, setYear] = useState(new Date().getFullYear());

  /* ================= LOAD ATHLETES ================= */

  useEffect(() => {
    if (!team?.members?.length) return;

    const q = query(
      collection(db, "users"),
      where("teamId", "==", team.id),
      where("role", "==", "athlete")
    );

    const unsub = onSnapshot(q, snap => {
      setAthletes(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();

  }, [team?.id]);

  /* ================= SAVE SNAPSHOT ================= */

  const saveSnapshot = async () => {

    if (!selectedAthlete) {
      alert("Select athlete");
      return;
    }

    const athlete = athletes.find(a => a.id === selectedAthlete);

    const total =
      Number(bench || 0) +
      Number(squat || 0) +
      Number(clean || 0);

    const docId = `${selectedAthlete}_${season}_${year}`;

    await setDoc(
      doc(db, "seasonMaxes", team.id, "athletes", docId),
      {
        athleteId: selectedAthlete,
        athleteName: athlete.displayName,
        season,
        year,
        benchMax: Number(bench),
        squatMax: Number(squat),
        powerCleanMax: Number(clean),
        total,
        createdAt: serverTimestamp()
      }
    );

    alert("Season snapshot saved ✅");

    setBench("");
    setSquat("");
    setClean("");
  };

  return (
    <div className="card">
      <h2>Pre-Season Max Entry</h2>

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

      <input
        placeholder="Bench Max"
        value={bench}
        onChange={e => setBench(e.target.value)}
      />

      <input
        placeholder="Squat Max"
        value={squat}
        onChange={e => setSquat(e.target.value)}
      />

      <input
        placeholder="Power Clean Max"
        value={clean}
        onChange={e => setClean(e.target.value)}
      />

      <select value={season} onChange={e => setSeason(e.target.value)}>
        <option>Fall</option>
        <option>Winter</option>
        <option>Spring</option>
        <option>Summer</option>
      </select>

      <input
        type="number"
        value={year}
        onChange={e => setYear(Number(e.target.value))}
      />

      <button onClick={saveSnapshot}>
        Save Snapshot
      </button>
    </div>
  );
}