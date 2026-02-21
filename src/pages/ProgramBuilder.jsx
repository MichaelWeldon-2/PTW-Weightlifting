import { useState } from "react"
import { doc, setDoc } from "firebase/firestore"
import { db } from "../firebase"
import { generateProgram } from "../utils/periodizationEngine"

export default function ProgramBuilder({ team }) {
  const [seasonLength, setSeasonLength] = useState(16)
  const [competitionDate, setCompetitionDate] = useState("")
  const [level, setLevel] = useState("Intermediate")
  const [emphasisLift, setEmphasisLift] = useState("bench")
  const [daysPerWeek, setDaysPerWeek] = useState(4)

  async function handleGenerate() {
    const blocks = generateProgram({
      seasonLength: Number(seasonLength),
      level,
      emphasisLift
    })

    await setDoc(doc(db, "teamPrograms", team.id), {
      teamId: team.id,
      seasonLength,
      competitionDate,
      level,
      emphasisLift,
      daysPerWeek,
      blocks,
      createdAt: new Date()
    })

    alert("Program Generated Successfully")
  }

  return (
    <div className="card">
      <h2>AI Block Builder</h2>

      <input
        type="number"
        value={seasonLength}
        onChange={(e) => setSeasonLength(e.target.value)}
        placeholder="Season Length (weeks)"
      />

      <input
        type="date"
        value={competitionDate}
        onChange={(e) => setCompetitionDate(e.target.value)}
      />

      <select value={level} onChange={(e) => setLevel(e.target.value)}>
        <option>Beginner</option>
        <option>Intermediate</option>
        <option>Advanced</option>
      </select>

      <select value={emphasisLift} onChange={(e) => setEmphasisLift(e.target.value)}>
        <option value="bench">Bench</option>
        <option value="squat">Squat</option>
        <option value="powerClean">Power Clean</option>
      </select>

      <input
        type="number"
        value={daysPerWeek}
        onChange={(e) => setDaysPerWeek(e.target.value)}
        placeholder="Days per Week"
      />

      <button onClick={handleGenerate}>
        Generate AI Program
      </button>
    </div>
  )
}