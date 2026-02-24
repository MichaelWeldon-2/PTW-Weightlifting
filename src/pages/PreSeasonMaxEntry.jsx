import { useEffect, useState, useMemo } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function HistoricalMaxEntry({ team, profile }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [benchMax, setBenchMax] = useState("");
  const [squatMax, setSquatMax] = useState("");
  const [powerCleanMax, setPowerCleanMax] = useState("");
  const [season, setSeason] = useState("Fall");
  const [year, setYear] = useState(new Date().getFullYear());
  const [history, setHistory] = useState([]);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ATHLETES ================= */

  useEffect(() => {

    if (!team?.members?.length) return;

    const q = query(
      collection(db, "users"),
      where("__name__", "in", team.members.slice(0, 10))
    );

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "athlete");

      setAthletes(list);
    });

    return () => unsub();

  }, [team?.members]);

  /* ================= LOAD HISTORY ================= */

  useEffect(() => {

    if (!team?.id) return;

    const ref = collection(db, "seasonMaxHistory", team.id, "athletes");

    const unsub = onSnapshot(ref, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setHistory(docs);
    });

    return () => unsub();

  }, [team?.id]);

  /* ================= FILTERED HISTORY ================= */

  const filteredHistory = useMemo(() => {

    return history.filter(h => {

      if (!isCoach && h.athleteId !== profile.uid) return false;

      if (selectedAthlete && h.athleteId !== selectedAthlete) return false;
      if (season && h.season !== season) return false;
      if (year && Number(h.year) !== Number(year)) return false;

      return true;
    });

  }, [history, selectedAthlete, season, year, profile, isCoach]);

  /* ================= SAVE SNAPSHOT ================= */

  const handleSave = async () => {

    const athleteId = isCoach ? selectedAthlete : profile.uid;

    if (!athleteId) {
      alert("Select athlete");
      return;
    }

    const athleteName =
      athletes.find(a => a.id === athleteId)?.displayName ||
      profile.displayName;

    const total =
      (Number(benchMax) || 0) +
      (Number(squatMax) || 0) +
      (Number(powerCleanMax) || 0);

    const snapshotId =
      `${athleteId}_${season}_${year}_${Date.now()}`;

    await setDoc(
      doc(db, "seasonMaxHistory", team.id, "athletes", snapshotId),
      {
        athleteId,
        athleteName,
        season,
        year: Number(year),
        benchMax: Number(benchMax) || 0,
        squatMax: Number(squatMax) || 0,
        powerCleanMax: Number(powerCleanMax) || 0,
        total,
        createdAt: serverTimestamp()
      }
    );

    setBenchMax("");
    setSquatMax("");
    setPowerCleanMax("");
  };

  /* ================= DELETE SNAPSHOT ================= */

  const handleDelete = async (id) => {
    if (!isCoach) return;
    await deleteDoc(doc(db, "seasonMaxHistory", team.id, "athletes", id));
  };

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>🏋 Historical Max Entry</h2>

      {/* ENTRY FORM */}

      <div className="dashboard-grid">

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

        <input
          placeholder="Bench Max"
          value={benchMax}
          onChange={e => setBenchMax(e.target.value)}
        />

        <input
          placeholder="Squat Max"
          value={squatMax}
          onChange={e => setSquatMax(e.target.value)}
        />

        <input
          placeholder="Power Clean Max"
          value={powerCleanMax}
          onChange={e => setPowerCleanMax(e.target.value)}
        />

        <input
          placeholder="Season"
          value={season}
          onChange={e => setSeason(e.target.value)}
        />

        <input
          placeholder="Year"
          value={year}
          onChange={e => setYear(e.target.value)}
        />

      </div>

      <button onClick={handleSave} style={{ marginTop: 15 }}>
        Save Snapshot
      </button>

      <hr style={{ margin: "30px 0" }} />

      {/* HISTORY CARDS */}

      <h3>📊 Historical Records</h3>

      {filteredHistory.length === 0 && (
        <div>No records found.</div>
      )}

      <div className="dashboard-grid">

        {filteredHistory.map(h => (
          <div key={h.id} className="card metric-card">

            <h4>{h.athleteName}</h4>
            <div>{h.season} {h.year}</div>

            <div style={{ marginTop: 10 }}>
              Bench: {h.benchMax} lbs
            </div>
            <div>
              Squat: {h.squatMax} lbs
            </div>
            <div>
              Clean: {h.powerCleanMax} lbs
            </div>

            <div className="metric-value" style={{ marginTop: 10 }}>
              Total: {h.total} lbs
            </div>

            {isCoach && (
              <button
                style={{
                  marginTop: 12,
                  background: "var(--danger)"
                }}
                onClick={() => handleDelete(h.id)}
              >
                Delete
              </button>
            )}

          </div>
        ))}

      </div>

    </div>
  );
}