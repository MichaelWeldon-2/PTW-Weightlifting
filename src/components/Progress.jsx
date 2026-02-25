import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function Progress({ profile, team }) {

  const [record, setRecord] = useState(null);
  const [rosterId, setRosterId] = useState(null);

  /* ================= FIND ROSTER ID ================= */

  useEffect(() => {
    if (!profile?.uid || !team?.id) return;

    const unsub = onSnapshot(
      doc(db, "teams", team.id, "roster", profile.uid),
      snap => {
        if (snap.exists()) {
          setRosterId(snap.id);
        }
      }
    );

    return () => unsub();
  }, [profile?.uid, team?.id]);

  /* ================= LOAD CURRENT MAX ================= */

  useEffect(() => {
    if (!rosterId) return;

    const unsub = onSnapshot(
      doc(db, "seasonMaxesCurrent", rosterId),
      snap => {
        if (snap.exists()) {
          setRecord(snap.data());
        }
      }
    );

    return () => unsub();
  }, [rosterId]);

  if (!record) {
    return (
      <div className="card">
        <h2>Progress</h2>
        <p>No records yet.</p>
      </div>
    );
  }

  const data = [
    { lift: "Bench", value: record.benchMax || 0 },
    { lift: "Squat", value: record.squatMax || 0 },
    { lift: "PowerClean", value: record.powerCleanMax || 0 }
  ];

  return (
    <div className="card">
      <h2>Progress</h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="lift" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0e28b1"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}