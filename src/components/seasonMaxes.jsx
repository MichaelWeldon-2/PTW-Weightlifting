import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function SeasonMaxes({ profile }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    if (!profile) return;

    let q;

    if (profile?.role === "coach") {
      q = collection(db, "seasonMaxes");
    } else {
      q = query(
        collection(db, "seasonMaxes"),
        where("teamId", "==", profile.teamId)
      );
    }

    const unsub = onSnapshot(q, snap => {
      setRecords(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });

    return () => unsub();
  }, [profile]);

  return (
    <div className="card">
      <h2>Season Records</h2>

      {records.map(r => (
        <div key={r.id}>
          {r.athleteName} — {r.total} lbs ({r.season} {r.year})
        </div>
      ))}
    </div>
  );
}
