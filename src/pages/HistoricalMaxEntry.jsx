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

  /* 🔥 BULK TOOL STATE */
  const [bulkInput, setBulkInput] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) {
      setAthletes([]);
      return;
    }

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
      `${selectedAthlete}_${season}_${year}_${Date.now()}`;

    await setDoc(
      doc(db, "seasonMaxHistory", team.id, "athletes", snapshotId),
      {
        athleteRosterId: selectedAthlete,
        athleteName: athlete?.displayName || "Unknown",
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

  /* ================= BULK UPLOAD ================= */

  const handleBulkUpload = async () => {

    if (!isCoach) {
      alert("Only coaches can bulk upload.");
      return;
    }

    if (!bulkInput.trim()) {
      alert("Paste CSV data first.");
      return;
    }

    setBulkLoading(true);
    setBulkResult(null);

    try {

      const lines = bulkInput.trim().split("\n");
      const dataLines = lines.slice(1); // skip header

      let successCount = 0;
      let failCount = 0;

      for (const line of dataLines) {

        const [name, season, year, bench, squat, clean] =
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
          `${rosterMatch.id}_${season}_${year}_${Date.now()}_${Math.random()}`;

        await setDoc(
          doc(db, "seasonMaxHistory", team.id, "athletes", snapshotId),
          {
            athleteRosterId: rosterMatch.id,
            athleteName: rosterMatch.displayName,
            season,
            year: Number(year),
            benchMax: Number(bench) || 0,
            squatMax: Number(squat) || 0,
            powerCleanMax: Number(clean) || 0,
            total,
            createdAt: serverTimestamp()
          }
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

            <select
              value={season}
              onChange={e => setSeason(e.target.value)}
            >
              <option>Summer</option>
              <option>Fall</option>
              <option>Winter</option>
              <option>Spring</option>
            </select>

            <input
              type="number"
              value={year}
              onChange={e => setYear(e.target.value)}
              placeholder="Year"
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

          {/* 🔥 BULK TOOL */}
          <hr style={{ margin: "30px 0" }} />

          <h3>🚀 Bulk Historical Upload</h3>

          <textarea
            rows={8}
            placeholder="Paste CSV here..."
            value={bulkInput}
            onChange={e => setBulkInput(e.target.value)}
            style={{ width: "100%", marginTop: 10 }}
          />

          <button
            onClick={handleBulkUpload}
            disabled={bulkLoading}
            style={{ marginTop: 10 }}
          >
            {bulkLoading ? "Uploading..." : "Upload Bulk Data"}
          </button>

          {bulkResult && (
            <div style={{ marginTop: 10 }}>
              {bulkResult}
            </div>
          )}
        </>
      )}

      <hr style={{ margin: "30px 0" }} />

      <h3>📊 Historical Records</h3>

      {history.length === 0 && (
        <div>No records found.</div>
      )}

      <div className="dashboard-grid">
        {history.map(h => (
          <div key={h.id} className="card metric-card">

            <h4>{h.athleteName}</h4>
            <div>{h.season} {h.year}</div>

            <div>Bench: {h.benchMax}</div>
            <div>Squat: {h.squatMax}</div>
            <div>Clean: {h.powerCleanMax}</div>

            <div className="metric-value">
              Total: {h.total}
            </div>

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