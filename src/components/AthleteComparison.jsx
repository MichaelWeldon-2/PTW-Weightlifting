import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function AthleteComparison({ profile }) {
  const [records, setRecords] = useState([]);
  const [year1, setYear1] = useState("");
  const [year2, setYear2] = useState("");
  const [season, setSeason] = useState("Fall");

  const seasons = ["Summer", "Fall", "Winter", "Spring"];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "seasonMaxes"), snap => {
      const list = snap.docs.map(d => d.data());
      setRecords(list);

      const years = [...new Set(list.map(r => r.year))].sort((a, b) => b - a);

      if (!year1 && years.length > 1) {
        setYear1(years[0]);
        setYear2(years[1]);
      }
    });

    return () => unsub();
  }, []);

  if (!profile) return null;

  const athleteRecords = records.filter(r =>
    r.athleteId === profile.uid &&
    r.season === season
  );

  const rec1 = athleteRecords.find(r => r.year === Number(year1));
  const rec2 = athleteRecords.find(r => r.year === Number(year2));

  const diff = rec1 && rec2 ? rec1.total - rec2.total : null;

  const years = [...new Set(records.map(r => r.year))].sort((a, b) => b - a);

  return (
    <div className="card">
      <h2>Year Comparison</h2>

      <div style={{ display: "flex", gap: 10 }}>
        <select value={year1} onChange={e => setYear1(e.target.value)}>
          {years.map(y => (
            <option key={y}>{y}</option>
          ))}
        </select>

        <select value={year2} onChange={e => setYear2(e.target.value)}>
          {years.map(y => (
            <option key={y}>{y}</option>
          ))}
        </select>

        <select value={season} onChange={e => setSeason(e.target.value)}>
          {seasons.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <hr />

      {rec1 && rec2 && (
        <>
          <div>{year1}: {rec1.total} lbs</div>
          <div>{year2}: {rec2.total} lbs</div>

          <div
            style={{
              color:
                diff > 0
                  ? "green"
                  : diff < 0
                  ? "red"
                  : "black"
            }}
          >
            Difference: {diff > 0 ? "+" : ""}{diff} lbs
          </div>
        </>
      )}
    </div>
  );
}
