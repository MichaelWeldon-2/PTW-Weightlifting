import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";

export default function Notes({ profile, team }) {

  const [notes, setNotes] = useState([]);
  const [roster, setRoster] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("team");
  const [noteText, setNoteText] = useState("");

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER (COACH ONLY) ================= */
  useEffect(() => {
    if (!team?.id || !isCoach) return;

    const unsub = onSnapshot(
      collection(db, "athletes", team.id, "roster"),
      snap => {
        setRoster(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        );
      }
    );

    return () => unsub();
  }, [team?.id, isCoach]);

  /* ================= LOAD NOTES ================= */

  useEffect(() => {
    if (!team?.id) return;

    let q;

    if (isCoach) {
      if (selectedAthlete === "team") {
        q = query(
          collection(db, "notes"),
          where("teamId", "==", team.id),
          where("visibility", "==", "team"),
          orderBy("createdAt", "desc")
        );
      } else {
        q = query(
          collection(db, "notes"),
          where("teamId", "==", team.id),
          where("athleteRosterId", "==", selectedAthlete),
          orderBy("createdAt", "desc")
        );
      }
    } else {
      q = query(
        collection(db, "notes"),
        where("teamId", "==", team.id),
        where("athleteRosterId", "==", profile.athleteId),
        orderBy("createdAt", "desc")
      );
    }

    const unsub = onSnapshot(q, snap => {
      setNotes(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();

  }, [team?.id, selectedAthlete, profile, isCoach]);

  /* ================= SAVE NOTE ================= */

  const saveNote = async () => {

    if (!noteText.trim()) return;

    await addDoc(collection(db, "notes"), {
      teamId: team.id,
      createdByUid: profile.uid,
      createdByName: profile.displayName,
      role: profile.role,
      visibility: isCoach && selectedAthlete === "team"
        ? "team"
        : "athlete",
      athleteRosterId: isCoach
        ? selectedAthlete === "team"
          ? null
          : selectedAthlete
        : profile.athleteId,
      text: noteText.trim(),
      createdAt: serverTimestamp()
    });

    setNoteText("");
  };

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📝 Notes</h2>

      {isCoach && (
        <select
          value={selectedAthlete}
          onChange={e => setSelectedAthlete(e.target.value)}
        >
          <option value="team">Team Notes</option>
          {roster.map(r => (
            <option key={r.id} value={r.id}>
              {r.displayName}
            </option>
          ))}
        </select>
      )}

      <div style={{ marginTop: 20 }}>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Write note..."
          rows={4}
          style={{ width: "100%" }}
        />
      </div>

      <button style={{ marginTop: 10 }} onClick={saveNote}>
        Save Note
      </button>

      <hr style={{ margin: "30px 0" }} />

      {notes.length === 0 && <div>No notes yet.</div>}

      {notes.map(n => {

        const date = n.createdAt?.seconds
          ? new Date(n.createdAt.seconds * 1000)
          : null;

        return (
          <div key={n.id} className="card metric-card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {n.createdByName} — {date?.toLocaleDateString()}
            </div>
            <div style={{ marginTop: 6 }}>
              {n.text}
            </div>
          </div>
        );
      })}

    </div>
  );
}
