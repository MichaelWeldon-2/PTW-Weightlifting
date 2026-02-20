import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

const seasonOrder = {
  Summer: 1,
  Fall: 2,
  Winter: 3,
  Spring: 4
};

export default function AthleteProgress({ profile }) {

  const [allData, setAllData] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");

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
    });

    return () => unsub();
  }, [profile]);

  /* ================= ATHLETE LIST ================= */

  const athleteList = useMemo(() => {
    const unique = [...new Set(allData.map(d => d.athleteId))];

    return unique.map(id => {
      const athlete = allData.find(d => d.athleteId === id);
      return {
        athleteId: id,
        athleteName: athlete?.athleteName || "Unknown"
      };
    });
  }, [allData]);

  /* ================= AUTO SELECT SELF FOR ATHLETE ================= */

  useEffect(() => {
    if (!profile) return;

    if (profile.role === "athlete") {
      setSelectedAthlete(profile.uid);
    }
  }, [profile]);

  /* ================= FILTER + SORT ================= */

  const chartData = useMemo(() => {

    if (!selectedAthlete) return [];

    const filtered = allData.filter(d =>
      d.athleteId === selectedAthlete
    );

    return filtered
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return seasonOrder[a.season] - seasonOrder[b.season];
      })
      .map(d => ({
        label: `${d.season} ${d.year}`,
        total: d.total || 0,
        bench: d.bench || 0,
        squat: d.squat || 0,
        powerClean: d.powerClean || 0
      }));

  }, [allData, selectedAthlete]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>Performance Trends</h2>

      {profile.role === "coach" && (
        <select
          value={selectedAthlete}
          onChange={e => setSelectedAthlete(e.target.value)}
        >
          <option value="">Select Athlete</option>
          {athleteList.map(a => (
            <option key={a.athleteId} value={a.athleteId}>
              {a.athleteName}
            </option>
          ))}
        </select>
      )}

      <hr />

      {chartData.length === 0 && (
        <div>No season data available.</div>
      )}

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#0e28b1"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

    </div>
  );
}
