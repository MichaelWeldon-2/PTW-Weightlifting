import { useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
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

      const membershipRef = doc(
        db,
        "users",
        profile.uid,
        "teams",
        teamId
      );

      const existingMembership = await getDoc(membershipRef);

      if (existingMembership.exists()) {
        alert("Already a member of this team.");
        setLoading(false);
        return;
      }

      /* ===== ADD TEAM UNDER USER (ONLY) ===== */

      await setDoc(membershipRef, {
        role: "athlete",
        joinedAt: serverTimestamp()
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