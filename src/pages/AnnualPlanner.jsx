import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function AnnualPlanner({ team, profile }) {

  const currentYear = new Date().getFullYear();
  const isCoach = profile?.role === "coach";

  const [phases, setPhases] = useState([]);
  const [newPhase, setNewPhase] = useState({
    name: "",
    start: "",
    end: "",
    intensity: "High",
    focus: "Strength"
  });

  /* ================= LOAD EXISTING CALENDAR ================= */

  useEffect(() => {

    if (!team?.id) return;

    const loadCalendar = async () => {

      const snap = await getDoc(
        doc(db, "teams", team.id, "annualCalendar", String(currentYear))
      );

      if (snap.exists()) {
        setPhases(snap.data().phases || []);
      } else {
        setPhases([]);
      }
    };

    loadCalendar();

  }, [team?.id, currentYear]);

  /* ================= ADD PHASE ================= */

  const addPhase = () => {

    if (!isCoach) return;

    if (!newPhase.name || !newPhase.start || !newPhase.end) {
      alert("Fill all fields");
      return;
    }

    setPhases([...phases, newPhase]);

    setNewPhase({
      name: "",
      start: "",
      end: "",
      intensity: "High",
      focus: "Strength"
    });
  };

  /* ================= SAVE ================= */

  const saveCalendar = async () => {

    if (!team?.id || !isCoach) return;

    await setDoc(
      doc(db, "teams", team.id, "annualCalendar", String(currentYear)),
      {
        year: currentYear,
        phases
      }
    );

    alert("Calendar saved.");
  };

  /* ================= DELETE PHASE ================= */

  const deletePhase = (index) => {

    if (!isCoach) return;

    const updated = [...phases];
    updated.splice(index, 1);
    setPhases(updated);
  };

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>Annual Training Planner ({currentYear})</h2>

      {/* ===== EMPTY STATE FOR ATHLETES ===== */}
      {!isCoach && phases.length === 0 && (
        <p>Coach has not published an annual plan yet.</p>
      )}

      {/* ===== PHASE CREATION (COACH ONLY) ===== */}
      {isCoach && (
        <div style={{ marginBottom: 20 }}>

          <input
            placeholder="Phase Name"
            value={newPhase.name}
            onChange={e => setNewPhase({ ...newPhase, name: e.target.value })}
          />

          <input
            type="date"
            value={newPhase.start}
            onChange={e => setNewPhase({ ...newPhase, start: e.target.value })}
          />

          <input
            type="date"
            value={newPhase.end}
            onChange={e => setNewPhase({ ...newPhase, end: e.target.value })}
          />

          <select
            value={newPhase.intensity}
            onChange={e => setNewPhase({ ...newPhase, intensity: e.target.value })}
          >
            <option>High</option>
            <option>Moderate</option>
            <option>Maintenance</option>
            <option>Off</option>
          </select>

          <select
            value={newPhase.focus}
            onChange={e => setNewPhase({ ...newPhase, focus: e.target.value })}
          >
            <option>Strength</option>
            <option>Conditioning</option>
            <option>In Season</option>
            <option>Recovery</option>
          </select>

          <button onClick={addPhase}>
            Add Phase
          </button>

        </div>
      )}

      <hr />

      {/* ===== PHASE LIST (VIEWABLE BY ALL) ===== */}
      {phases.map((phase, index) => (
        <div key={index} className="card" style={{ marginBottom: 10 }}>
          <strong>{phase.name}</strong>
          <div>{phase.start} → {phase.end}</div>
          <div>Intensity: {phase.intensity}</div>
          <div>Focus: {phase.focus}</div>

          {isCoach && (
            <button
              style={{ marginTop: 8, background: "var(--danger)" }}
              onClick={() => deletePhase(index)}
            >
              Delete
            </button>
          )}
        </div>
      ))}

      {isCoach && (
        <button style={{ marginTop: 20 }} onClick={saveCalendar}>
          Save Calendar
        </button>
      )}

    </div>
  );
}