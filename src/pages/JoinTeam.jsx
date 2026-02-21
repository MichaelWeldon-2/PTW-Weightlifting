import { useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function JoinTeam({ profile }) {

  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [successTeamName, setSuccessTeamName] = useState(null);

  const joinTeam = async () => {

    if (!inviteCode.trim()) {
      alert("Enter invite code.");
      return;
    }

    if (!profile?.uid) {
      alert("User not loaded.");
      return;
    }

    try {

      setLoading(true);
      setSuccessTeamName(null);

      const normalizedCode = inviteCode.trim().toUpperCase();

      const q = query(
        collection(db, "teams"),
        where("inviteCode", "==", normalizedCode)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        alert("Invalid invite code.");
        setLoading(false);
        return;
      }

      const teamDoc = snap.docs[0];
      const teamId = teamDoc.id;
      const teamData = teamDoc.data();

      const memberRef = doc(
        db,
        "users",
        profile.uid,
        "teams",
        teamId
      );

      const existingMember = await getDoc(memberRef);

      if (existingMember.exists()) {
        alert("Already a member.");
        setLoading(false);
        return;
      }

      /* ===== ADD TEAM UNDER USER ===== */

      await setDoc(memberRef, {
        role: "athlete",
        joinedAt: serverTimestamp()
      });

      /* ===== UPDATE TEAM MEMBERS ARRAY ===== */

      await updateDoc(doc(db, "teams", teamId), {
        members: arrayUnion(profile.uid)
      });

      setSuccessTeamName(teamData.name);
      setInviteCode("");

    } catch (err) {
      console.error("Join team error:", err);
      alert("Error joining team.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">

      <h2>Join Team</h2>

      <input
        type="text"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        placeholder="Enter Invite Code"
      />

      <button onClick={joinTeam} disabled={loading}>
        {loading ? "Joining..." : "Join Team"}
      </button>

      {successTeamName && (
        <div style={{ marginTop: "12px", color: "green" }}>
          ✅ Joined <strong>{successTeamName}</strong>
        </div>
      )}

    </div>
  );
}