import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function SeasonLeaderboard() {
  const [records, setRecords] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [year, setYear] = useState("");
  const [season, setSeason] = useState("Fall");
  const [weightClassFilter, setWeightClassFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [gradFilter, setGradFilter] = useState("All");

  const seasons = ["Summer", "Fall", "Winter", "Spring"];
  const teams = ["All", "Varsity", "JV", "Freshman"];

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "seasonMaxes"), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecords(list);

      const years = [...new Set(list.map(r => r.year))].sort((a,b)=>b-a);
      if (!year && years.length) setYear(years[0]);
    });

    const unsub2 = onSnapshot(collection(db, "profiles"), snap => {
      const list = snap.docs.map(d => d.data());
      setProfiles(list);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  if (!year) return null;

  const getWeightClass = bw => {
    if (!bw) return "Unknown";
    if (bw <= 132) return "132";
    if (bw <= 145) return "145";
    if (bw <= 160) return "160";
    if (bw <= 180) return "180";
    if (bw <= 200) return "200";
    if (bw <= 220) return "220";
    return "220+";
  };

  const merged = records
    .filter(r => r.year === Number(year) && r.season === season)
    .map(r => {
      const profile = profiles.find(p => p.uid === r.athleteId);
      return {
        ...r,
        weightClass: getWeightClass(r.bodyweight),
        graduationYear: profile?.graduationYear || "Unknown",
        team: profile?.team || "Unknown"
      };
    })
    .filter(r =>
      (weightClassFilter === "All" || r.weightClass === weightClassFilter) &&
      (teamFilter === "All" || r.team === teamFilter) &&
      (gradFilter === "All" || r.graduationYear === Number(gradFilter))
    );

  if (!merged.length) {
    return <div className="card"><h2>No records found</h2></div>;
  }

  const previousYear = Number(year) - 1;
  const previousRecords = records.filter(r =>
    r.year === previousYear && r.season === season
  );

  const withImprovement = merged.map(r => {
    const prev = previousRecords.find(p => p.athleteId === r.athleteId);
    return {
      ...r,
      improvement: prev ? r.total - prev.total : null
    };
  });

  const rankBy = key =>
    [...withImprovement].sort((a,b)=>(b[key]||0)-(a[key]||0));

  const totalRank = rankBy("total");
  const improvementRank = rankBy("improvement");

  const medal = i => i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;

  const years = [...new Set(records.map(r=>r.year))].sort((a,b)=>b-a);
  const gradYears = [...new Set(profiles.map(p=>p.graduationYear))];

  return (
    <div className="card">
      <h2>Season Leaderboard</h2>

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <select value={year} onChange={e=>setYear(e.target.value)}>
          {years.map(y=><option key={y}>{y}</option>)}
        </select>

        <select value={season} onChange={e=>setSeason(e.target.value)}>
          {seasons.map(s=><option key={s}>{s}</option>)}
        </select>

        <select value={weightClassFilter} onChange={e=>setWeightClassFilter(e.target.value)}>
          {["All","132","145","160","180","200","220","220+"].map(c=><option key={c}>{c}</option>)}
        </select>

        <select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}>
          {teams.map(t=><option key={t}>{t}</option>)}
        </select>

        <select value={gradFilter} onChange={e=>setGradFilter(e.target.value)}>
          <option>All</option>
          {gradYears.map(g=><option key={g}>{g}</option>)}
        </select>
      </div>

      <hr/>

      <h3>Overall Total</h3>
      {totalRank.map((r,i)=>(
        <div key={r.id} className="leaderboard-row">
          <span>{medal(i)}</span>
          <span>{r.athleteName}</span>
          <span>{r.total} lbs</span>
          <span>{r.team}</span>
        </div>
      ))}

      <hr/>

      <h3>Most Improved</h3>
      {improvementRank.map((r,i)=>(
        <div key={r.id} className="leaderboard-row">
          <span>{medal(i)}</span>
          <span>{r.athleteName}</span>
          <span style={{color:r.improvement>0?"green":r.improvement<0?"red":"black"}}>
            {r.improvement===null?"—":`${r.improvement>0?"+":""}${r.improvement} lbs`}
          </span>
        </div>
      ))}
    </div>
  );
}
