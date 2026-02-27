import { useEffect, useState, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
  getDocs
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

  /* ================= SCHOOL YEAR CONSTANTS ================= */

  const seasonOrder = {
    Fall: 1,
    Winter: 2,
    Spring: 3,
    Summer: 4
  };

  const getTrainingYear = (season, year) => {
    if (season === "Winter" || season === "Spring" || season === "Summer") {
      return Number(year) - 1;
    }
    return Number(year);
  };

  const buildSeasonIndex = (season, year) => {
    const trainingYear = getTrainingYear(season, year);
    return trainingYear * 10 + seasonOrder[season];
  };

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) return;

    const rosterRef = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(rosterRef, snap => {
      setAthletes(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= LOAD HISTORY ================= */

  useEffect(() => {
    if (!team?.id) return;

    const ref = collection(db, "seasonMaxes", team.id, "athletes");

    const unsub = onSnapshot(ref, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.seasonIndex || 0) - (b.seasonIndex || 0));

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

  /* ================= SAVE ================= */

  const handleSave = async () => {

    if (!isCoach) return alert("Only coaches can add historical data.");
    if (!team?.id) return alert("Team not loaded");
    if (!selectedAthlete) return alert("Select athlete");

    const snapshotId = `${selectedAthlete}_${season}_${year}`;

    const existingRef = doc(
      db,
      "seasonMaxes",
      team.id,
      "athletes",
      snapshotId
    );

    const existingSnap = await getDoc(existingRef);

    if (existingSnap.exists()) {
      return alert("Season already exists for this athlete.");
    }

    const athlete = athletes.find(a => a.id === selectedAthlete);

    const trainingYear = getTrainingYear(season, year);
    const seasonIndex = buildSeasonIndex(season, year);

    const payload = {
      athleteRosterId: selectedAthlete,
      athleteDisplayName: athlete?.displayName || "Unknown",
      season,
      year: Number(year),
      trainingYear,
      seasonIndex,
      benchMax: Number(benchMax) || 0,
      squatMax: Number(squatMax) || 0,
      powerCleanMax: Number(powerCleanMax) || 0,
      total: totalPreview,
      createdAt: serverTimestamp()
    };

    await setDoc(existingRef, payload);

    await setDoc(
      doc(db, "seasonMaxHistory", team.id, "athletes", snapshotId),
      payload
    );

    const currentRef = doc(db, "seasonMaxesCurrent", selectedAthlete);
    const currentSnap = await getDoc(currentRef);

    if (!currentSnap.exists() ||
        seasonIndex > (currentSnap.data()?.seasonIndex || 0)) {
      await setDoc(currentRef, payload);
    }

    setBenchMax("");
    setSquatMax("");
    setPowerCleanMax("");
  };

  /* ================= MIGRATION TOOL ================= */

 const migrateSeasonData = async () => {

  if (!team?.id) return;
  if (!isCoach) return alert("Coach only action.");

  const confirmRun = window.confirm(
    "FULL RESET: Recalculate ALL seasonIndex values and rebuild seasonMaxesCurrent. Continue?"
  );

  if (!confirmRun) return;

  try {

    const seasonOrder = {
      Summer: 1,
      Fall: 2,
      Winter: 3,
      Spring: 4
    };

    const getTrainingYear = (season, year) => {
      return (season === "Winter" || season === "Spring")
        ? Number(year) - 1
        : Number(year);
    };

    const buildSeasonIndex = (season, year) => {
      const trainingYear = getTrainingYear(season, year);
      return trainingYear * 10 + seasonOrder[season];
    };

    const seasonRef = collection(db, "seasonMaxes", team.id, "athletes");
    const seasonSnap = await getDocs(seasonRef);

    const latestPerAthlete = {};

    for (const docSnap of seasonSnap.docs) {

      const data = docSnap.data();

      const correctedTrainingYear =
        getTrainingYear(data.season, data.year);

      const correctedSeasonIndex =
        buildSeasonIndex(data.season, data.year);

      // ✅ Force overwrite seasonIndex correctly
      await setDoc(
        doc(db, "seasonMaxes", team.id, "athletes", docSnap.id),
        {
          trainingYear: correctedTrainingYear,
          seasonIndex: correctedSeasonIndex
        },
        { merge: true }
      );

      const athleteId = data.athleteRosterId;

      if (
        !latestPerAthlete[athleteId] ||
        correctedSeasonIndex >
          latestPerAthlete[athleteId].seasonIndex
      ) {
        latestPerAthlete[athleteId] = {
          ...data,
          trainingYear: correctedTrainingYear,
          seasonIndex: correctedSeasonIndex
        };
      }
    }

    // 🔥 Hard reset seasonMaxesCurrent
    for (const athleteId in latestPerAthlete) {
      await setDoc(
        doc(db, "seasonMaxesCurrent", athleteId),
        latestPerAthlete[athleteId]
      );
    }

    alert("FULL rebuild complete. Reload page.");

  } catch (err) {
    console.error(err);
    alert("Migration failed.");
  }
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
              <option>Fall</option>
              <option>Winter</option>
              <option>Spring</option>
              <option>Summer</option>
            </select>

            <input
              type="number"
              value={year}
              onChange={e => setYear(e.target.value)}
              placeholder="Year"
            />

            <input
              type="number"
              placeholder="Bench"
              value={benchMax}
              onChange={e => setBenchMax(e.target.value)}
            />

            <input
              type="number"
              placeholder="Squat"
              value={squatMax}
              onChange={e => setSquatMax(e.target.value)}
            />

            <input
              type="number"
              placeholder="Clean"
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

          <hr style={{ margin: "30px 0" }} />

          <h3>🛠 Data Migration Tool</h3>

          <button onClick={migrateSeasonData}>
            Rebuild Season Ordering
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
            <div>Bench: {h.benchMax}</div>
            <div>Squat: {h.squatMax}</div>
            <div>Clean: {h.powerCleanMax}</div>
            <div className="metric-value">
              Total: {h.total}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}