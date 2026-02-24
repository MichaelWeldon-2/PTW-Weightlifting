import { useEffect, useState } from "react";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  serverTimestamp,
  updateDoc,
  arrayUnion
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { motion, AnimatePresence } from "framer-motion";

import Dashboard from "./components/Dashboard";
import Workouts from "./components/Workouts";
import Leaderboard from "./components/Leaderboard";
import AthleteProgress from "./components/AthleteProgress";
import CoachDashboard from "./components/CoachDashboard";
import AthleteDeepDive from "./components/AthleteDeepDive";
import ProgramBuilder from "./pages/ProgramBuilder";
import CreateTeam from "./pages/CreateTeam";
import HistoricalMaxEntry from "./pages/HistoricalMaxEntry";
import AnnualPlanner from "./pages/AnnualPlanner";
import Account from "./components/Account";

import "./App.css";

/* ================= NAV COMPONENTS ================= */

function NavItem({ icon, label, active, onClick }) {
  return (
    <div
      className={`bottom-nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="nav-icon">{icon}</div>
      <div className="nav-label">{label}</div>
    </div>
  );
}

function SidebarItem({ label, active, onClick }) {
  return (
    <div
      className={`sidebar-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {label}
    </div>
  );
}

export default function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [roleChoice, setRoleChoice] = useState("athlete");
  const [inviteCode, setInviteCode] = useState("");

  /* ================= LOAD TEAMS ================= */

  const loadTeams = async (uid) => {
    const teamsSnap = await getDocs(collection(db, "users", uid, "teams"));
    const userTeams = [];

    for (const docSnap of teamsSnap.docs) {
      const teamId = docSnap.id;
      const teamSnap = await getDoc(doc(db, "teams", teamId));

      if (teamSnap.exists()) {
        userTeams.push({
          id: teamSnap.id,
          ...teamSnap.data()
        });
      }
    }

    setTeams(userTeams);
    if (userTeams.length > 0) {
      setActiveTeam(userTeams[0]);
    }
  };

  /* ================= AUTH LISTENER ================= */

  useEffect(() => {

    const unsub = onAuthStateChanged(auth, async (u) => {

      setUser(u);

      if (!u) {
        setProfile(null);
        setActiveTeam(null);
        setLoadingProfile(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));

        if (!snap.exists()) {
          setLoadingProfile(false);
          return;
        }

        const userProfile = { uid: u.uid, ...snap.data() };
        setProfile(userProfile);
        await loadTeams(u.uid);

      } catch (err) {
        console.error("Profile load error:", err);
        setProfile(null);
      }

      setLoadingProfile(false);
    });

    return () => unsub();

  }, []);

  /* ================= AUTH SCREEN ================= */

