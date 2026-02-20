import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function Progress({ profile }) {

  const [records, setRecords] = useState([]);

  useEffect(() => {

    if (!profile || !profile.uid) return;

    const q = query(
      collection(db, "seasonMaxes"),
      where("athleteId", "==", profile.uid)
    );

    const unsub = onSnapshot(q, snap => {
      setRecords(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();

  }, [profile]);

  const sorted = useMemo(() => {
    return [...records].sort((a, b) =>
      a.year === b.year
        ? a.season.localeCompare(b.season)
        : a.year - b.year
    );
  }, [records]);

  return (
    <div className="card">

      <h2>Progress</h2>

      {sorted.length === 0 && <p>No seasonal records yet.</p>}

      {sorted.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sorted}>
            <XAxis dataKey="season" />
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
