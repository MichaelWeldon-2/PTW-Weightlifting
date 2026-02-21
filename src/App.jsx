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
import Account from "./components/Account";

import "./App.css";

export default function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isRegistering, setIsRegistering] = useState(false);
  const [roleChoice, setRoleChoice] = useState("athlete");
  const [inviteCode, setInviteCode] = useState("");

  /* ================= LOAD USER TEAMS ================= */

  const loadTeams = async (uid) => {

    const teamsSnap = await getDocs(
      collection(db, "users", uid, "teams")
    );

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

        setProfile({ uid: u.uid, ...snap.data() });
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

        <h2>PTW Weightlifting</h2>

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
            <div style={{ marginTop: 10 }}>
              <label>
                <input
                  type="radio"
                  value="coach"
                  checked={roleChoice === "coach"}
                  onChange={() => setRoleChoice("coach")}
                />
                Coach
              </label>

              <label style={{ marginLeft: 15 }}>
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
                style={{ marginTop: 10 }}
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

                if (roleChoice === "athlete" && !inviteCode.trim()) {
                  alert("Invite code required.");
                  return;
                }

                const cred = await createUserWithEmailAndPassword(
                  auth,
                  email,
                  password
                );

                const uid = cred.user.uid;

                await setDoc(doc(db, "users", uid), {
                  displayName: email.split("@")[0],
                  role: roleChoice,
                  createdAt: serverTimestamp()
                });

                if (roleChoice === "athlete") {

                  const q = query(
                    collection(db, "teams"),
                    where("inviteCode", "==", inviteCode.trim().toUpperCase())
                  );

                  const snap = await getDocs(q);

                  if (snap.empty) {
                    alert("Invalid invite code.");
                    return;
                  }

                  const teamId = snap.docs[0].id;

                  await setDoc(
                    doc(db, "users", uid, "teams", teamId),
                    {
                      role: "athlete",
                      joinedAt: serverTimestamp()
                    }
                  );

                  await updateDoc(doc(db, "teams", teamId), {
                    members: arrayUnion(uid)
                  });
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
          {isRegistering ? "Create Account" : "Login"}
        </button>

        <p
          style={{ marginTop: 15, cursor: "pointer", opacity: 0.7 }}
          onClick={() => setIsRegistering(prev => !prev)}
        >
          {isRegistering
            ? "Already have an account? Login"
            : "Don't have an account? Create one"}
        </p>

      </div>
    );
  }

  if (loadingProfile) return <div className="loading">Loading profile...</div>;
  if (!profile) return <div className="loading">Profile not found.</div>;

  /* ================= MAIN APP ================= */

  return (
    <div className="app">

      {/* SIDEBAR (Desktop) */}
      <div className="sidebar">

        <h3 style={{ marginBottom: 20 }}>PTW</h3>

        <SidebarItem label="Dashboard" onClick={() => setActiveTab("dashboard")} />
        <SidebarItem label="Workouts" onClick={() => setActiveTab("workouts")} />
        <SidebarItem label="Progress" onClick={() => setActiveTab("progress")} />
        <SidebarItem label="Leaderboard" onClick={() => setActiveTab("leaderboard")} />

        {profile.role === "coach" && (
          <>
            <SidebarItem label="Coach" onClick={() => setActiveTab("coach")} />
            <SidebarItem label="Athlete Analytics" onClick={() => setActiveTab("deep")} />
            <SidebarItem label="Program Builder" onClick={() => setActiveTab("program")} />
            <SidebarItem label="Create Team" onClick={() => setActiveTab("createTeam")} />
          </>
        )}

        <SidebarItem label="Account" onClick={() => setActiveTab("account")} />

      </div>

      {/* CONTENT */}
      <div className="content">

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + activeTeam?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >

            {activeTab === "dashboard" &&
              <Dashboard profile={profile} team={activeTeam} />}

            {activeTab === "workouts" &&
              <Workouts profile={profile} team={activeTeam} />}

            {activeTab === "progress" &&
              <AthleteProgress profile={profile} team={activeTeam} />}

            {activeTab === "leaderboard" &&
              <Leaderboard profile={profile} team={activeTeam} />}

            {activeTab === "deep" && profile.role === "coach" &&
              <AthleteDeepDive team={activeTeam} />}

            {activeTab === "coach" && profile.role === "coach" &&
              <CoachDashboard team={activeTeam} />}

            {activeTab === "program" && profile.role === "coach" &&
              <ProgramBuilder team={activeTeam} />}

            {activeTab === "createTeam" && profile.role === "coach" &&
              <CreateTeam profile={profile} />}

            {activeTab === "account" &&
              <Account profile={profile} />}

          </motion.div>
        </AnimatePresence>

      </div>

      {/* MOBILE NAV */}
     <div className="bottom-nav">

  <NavItem
    icon="🏠"
    label="Home"
    active={activeTab === "dashboard"}
    onClick={() => setActiveTab("dashboard")}
  />

  <NavItem
    icon="💪"
    label="Workouts"
    active={activeTab === "workouts"}
    onClick={() => setActiveTab("workouts")}
  />

  <NavItem
    icon="📈"
    label="Progress"
    active={activeTab === "progress"}
    onClick={() => setActiveTab("progress")}
  />

  {profile.role === "coach" && (
    <NavItem
      icon="🧠"
      label="Analytics"
      active={activeTab === "deep"}
      onClick={() => setActiveTab("deep")}
    />
  )}

  <NavItem
    icon="👤"
    label="Account"
    active={activeTab === "account"}
    onClick={() => setActiveTab("account")}
  />

      </div>

    </div>
    
  );
}

/* ================= SIDEBAR ITEM ================= */

function SidebarItem({ label, onClick }) {
  return (
    <div className="sidebar-item" onClick={onClick}>
      {label}
    </div>
  );
}

/* ================= BOTTOM NAV ITEM ================= */

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