if (!user) {
  return (
    <div className="auth-container">
      <div className="auth-card">

        <div className="auth-title">PTW Weightlifting</div>

        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
        />

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
        />

        {isRegistering && (
          <>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Full Name (Must Match Roster)"
            />

            <div style={{ marginBottom: 12 }}>
              <label>
                <input
                  type="radio"
                  value="coach"
                  checked={roleChoice === "coach"}
                  onChange={() => setRoleChoice("coach")}
                />
                Coach
              </label>

              <label style={{ marginLeft: 20 }}>
                <input
                  type="radio"
                  value="athlete"
                  checked={roleChoice === "athlete"}
                  onChange={() => setRoleChoice("athlete")}
                />
                Athlete
              </label>
            </div>

            {roleChoice === "athlete" && (
              <input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                placeholder="Team Invite Code"
              />
            )}
          </>
        )}

        <button
          onClick={async () => {
            try {

              if (isRegistering) {

                if (!email || !password) {
                  alert("Enter email and password.");
                  return;
                }

                if (!displayName.trim()) {
                  alert("Enter full name.");
                  return;
                }

                let teamId = null;
                let athleteRosterId = null;

                /* ================= ATHLETE REGISTRATION ================= */

                if (roleChoice === "athlete") {

                  if (!inviteCode.trim()) {
                    alert("Invite code required.");
                    return;
                  }

                  const teamQuery = query(
                    collection(db, "teams"),
                    where("inviteCode", "==", inviteCode.trim().toUpperCase())
                  );

                  const teamSnap = await getDocs(teamQuery);

                  if (teamSnap.empty) {
                    alert("Invalid invite code.");
                    return;
                  }

                  teamId = teamSnap.docs[0].id;

                  const rosterRef = collection(db, "athletes", teamId, "roster");
                  const rosterSnap = await getDocs(rosterRef);

                  const normalizedName = displayName
                    .toLowerCase()
                    .trim();

                  const match = rosterSnap.docs.find(d =>
                    d.data().displayName?.toLowerCase().trim() === normalizedName
                  );

                  if (!match) {
                    alert("No roster record found. Contact your coach.");
                    return;
                  }

                  if (match.data().linkedUid) {
                    alert("This athlete is already registered.");
                    return;
                  }

                  athleteRosterId = match.id;
                }

                /* ================= CREATE AUTH USER ================= */

                const cred = await createUserWithEmailAndPassword(auth, email, password);
                const uid = cred.user.uid;

                /* ================= CREATE USER PROFILE ================= */

                await setDoc(doc(db, "users", uid), {
                  displayName: displayName.trim(),
                  role: roleChoice,
                  teamId: teamId || null,
                  athleteId: athleteRosterId || null,
                  createdAt: serverTimestamp()
                });

                /* ================= LINK ROSTER RECORD ================= */

                if (athleteRosterId && teamId) {
                  await setDoc(
                    doc(db, "athletes", teamId, "roster", athleteRosterId),
                    { linkedUid: uid },
                    { merge: true }
                  );
                }

                /* ================= ADD USER TO TEAM ================= */

                if (teamId) {
                  await setDoc(
                    doc(db, "users", uid, "teams", teamId),
                    {
                      role: roleChoice,
                      joinedAt: serverTimestamp()
                    }
                  );

                  await updateDoc(
                    doc(db, "teams", teamId),
                    {
                      members: arrayUnion(uid)
                    }
                  );
                }

              } else {

                await signInWithEmailAndPassword(auth, email, password);

              }

            } catch (err) {
              console.error("Auth error:", err);
              alert(err.message);
            }
          }}
        >
          {isRegistering ? "Register" : "Sign In"}
        </button>

        <button
          style={{
            marginTop: 10,
            background: "transparent",
            color: "var(--accent)"
          }}
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering
            ? "Already have an account? Sign In"
            : "Need an account? Register"}
        </button>

      </div>
    </div>
  );
}

  if (loadingProfile) return <div className="loading">Loading...</div>;
  if (!profile) return <div className="loading">Finalizing account...</div>;

  /* ================= MAIN APP ================= */

  return (
    <div className="app">

      <div className="sidebar">
        <h3 style={{ marginBottom: 20 }}>PTW</h3>

        <SidebarItem label="Dashboard" active={activeTab==="dashboard"} onClick={()=>setActiveTab("dashboard")} />
        <SidebarItem label="Workouts" active={activeTab==="workouts"} onClick={()=>setActiveTab("workouts")} />
        <SidebarItem label="Progress" active={activeTab==="progress"} onClick={()=>setActiveTab("progress")} />
        <SidebarItem label="Leaderboard" active={activeTab==="leaderboard"} onClick={()=>setActiveTab("leaderboard")} />

        {profile.role === "coach" && (
          <>
            <SidebarItem label="Coach" active={activeTab==="coach"} onClick={()=>setActiveTab("coach")} />
            <SidebarItem label="Analytics" active={activeTab==="deep"} onClick={()=>setActiveTab("deep")} />
            <SidebarItem label="Program Builder" active={activeTab==="program"} onClick={()=>setActiveTab("program")} />
            <SidebarItem label="Historical Max Entry" active={activeTab==="preseason"} onClick={()=>setActiveTab("preseason")} />
            <SidebarItem label="Create Team" active={activeTab==="createTeam"} onClick={()=>setActiveTab("createTeam")} />
          </>
        )}

        <SidebarItem label="Annual Planner" active={activeTab==="planner"} onClick={()=>setActiveTab("planner")} />
        <SidebarItem label="Account" active={activeTab==="account"} onClick={()=>setActiveTab("account")} />
      </div>

      <div className="content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + activeTeam?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >

            {activeTab === "dashboard" && <Dashboard profile={profile} team={activeTeam} />}
            {activeTab === "workouts" && <Workouts profile={profile} team={activeTeam} />}
            {activeTab === "progress" && <AthleteProgress profile={profile} team={activeTeam} />}
            {activeTab === "leaderboard" && <Leaderboard profile={profile} team={activeTeam} />}
            {activeTab === "coach" && profile.role==="coach" && <CoachDashboard team={activeTeam} />}
            {activeTab === "deep" && profile.role==="coach" && <AthleteDeepDive team={activeTeam} />}
            {activeTab === "program" && profile.role==="coach" && <ProgramBuilder team={activeTeam} />}
            {activeTab === "preseason" && profile.role==="coach" && (
  <HistoricalMaxEntry 
    team={activeTeam} 
    profile={profile} 
  />
)}
            {activeTab === "createTeam" && profile.role==="coach" && <CreateTeam profile={profile} />}
            {activeTab === "account" && <Account profile={profile} />}
            {activeTab === "planner" && profile.role==="coach" && <AnnualPlanner team={activeTeam} />}

          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}