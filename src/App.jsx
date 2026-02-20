import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import {
  doc,
  getDoc
} from "firebase/firestore";
import { auth, db } from "./firebase";

import { motion, AnimatePresence } from "framer-motion";

import Dashboard from "./components/Dashboard";
import Workouts from "./components/Workouts";
import Leaderboard from "./components/Leaderboard";
import AthleteProgress from "./components/AthleteProgress";
import CoachDashboard from "./components/CoachDashboard";
import AthleteDeepDive from "./components/AthleteDeepDive";
import "./App.css";

export default function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* ================= THEME ================= */

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  /* ================= AUTH ================= */

  useEffect(() => {

    const unsub = onAuthStateChanged(auth, async (u) => {

      setUser(u);

      if (!u) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));

        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setProfile(null);
        }

      } catch (err) {
        console.error("Profile load error:", err);
        setProfile(null);
      }

      setLoadingProfile(false);

    });

    return () => unsub();

  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

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

        <button
          onClick={() =>
            signInWithEmailAndPassword(auth, email, password)
          }
        >
          Login
        </button>
      </div>
    );
  }

  if (loadingProfile) {
    return <div className="loading">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="loading">Profile not found.</div>;
  }

  /* ================= MAIN APP ================= */

  return (
    <div className="app">

      <div className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>

        <div className="sidebar-header">
          {!sidebarCollapsed && <h2>PTW</h2>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            ☰
          </button>
        </div>

        <SidebarItem
          icon="🏠"
          label="Dashboard"
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
          collapsed={sidebarCollapsed}
        />

        <SidebarItem
          icon="💪"
          label="Workouts"
          active={activeTab === "workouts"}
          onClick={() => setActiveTab("workouts")}
          collapsed={sidebarCollapsed}
        />

        <SidebarItem
          icon="🏆"
          label="Leaderboard"
          active={activeTab === "leaderboard"}
          onClick={() => setActiveTab("leaderboard")}
          collapsed={sidebarCollapsed}
        />

        <SidebarItem
          icon="📈"
          label="Progress"
          active={activeTab === "progress"}
          onClick={() => setActiveTab("progress")}
          collapsed={sidebarCollapsed}
        />

        {profile.role === "coach" && (
          <SidebarItem
            icon="🧠"
            label="Coach"
            active={activeTab === "coach"}
            onClick={() => setActiveTab("coach")}
            collapsed={sidebarCollapsed}
          />
        )}
{profile.role === "coach" && (
  <SidebarItem
    icon="🧬"
    label="Athlete Analytics"
    active={activeTab === "deep"}
    onClick={() => setActiveTab("deep")}
    collapsed={sidebarCollapsed}
  />
)}

        <SidebarItem
          icon={theme === "light" ? "🌙" : "☀️"}
          label="Toggle Theme"
          onClick={toggleTheme}
          collapsed={sidebarCollapsed}
        />

        <SidebarItem
          icon="🚪"
          label="Logout"
          onClick={logout}
          collapsed={sidebarCollapsed}
        />

      </div>

      <div className="content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "dashboard" && <Dashboard profile={profile} />}
            {activeTab === "workouts" && <Workouts profile={profile} />}
            {activeTab === "leaderboard" && <Leaderboard profile={profile} />}
            {activeTab === "progress" && <AthleteProgress profile={profile} />}
            {activeTab === "deep" && profile.role === "coach" && (
  <AthleteDeepDive profile={profile} />
)}
            {activeTab === "coach" && profile.role === "coach" && (
              <CoachDashboard profile={profile} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, collapsed }) {
  return (
    <div
      className={`sidebar-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="icon">{icon}</span>
      {!collapsed && <span className="label">{label}</span>}
    </div>
  );
}
