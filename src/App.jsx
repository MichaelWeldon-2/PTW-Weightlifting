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
  serverTimestamp
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { motion, AnimatePresence } from "framer-motion";

import TeamSettings from "./pages/TeamSettings";
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
import Roster from "./pages/Roster";

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

function DrawerItem({ label, onClick }) {
  return (
    <div className="drawer-item" onClick={onClick}>
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [roleChoice, setRoleChoice] = useState("athlete");
  const [inviteCode, setInviteCode] = useState("");
  useEffect(() => {document.documentElement.setAttribute("data-theme", theme);localStorage.setItem("theme", theme);}, [theme]);
  const setActiveTabAndClose = (tab) => {
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

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

                  let teamId = null;
                  let athleteRosterId = null;

                  if (roleChoice === "athlete") {

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

                    const normalizedName = displayName.toLowerCase().trim();

                    const match = rosterSnap.docs.find(d =>
                      d.data().displayName?.toLowerCase().trim() === normalizedName
                    );

                    if (!match) {
                      alert("No roster record found.");
                      return;
                    }

                    if (match.data().linkedUid) {
                      alert("Athlete already registered.");
                      return;
                    }

                    athleteRosterId = match.id;
                  }

                  const cred = await createUserWithEmailAndPassword(auth, email, password);
                  const uid = cred.user.uid;

                  await setDoc(doc(db, "users", uid), {
                    displayName: displayName.trim(),
                    role: roleChoice,
                    teamId: teamId || null,
                    athleteId: athleteRosterId || null,
                    createdAt: serverTimestamp()
                  });

                  if (athleteRosterId && teamId) {
                    await setDoc(
                      doc(db, "athletes", teamId, "roster", athleteRosterId),
                      { linkedUid: uid },
                      { merge: true }
                    );
                  }

                  if (teamId) {
                    await setDoc(
                      doc(db, "users", uid, "teams", teamId),
                      {
                        role: roleChoice,
                        joinedAt: serverTimestamp()
                      }
                    );
                  }

                } else {
                  await signInWithEmailAndPassword(auth, email, password);
                }

              } catch (err) {
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

    {/* ================= SIDEBAR (DESKTOP) ================= */}
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
          <SidebarItem label="Roster" active={activeTab==="roster"} onClick={()=>setActiveTab("roster")} />
          <SidebarItem label="Team Settings" active={activeTab==="settings"} onClick={()=>setActiveTab("settings")} />
        </>
      )}

      <SidebarItem label="Annual Planner" active={activeTab==="planner"} onClick={()=>setActiveTab("planner")} />
      <SidebarItem label="Account" active={activeTab==="account"} onClick={()=>setActiveTab("account")} />

      {/* 🌙 DARK MODE TOGGLE */}
      <SidebarItem
        label={theme === "dark" ? "☀ Light Mode" : "🌙 Dark Mode"}
        active={false}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
    </div>

    {/* ================= CONTENT ================= */}
    <div className="content">

      <div className="mobile-header">
        <div className="mobile-title">PTW</div>
        <button className="hamburger-btn" onClick={()=>setIsDrawerOpen(true)}>☰</button>
      </div>

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
          {activeTab === "preseason" && profile.role==="coach" && <HistoricalMaxEntry team={activeTeam} profile={profile} />}
          {activeTab === "createTeam" && profile.role==="coach" && <CreateTeam profile={profile} />}
          {activeTab === "roster" && profile.role==="coach" && <Roster team={activeTeam} />}
          {activeTab === "settings" && profile.role==="coach" && <TeamSettings team={activeTeam} profile={profile} />}
          {activeTab === "planner" && (<AnnualPlanner team={activeTeam} profile={profile} />)}
          {activeTab === "account" && <Account profile={profile} />}

        </motion.div>
      </AnimatePresence>
    </div>

    {/* ================= BOTTOM NAV ================= */}
    <div className="bottom-nav">
      <NavItem icon="🏠" label="Home" active={activeTab==="dashboard"} onClick={()=>setActiveTab("dashboard")} />
      <NavItem icon="💪" label="Workouts" active={activeTab==="workouts"} onClick={()=>setActiveTab("workouts")} />
      <NavItem icon="📈" label="Progress" active={activeTab==="progress"} onClick={()=>setActiveTab("progress")} />
      {profile.role === "coach" && (
        <NavItem icon="🧠" label="Coach" active={activeTab==="coach"} onClick={()=>setActiveTab("coach")} />
      )}
      <NavItem icon="👤" label="Account" active={activeTab==="account"} onClick={()=>setActiveTab("account")} />
    </div>

    {/* ================= MOBILE DRAWER ================= */}
    {isDrawerOpen && (
      <div className="drawer-overlay" onClick={()=>setIsDrawerOpen(false)}>
        <div className="drawer" onClick={(e)=>e.stopPropagation()}>
          <h3>Menu</h3>

          <DrawerItem label="Dashboard" onClick={()=>setActiveTabAndClose("dashboard")} />
          <DrawerItem label="Workouts" onClick={()=>setActiveTabAndClose("workouts")} />
          <DrawerItem label="Progress" onClick={()=>setActiveTabAndClose("progress")} />
          <DrawerItem label="Leaderboard" onClick={()=>setActiveTabAndClose("leaderboard")} />

          {profile.role === "coach" && (
            <>
              <DrawerItem label="Coach" onClick={()=>setActiveTabAndClose("coach")} />
              <DrawerItem label="Analytics" onClick={()=>setActiveTabAndClose("deep")} />
              <DrawerItem label="Program Builder" onClick={()=>setActiveTabAndClose("program")} />
              <DrawerItem label="Historical Max Entry" onClick={()=>setActiveTabAndClose("preseason")} />
              <DrawerItem label="Create Team" onClick={()=>setActiveTabAndClose("createTeam")} />
              <DrawerItem label="Roster" onClick={()=>setActiveTabAndClose("roster")} />
              <DrawerItem label="Team Settings" onClick={()=>setActiveTabAndClose("settings")} />
              <DrawerItem label="Annual Planner" onClick={()=>setActiveTabAndClose("planner")} />
            </>
          )}

          <DrawerItem label="Account" onClick={()=>setActiveTabAndClose("account")} />

          {/* 🌙 DARK MODE TOGGLE (MOBILE) */}
          <DrawerItem
            label={theme === "dark" ? "☀ Light Mode" : "🌙 Dark Mode"}
            onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              setIsDrawerOpen(false);
            }}
          />

        </div>
      </div>
    )}

  </div>
);
}