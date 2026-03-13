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

    if (found.seasonIndex) return found.seasonIndex;

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

  /* ================= BUILD CLUB GROUPS ================= */

  const clubs = useMemo(() => {

    if (category !== "Clubs") return null;

    const groups = {
      "1000 Club": [],
      "900 Club": [],
      "800 Club": [],
      "700 Club": [],
      "600 Club": [],
      "500 Club": [],
      "Below 500": []
    };

    seasonData.forEach(a => {

      const total = a.total || 0;

      if (total >= 1000) groups["1000 Club"].push(a);
      else if (total >= 900) groups["900 Club"].push(a);
      else if (total >= 800) groups["800 Club"].push(a);
      else if (total >= 700) groups["700 Club"].push(a);
      else if (total >= 600) groups["600 Club"].push(a);
      else if (total >= 500) groups["500 Club"].push(a);
      else groups["Below 500"].push(a);

    });

    return groups;

  }, [seasonData, category]);

  /* ================= MOST IMPROVED ================= */

  const mostImproved = useMemo(() => {

    if (!currentSeasonIndex) return [];

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
          <option>Clubs</option>
        </select>

      </div>

      <hr />

      <h3>Rankings</h3>

      {category !== "Clubs" && (
        <>
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
        </>
      )}

      {category === "Clubs" && clubs && (
        <>
          {Object.entries(clubs).map(([clubName, members]) => {

            if (members.length === 0) return null;

            return (
              <div key={clubName} style={{ marginBottom: 20 }}>

                <h3>{clubName}</h3>

                {members
                  .sort((a, b) => (b.total || 0) - (a.total || 0))
                  .map((athlete, index) => {

                    const rosterEntry = roster.find(
                      r => r.id === athlete.athleteRosterId
                    );

                    const resolvedName =
                      rosterEntry?.displayName ||
                      athlete.athleteDisplayName ||
                      "Unknown";

                    return (
                      <div key={athlete.athleteRosterId}>
                        {resolvedName} — {athlete.total || 0} lbs
                      </div>
                    );

                  })}

              </div>
            );

          })}
        </>
      )}

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
