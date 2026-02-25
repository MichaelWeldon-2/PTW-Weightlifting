import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";

export default function CoachNotes({
  profile,
  athletes = [],
  selectedYear,
  selectedSeason
}) {

  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState("");

  if (!profile) return null;

  useEffect(() => {

    let q;

    if (profile?.role === "coach") {
      q = query(
        collection(db, "coachNotes"),
        where("userId", "==", profile.uid),
        where("year", "==", selectedYear),
        where("season", "==", selectedSeason)
      );
    } else {
      q = query(
        collection(db, "coachNotes"),
        where("athleteRosterId", "==", rosterId),
        where("year", "==", selectedYear),
        where("season", "==", selectedSeason)
      );
    }

    const unsub = onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
    });

    return () => unsub();

  }, [profile, selectedYear, selectedSeason]);

  const addNote = async () => {
    if (!newNote || !selectedAthlete) return;

    const athleteObj = athletes.find(a => a.id === selectedAthlete);

    await addDoc(collection(db, "coachNotes"), {
      athleteId: selectedAthlete,
      athleteName: athleteObj?.name || "",
      userId: profile.uid,
      note: newNote,
      year: selectedYear,
      season: selectedSeason,
      createdAt: serverTimestamp()
    });

    setNewNote("");
  };

  const deleteNote = async (id) => {
    await deleteDoc(doc(db, "coachNotes", id));
  };

  return (
    <div className="card">
      <h2>Coach Notes</h2>

      {profile?.role === "coach" && (
        <>
          <select
            value={selectedAthlete}
            onChange={e => setSelectedAthlete(e.target.value)}
          >
            <option value="">Select Athlete</option>
            {athletes.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <input
            placeholder="Write note..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
          />

          <button className="btn-primary" onClick={addNote}>
            Add Note
          </button>
        </>
      )}

      <div style={{ marginTop: 20 }}>
        {notes.map(n => (
          <div key={n.id} className="card">
            <strong>{n.athleteName}</strong>
            <p>{n.note}</p>

            {profile?.role === "coach" && (
              <button
                className="btn-danger"
                onClick={() => deleteNote(n.id)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
