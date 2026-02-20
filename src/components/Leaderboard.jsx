import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function Leaderboard({ profile }) {

  const seasons = ["Summer", "Fall", "Winter", "Spring"];
  const currentYear = new Date().getFullYear();

  const [season, setSeason] = useState("Winter");
  const [year, setYear] = useState(currentYear);
  const [category, setCategory] = useState("Total");

  const [seasonData, setSeasonData] = useState([]);
  const [allData, setAllData] = useState([]);

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    if (!profile?.teamId) return;

    const q = query(
      collection(db, "seasonMaxes"),
      where("teamId", "==", profile.teamId)
    );

    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => d.data());
      setAllData(docs);

      const filtered = docs.filter(d =>
        d.year === Number(year) && d.season === season
      );

      setSeasonData(filtered);
    });

    return () => unsub();
  }, [profile, year, season]);

  /* ================= CURRENT SORT ================= */

  const sorted = useMemo(() => {
    if (!seasonData.length) return [];

    const key =
      category === "Bench"
        ? "bench"
        : category === "Squat"
        ? "squat"
        : category === "Power Clean"
        ? "powerClean"
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
        p.athleteId === current.athleteId
      );

      if (!previous) return;

      const diff = (current.total || 0) - (previous.total || 0);
      const percent =
        previous.total > 0
          ? ((diff / previous.total) * 100).toFixed(1)
          : 0;

      improvements.push({
        athleteName: current.athleteName,
        diff,
        percent
      });

    });

    return improvements.sort((a, b) => b.diff - a.diff);

  }, [seasonData, allData, year, season]);

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
        const value =
          category === "Bench"
            ? athlete.bench
            : category === "Squat"
            ? athlete.squat
            : category === "Power Clean"
            ? athlete.powerClean
            : athlete.total;

        return (
          <div key={athlete.athleteId}>
            #{index + 1} — {athlete.athleteName} — {value || 0} lbs
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
