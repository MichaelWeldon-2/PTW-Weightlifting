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
import PreSeasonMaxEntry from "./pages/PreSeasonMaxEntry";
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

  /* ================= AUTO SNAPSHOT WHEN SEASON CHANGES ================= */

  const autoSeasonSnapshot = async (team) => {

    if (!team?.id || !team?.currentSeason || !team?.currentYear) return;

    const athletesQuery = query(
      collection(db, "users"),
      where("teamId", "==", team.id),
      where("role", "==", "athlete")
    );

    const athletesSnap = await getDocs(athletesQuery);

    for (const docSnap of athletesSnap.docs) {

      const athlete = docSnap.data();
      const athleteId = docSnap.id;

      const currentMaxSnap = await getDoc(
        doc(db, "seasonMaxesCurrent", athleteId)
      );

      if (!currentMaxSnap.exists()) continue;

      const currentMax = currentMaxSnap.data();

      const total =
        (currentMax.benchMax || 0) +
        (currentMax.squatMax || 0) +
        (currentMax.powerCleanMax || 0);

      const snapshotId =
        `${athleteId}_${team.currentSeason}_${team.currentYear}`;

      await setDoc(
        doc(db, "seasonMaxes", team.id, "athletes", snapshotId),
        {
          athleteId,
          athleteName: athlete.displayName,
          season: team.currentSeason,
          year: team.currentYear,
          benchMax: currentMax.benchMax || 0,
          squatMax: currentMax.squatMax || 0,
          powerCleanMax: currentMax.powerCleanMax || 0,
          total,
          createdAt: serverTimestamp()
        }
      );
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

  /* ================= WATCH FOR SEASON CHANGE ================= */

  useEffect(() => {
    if (!activeTeam) return;

    autoSeasonSnapshot(activeTeam);

  }, [activeTeam?.currentSeason, activeTeam?.currentYear]);

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

          <button
            onClick={async () => {
              try {
                await signInWithEmailAndPassword(auth, email, password);
              } catch (err) {
                alert(err.message);
              }
            }}
          >
            Sign In
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
            <SidebarItem label="Pre-Season Maxes" active={activeTab==="preseason"} onClick={()=>setActiveTab("preseason")} />
            <SidebarItem label="Create Team" active={activeTab==="createTeam"} onClick={()=>setActiveTab("createTeam")} />
          </>
        )}

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
            {activeTab === "preseason" && profile.role==="coach" && <PreSeasonMaxEntry team={activeTeam} />}
            {activeTab === "createTeam" && profile.role==="coach" && <CreateTeam profile={profile} />}
            {activeTab === "account" && <Account profile={profile} />}

          </motion.div>
        </AnimatePresence>
      </div>
<div className="bottom-nav">
  <NavItem icon="🏠" label="Home" active={activeTab==="dashboard"} onClick={()=>setActiveTab("dashboard")} />
  <NavItem icon="💪" label="Workouts" active={activeTab==="workouts"} onClick={()=>setActiveTab("workouts")} />
  <NavItem icon="📈" label="Progress" active={activeTab==="progress"} onClick={()=>setActiveTab("progress")} />
  {profile.role === "coach" && (
    <NavItem icon="🧠" label="Coach" active={activeTab==="coach"} onClick={()=>setActiveTab("coach")} />
  )}
  <NavItem icon="👤" label="Account" active={activeTab==="account"} onClick={()=>setActiveTab("account")} />
</div>
    </div>
  );
}