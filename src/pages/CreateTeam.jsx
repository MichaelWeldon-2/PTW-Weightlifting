import { useState } from "react";
import {
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

export default function CreateTeam({ profile }) {

  const [teamName, setTeamName] = useState("");
  const [seasonLength, setSeasonLength] = useState(16);
  const [organizationId, setOrganizationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const generateInviteCode = () => {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  };

  const createTeam = async () => {

    if (!teamName.trim()) {
      alert("Please enter a team name.");
      return;
    }

    if (!profile?.uid) {
      alert("User profile not loaded.");
      return;
    }

    try {

      setLoading(true);
      setSuccess(false);

      const teamId = `team_${Date.now()}`;
      const inviteCode = generateInviteCode();

      /* ===== CREATE TEAM DOCUMENT ===== */

      await setDoc(doc(db, "teams", teamId), {

        name: teamName.trim(),
        createdBy: profile.uid,
        createdAt: serverTimestamp(),

        currentSeason: "Season 1",
        currentBlock: "Volume",
        currentWeek: 1,
        trainingDayType: "Normal",

        seasonLength: Number(seasonLength),

        inviteCode,
        subscriptionStatus: "trial",
        subscriptionTier: "basic",

        organizationId: organizationId || null,

        // 🔥 ADD MEMBERS ARRAY
        members: [profile.uid]

      });

      /* ===== ADD TEAM UNDER USER ===== */

      await setDoc(
        doc(db, "users", profile.uid, "teams", teamId),
        {
          role: "coach",
          joinedAt: serverTimestamp()
        }
      );

      setTeamName("");
      setSeasonLength(16);
      setOrganizationId("");
      setSuccess(true);

    } catch (err) {
      console.error("Error creating team:", err);
      alert("Error creating team.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">

      <h2>Create New Team</h2>

      <input
        type="text"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        placeholder="Team Name"
      />

      <input
        type="number"
        value={seasonLength}
        onChange={(e) => setSeasonLength(e.target.value)}
        placeholder="Season Length (weeks)"
        min="4"
        max="52"
      />

      <input
        type="text"
        value={organizationId}
        onChange={(e) => setOrganizationId(e.target.value)}
        placeholder="Organization ID (optional)"
      />

      <button onClick={createTeam} disabled={loading}>
        {loading ? "Creating..." : "Create Team"}
      </button>

      {success && (
        <div style={{ marginTop: "12px", color: "green" }}>
          ✅ Team created successfully!
        </div>
      )}

    </div>
  );
}