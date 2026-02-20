import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function TrainingCalendar({ profile }) {

  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [season, setSeason] = useState("Fall");

  const seasons = ["Summer", "Fall", "Winter", "Spring"];

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "trainingCalendar"),
      snap => {
        setEvents(
          snap.docs.map(d => ({
            id: d.id,
            ...d.data()
          }))
        );
      }
    );

    return () => unsub();
  }, []);

  const addEvent = async () => {
    if (!title || !date) return;

    await addDoc(collection(db, "trainingCalendar"), {
      title,
      description,
      date,
      season,
      year: Number(year),
      createdBy: profile.uid,
      createdAt: serverTimestamp()
    });

    setTitle("");
    setDescription("");
    setDate("");
  };

  const deleteEvent = async (id) => {
    await deleteDoc(doc(db, "trainingCalendar", id));
  };

  const filteredEvents = events
    .filter(e => e.year === Number(year) && e.season === season)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="card">
      <h2>Training Calendar</h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10 }}>
        <select value={year} onChange={e => setYear(e.target.value)}>
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y}>{y}</option>
          ))}
        </select>

        <select value={season} onChange={e => setSeason(e.target.value)}>
          {seasons.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {profile.role === "coach" && (
        <div style={{ marginTop: 20 }}>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          <input
            placeholder="Workout Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <input
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <button className="btn-primary" onClick={addEvent}>
            Add Training Day
          </button>
        </div>
      )}

      <hr />

      {filteredEvents.length === 0 && <p>No scheduled sessions.</p>}

      {filteredEvents.map(e => (
        <div key={e.id} className="card">
          <strong>{e.date}</strong>
          <h4>{e.title}</h4>
          <p>{e.description}</p>

          {profile.role === "coach" && (
            <button
              className="btn-danger"
              onClick={() => deleteEvent(e.id)}
            >
              Delete
            </button>
          )}
        </div>
      ))}

    </div>
  );
}
