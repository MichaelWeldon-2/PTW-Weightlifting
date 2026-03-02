import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import HeroHeader from "../components/HeroHeader";
export default function Leaderboard({ team }) {

  const seasons = ["Summer", "Fall", "Winter", "Spring"];
  const currentYear = new Date().getFullYear();

  const [season, setSeason] = useState("Winter");
  const [year, setYear] = useState(currentYear);
  const [category, setCategory] = useState("Total");

  const [allData, setAllData] = useState([]);
  const [roster, setRoster] = useState([]);

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

  /* ================= LOAD SEASON MAX DATA ================= */

  useEffect(() => {
    if (!team?.id) return;

    const ref = collection(db, "seasonMaxes", team.id, "athletes");

    const unsub = onSnapshot(ref, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setAllData(docs);
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= GET CURRENT SEASON INDEX ================= */

 const seasonOrder = {
  Summer: 1,
  Fall: 2,
  Winter: 3,
  Spring: 4
};

const currentSeasonIndex = useMemo(() => {

  const found = allData.find(
    d => d.year === Number(year) && d.season === season
  );

  if (!found) return null;

  // ✅ Use stored seasonIndex if present
  if (found.seasonIndex) return found.seasonIndex;

  // ✅ Fallback calculation (only if old data)
  return Number(found.year) * 10 + seasonOrder[found.season];

}, [allData, year, season]);
  /* ================= FILTER CURRENT SEASON ================= */

  const seasonData = useMemo(() => {
    if (!currentSeasonIndex) return [];
    return allData.filter(d => d.seasonIndex === currentSeasonIndex);
  }, [allData, currentSeasonIndex]);

  /* ================= SORT ================= */

  const sorted = useMemo(() => {
    if (!seasonData.length) return [];

    const key =
      category === "Bench"
        ? "benchMax"
        : category === "Squat"
        ? "squatMax"
        : category === "Power Clean"
        ? "powerCleanMax"
        : "total";

    return [...seasonData].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  }, [seasonData, category]);

  /* ================= MOST IMPROVED (TRUE PREVIOUS SEASON) ================= */

 const mostImproved = useMemo(() => {

  if (!currentSeasonIndex) return [];

  // Get all unique season indexes sorted
  const uniqueIndexes = [
    ...new Set(allData.map(d => d.seasonIndex))
  ].sort((a, b) => a - b);

  const currentPosition = uniqueIndexes.indexOf(currentSeasonIndex);
  if (currentPosition <= 0) return [];

  const previousSeasonIndex = uniqueIndexes[currentPosition - 1];

  const previousSeasonData = allData.filter(
    d => d.seasonIndex === previousSeasonIndex
  );

  const improvements = [];

  seasonData.forEach(current => {

    const previous = previousSeasonData.find(
      p => p.athleteRosterId === current.athleteRosterId
    );

    if (!previous) return;

    const diff = (current.total || 0) - (previous.total || 0);

    const percent =
      previous.total > 0
        ? ((diff / previous.total) * 100).toFixed(1)
        : 0;

    const rosterEntry = roster.find(
      r => r.id === current.athleteRosterId
    );

    improvements.push({
      athleteName:
        rosterEntry?.displayName ||
        current.athleteDisplayName ||
        "Unknown",
      diff,
      percent
    });

  });

  return improvements.sort((a, b) => b.diff - a.diff);

}, [seasonData, allData, currentSeasonIndex, roster]);

  /* ================= UI ================= */

  return (
    <div className="card">
<HeroHeader
  title="Leaderboard"
  image={team?.pageImages?.leaderboard}
/>
      <h2>Leaderboard</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

        <select value={season} onChange={e => setSeason(e.target.value)}>
          {seasons.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <input
          type="number"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
        />

        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option>Total</option>
          <option>Bench</option>
          <option>Squat</option>
          <option>Power Clean</option>
        </select>

      </div>

      <hr />

      <h3>Rankings</h3>
      {sorted.length === 0 && <div>No data.</div>}

      {sorted.map((athlete, index) => {

        const rosterEntry = roster.find(
          r => r.id === athlete.athleteRosterId
        );

        const resolvedName =
          rosterEntry?.displayName ||
          athlete.athleteDisplayName ||
          "Unknown";

        const value =
          category === "Bench"
            ? athlete.benchMax
            : category === "Squat"
            ? athlete.squatMax
            : category === "Power Clean"
            ? athlete.powerCleanMax
            : athlete.total;

        return (
          <div key={athlete.athleteRosterId}>
            #{index + 1} — {resolvedName} — {value || 0} lbs
          </div>
        );
      })}

      <hr />

      <h3>Most Improved</h3>

      {mostImproved.length === 0 && <div>No comparison data.</div>}

      {mostImproved.map((athlete, index) => (
        <div key={index}>
          #{index + 1} — {athlete.athleteName}
          — +{athlete.diff} lbs
          ({athlete.percent}%)
        </div>
      ))}

    </div>
  );
}