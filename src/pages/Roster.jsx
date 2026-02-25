import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function Roster({ team }) {

  const [roster, setRoster] = useState([]);

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {

    if (!team?.id) return;

    const ref = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(ref, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setRoster(list);
    });

    return () => unsub();

  }, [team?.id]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>👥 Team Roster</h2>

      {roster.length === 0 && (
        <div>No athletes added to roster yet.</div>
      )}

      <div className="dashboard-grid">

        {roster.map(a => (
          <div key={a.id} className="card metric-card">

            <h4>{a.displayName}</h4>

            <div style={{ marginTop: 8 }}>
              {a.linkedUid ? (
                <span style={{
                  background: "#22c55e",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  ✅ Linked
                </span>
              ) : (
                <span style={{
                  background: "#facc15",
                  color: "black",
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  ⏳ Not Linked
                </span>
              )}
            </div>

          </div>
        ))}

      </div>

    </div>
  );
}