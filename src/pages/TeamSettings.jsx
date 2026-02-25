import { useState } from "react";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  arrayUnion,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function TeamSettings({ team, profile }) {

  const [coachEmail, setCoachEmail] = useState("");

  const isCoach = team?.coaches?.includes(profile?.uid);

  if (!isCoach) {
    return (
      <div className="card">
        <h2>Team Settings</h2>
        <p>You do not have permission to manage this team.</p>
      </div>
    );
  }

  const addCoachByEmail = async () => {

    if (!coachEmail.trim()) {
      alert("Enter coach email.");
      return;
    }

    try {

      const q = query(
        collection(db, "users"),
        where("email", "==", coachEmail.trim())
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        alert("User not found.");
        return;
      }

      const coachUser = snap.docs[0];
      const coachUid = coachUser.id;

      await updateDoc(doc(db, "teams", team.id), {
        coaches: arrayUnion(coachUid)
      });

      await setDoc(
        doc(db, "users", coachUid, "teams", team.id),
        {
          role: "coach",
          joinedAt: serverTimestamp()
        }
      );

      alert("Coach added successfully ✅");
      setCoachEmail("");

    } catch (err) {
      console.error(err);
      alert("Error adding coach.");
    }
  };

  return (
    <div className="card">

      <h2>Team Settings</h2>

      <h3>Add Assistant Coach</h3>

      <input
        type="email"
        placeholder="Coach Email"
        value={coachEmail}
        onChange={(e) => setCoachEmail(e.target.value)}
      />

      <button onClick={addCoachByEmail}>
        Add Coach
      </button>

    </div>
  );
}