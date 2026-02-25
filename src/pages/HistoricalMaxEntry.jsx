import { useEffect, useState, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
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

  const [bulkInput, setBulkInput] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) return;

    const rosterRef = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(rosterRef, snap => {
      setAthletes(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= LOAD HISTORY ================= */

  useEffect(() => {
    if (!team?.id) return;

    const ref = collection(db, "seasonMaxHistory", team.id, "athletes");

    const unsub = onSnapshot(ref, snap => {
      setHistory(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= TOTAL PREVIEW ================= */

  const totalPreview = useMemo(() => {
    return (
      (Number(benchMax) || 0) +
      (Number(squatMax) || 0) +
      (Number(powerCleanMax) || 0)
    );
  }, [benchMax, squatMax, powerCleanMax]);

  /* ================= SINGLE SAVE ================= */

 const handleSave = async () => {

  if (!isCoach) {
    alert("Only coaches can add historical data.");
    return;
  }

  if (!team?.id) {
    alert("Team not loaded");
    return;
  }

  if (!selectedAthlete) {
    alert("Select athlete");
    return;
  }

  const athlete = athletes.find(a => a.id === selectedAthlete);

  const total =
    (Number(benchMax) || 0) +
    (Number(squatMax) || 0) +
    (Number(powerCleanMax) || 0);

  const snapshotId =
    `${selectedAthlete}_${season}_${year}`;

  const payload = {
    teamId: team.id,
    athleteRosterId: selectedAthlete,
    athleteDisplayName: athlete?.displayName || "Unknown",
    season,
    year: Number(year),
    benchMax: Number(benchMax) || 0,
    squatMax: Number(squatMax) || 0,
    powerCleanMax: Number(powerCleanMax) || 0,
    total,
    createdAt: serverTimestamp()
  };

  /* 🔥 1️⃣ Save to History */
  await setDoc(
    doc(db, "seasonMaxHistory", team.id, "athletes", `${snapshotId}_${Date.now()}`),
    payload
  );

  /* 🔥 2️⃣ Save to Live SeasonMaxes (Leaderboard Source) */
  await setDoc(
    doc(db, "seasonMaxes", team.id, "athletes", snapshotId),
    payload
  );

  /* 🔥 3️⃣ Save to Current Maxes (Progress Tab Source) */
  await setDoc(
    doc(db, "seasonMaxesCurrent", selectedAthlete),
    {
      benchMax: payload.benchMax,
      squatMax: payload.squatMax,
      powerCleanMax: payload.powerCleanMax,
      total: payload.total,
      updatedAt: serverTimestamp()
    }
  );

  setBenchMax("");
  setSquatMax("");
  setPowerCleanMax("");
};

  /* ================= BULK UPLOAD ================= */

  const handleBulkUpload = async () => {

    if (!isCoach) return alert("Only coaches can bulk upload.");
    if (!bulkInput.trim()) return alert("Paste CSV data first.");

    setBulkLoading(true);
    setBulkResult(null);

    try {

      const lines = bulkInput.trim().split("\n");
      const dataLines = lines.slice(1);

      let successCount = 0;
      let failCount = 0;

      for (const line of dataLines) {

        const [name, seasonVal, yearVal, bench, squat, clean] =
          line.split(",");

        const rosterMatch = athletes.find(a =>
          a.displayName?.toLowerCase().trim() ===
          name.toLowerCase().trim()
        );

        if (!rosterMatch) {
          failCount++;
          continue;
        }

        const total =
          (Number(bench) || 0) +
          (Number(squat) || 0) +
          (Number(clean) || 0);

        const snapshotId =
          `${rosterMatch.id}_${seasonVal}_${yearVal}_${Date.now()}_${Math.random()}`;

        const payload = {
          teamId: team.id,
          athleteRosterId: rosterMatch.id,
          athleteDisplayName: rosterMatch.displayName,
          season: seasonVal,
          year: Number(yearVal),
          bench: Number(bench) || 0,
          squat: Number(squat) || 0,
          powerClean: Number(clean) || 0,
          total,
          createdAt: serverTimestamp()
        };

        await setDoc(
          doc(db, "seasonMaxHistory", team.id, "athletes", snapshotId),
          payload
        );

        await setDoc(
          doc(db, "seasonMaxes", snapshotId),
          payload
        );

        successCount++;
      }

      setBulkResult(
        `✅ Uploaded ${successCount} records. ❌ Failed: ${failCount}`
      );

      setBulkInput("");

    } catch (err) {
      console.error(err);
      alert("Bulk upload failed.");
    }

    setBulkLoading(false);
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    if (!isCoach || !team?.id) return;

    await deleteDoc(
      doc(db, "seasonMaxHistory", team.id, "athletes", id)
    );

    await deleteDoc(
      doc(db, "seasonMaxes", id)
    );
  };

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>🏋 Historical Max Entry</h2>

      {isCoach && (
        <>
          <div className="dashboard-grid">

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

            <select value={season} onChange={e => setSeason(e.target.value)}>
              <option>Summer</option>
              <option>Fall</option>
              <option>Winter</option>
              <option>Spring</option>
            </select>

            <input
              type="number"
              value={year}
              onChange={e => setYear(e.target.value)}
            />

            <input type="number" placeholder="Bench"
              value={benchMax}
              onChange={e => setBenchMax(e.target.value)}
            />

            <input type="number" placeholder="Squat"
              value={squatMax}
              onChange={e => setSquatMax(e.target.value)}
            />

            <input type="number" placeholder="Clean"
              value={powerCleanMax}
              onChange={e => setPowerCleanMax(e.target.value)}
            />

          </div>

          <div style={{ marginTop: 10 }}>
            Total: {totalPreview} lbs
          </div>

          <button onClick={handleSave} style={{ marginTop: 12 }}>
            Save Snapshot
          </button>
        </>
      )}

      <hr style={{ margin: "30px 0" }} />

      <h3>📊 Historical Records</h3>

      {history.length === 0 && <div>No records found.</div>}

      <div className="dashboard-grid">
        {history.map(h => (
          <div key={h.id} className="card metric-card">
            <h4>{h.athleteDisplayName}</h4>
            <div>{h.season} {h.year}</div>
            <div>Total: {h.total}</div>

            {isCoach && (
              <button
                style={{ marginTop: 10, background: "var(--danger)" }}
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