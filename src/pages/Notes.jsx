import { useEffect, useState, useMemo } from "react";
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
import HeroHeader from "../components/HeroHeader";
export default function Notes({ profile, team }) {

  const [notes, setNotes] = useState([]);
  const [roster, setRoster] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("team");
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("team"); // NEW

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

      q = query(
        collection(db, "notes"),
        where("teamId", "==", team.id),
        orderBy("createdAt", "desc")
      );

    } else {

      q = query(
        collection(db, "notes"),
        where("teamId", "==", team.id),
        where("visibility", "in", ["team", "athlete", "self"]),
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

  }, [team?.id, profile, isCoach]);

  /* ================= FILTER VISIBLE NOTES ================= */

  const visibleNotes = useMemo(() => {

    if (isCoach) {

      if (selectedAthlete === "team") {
        return notes.filter(n => n.visibility === "team");
      }

      return notes.filter(n =>
        n.visibility === "team" ||
        n.athleteRosterId === selectedAthlete
      );
    }

    // Athlete view
    return notes.filter(n =>
      n.visibility === "team" ||
      n.athleteRosterId === profile.athleteId ||
      (n.visibility === "self" && n.createdByUid === profile.uid)
    );

  }, [notes, selectedAthlete, isCoach, profile]);

  /* ================= SAVE NOTE ================= */

  const saveNote = async () => {

    if (!noteText.trim()) return;

    let visibility;
    let athleteRosterId = null;

    if (isCoach) {

      if (selectedAthlete === "team") {
        visibility = "team";
      } else {
        visibility = "athlete";
        athleteRosterId = selectedAthlete;
      }

    } else {

      visibility = "self";
      athleteRosterId = profile.athleteId;

    }

    await addDoc(collection(db, "notes"), {
      teamId: team.id,
      createdByUid: profile.uid,
      createdByName: profile.displayName,
      role: profile.role,
      visibility,
      athleteRosterId,
      text: noteText.trim(),
      createdAt: serverTimestamp()
    });

    setNoteText("");
  };

  /* ================= UI ================= */

  return (
    <div className="card">
 <HeroHeader
  title="Notes"
  image={team?.pageImages?.notes}
/>
      <h2>📝 Notes</h2>

      {/* ================= COACH FILTER ================= */}
      {isCoach && (
        <select
          value={selectedAthlete}
          onChange={e => setSelectedAthlete(e.target.value)}
        >
          <option value="team">📢 Team Notes</option>
          {roster.map(r => (
            <option key={r.id} value={r.id}>
              👤 {r.displayName}
            </option>
          ))}
        </select>
      )}

      {/* ================= ATHLETE PRIVATE BUTTON ================= */}
      {!isCoach && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          📝 Personal notes are private to you.
        </div>
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

      {visibleNotes.length === 0 && <div>No notes yet.</div>}

      {visibleNotes.map(n => {

        const date = n.createdAt?.seconds
          ? new Date(n.createdAt.seconds * 1000)
          : null;

        let badge = "";
        if (n.visibility === "team") badge = "📢 Team";
        if (n.visibility === "athlete") badge = "👤 Direct";
        if (n.visibility === "self") badge = "📝 Private";

        return (
          <div key={n.id} className="card metric-card" style={{ marginBottom: 10 }}>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {badge} — {n.createdByName} — {date?.toLocaleDateString()}
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