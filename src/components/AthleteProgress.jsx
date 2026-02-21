import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  documentId
} from "firebase/firestore";
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

export default function AthleteProgress({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [allData, setAllData] = useState([]);

  /* ================= LOAD TEAM ATHLETES ================= */

  useEffect(() => {

    if (!team?.members?.length) {
      setAthletes([]);
      return;
    }

    const loadAthletes = async () => {

      const memberIds = team.members;

      const chunks = [];
      for (let i = 0; i < memberIds.length; i += 10) {
        chunks.push(memberIds.slice(i, i + 10));
      }

      const results = [];

      chunks.forEach(chunk => {
        const q = query(
          collection(db, "users"),
          where(documentId(), "in", chunk)
        );

        onSnapshot(q, snap => {
          snap.docs.forEach(d => {
            const data = d.data();
            if (data.role === "athlete") {
              results.push({ id: d.id, ...data });
            }
          });

          setAthletes([...results]);
        });
      });
    };

    loadAthletes();

  }, [team]);

  /* ================= AUTO SELECT SELF ================= */

  useEffect(() => {
    if (profile?.role === "athlete") {
      setSelectedAthlete(profile.uid);
    }
  }, [profile]);

  /* ================= LOAD SEASON DATA ================= */

  useEffect(() => {

    if (!team?.id || !selectedAthlete) {
      setAllData([]);
      return;
    }

    const q = query(
      collection(db, "seasonMaxes"),
      where("teamId", "==", team.id),
      where("athleteId", "==", selectedAthlete)
    );

    const unsub = onSnapshot(q, snap => {
      setAllData(snap.docs.map(d => d.data()));
    });

    return () => unsub();

  }, [team, selectedAthlete]);

  /* ================= SORT ================= */

  const chartData = useMemo(() => {

    return [...allData]
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return seasonOrder[a.season] - seasonOrder[b.season];
      })
      .map(d => ({
        label: `${d.season} ${d.year}`,
        total: d.total || 0
      }));

  }, [allData]);

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
          {athletes.map(a => (
            <option key={a.id} value={a.id}>
              {a.displayName}
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