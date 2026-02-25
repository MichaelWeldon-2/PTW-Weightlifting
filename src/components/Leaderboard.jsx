import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function Leaderboard({ team }) {

  const seasons = ["Summer", "Fall", "Winter", "Spring"];
  const currentYear = new Date().getFullYear();

  const [season, setSeason] = useState("Winter");
  const [year, setYear] = useState(currentYear);
  const [category, setCategory] = useState("Total");

  const [seasonData, setSeasonData] = useState([]);
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

    const filtered = docs.filter(d =>
      d.year === Number(year) && d.season === season
    );

    setSeasonData(filtered);
  });

  return () => unsub();
}, [team?.id, year, season]);

  /* ================= CURRENT SORT ================= */

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

  /* ================= MOST IMPROVED ================= */

  const mostImproved = useMemo(() => {

    if (!seasonData.length) return [];

    const prevSeasonData = allData.filter(d =>
      d.year === Number(year) - 1 && d.season === season
    );

    const improvements = [];

    seasonData.forEach(current => {

      const previous = prevSeasonData.find(p =>
        p.athleteRosterId === current.athleteRosterId
      );

      if (!previous) return;

      const diff = (current.total || 0) - (previous.total || 0);
      const percent =
        previous.total > 0
          ? ((diff / previous.total) * 100).toFixed(1)
          : 0;

      const rosterEntry = roster.find(r =>
        r.id === current.athleteRosterId
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

  }, [seasonData, allData, year, season, roster]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>Leaderboard</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

        <select value={season} onChange={e => setSeason(e.target.value)}>
          {seasons.map(s => <option key={s}>{s}</option>)}
        </select>

        <input
          type="number"
          value={year}
          onChange={e => setYear(e.target.value)}
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

        const rosterEntry = roster.find(r =>
          r.id === athlete.athleteRosterId
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

      <h3>Most Improved (Year Over Year)</h3>

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