import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  updateDoc,
  arrayUnion,
  serverTimestamp
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

import "./App.css";

export default function App() {

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isRegistering, setIsRegistering] = useState(false);
  const [roleChoice, setRoleChoice] = useState("athlete");
  const [inviteCode, setInviteCode] = useState("");

  /* ================= THEME ================= */

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

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

    const userRef = doc(db, "users", u.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Wait for profile creation
      setLoadingProfile(false);
      return;
    }

    const profileData = snap.data();
    setProfile({ uid: u.uid, ...profileData });

    await loadTeams(u.uid);

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
    setActiveTeam(null);
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
                  alert("Invite code required for athletes.");
                  return;
                }

                const cred = await createUserWithEmailAndPassword(
                  auth,
                  email,
                  password
                );

                const uid = cred.user.uid;

                let teamId = null;

                if (roleChoice === "athlete") {

                  const q = query(
                    collection(db, "teams"),
                    where("inviteCode", "==", inviteCode.trim().toUpperCase())
                  );

                  const snap = await getDocs(q);

                  if (snap.empty) {
                    await cred.user.delete();
                    alert("Invalid invite code.");
                    return;
                  }

                  teamId = snap.docs[0].id;
                }

                await setDoc(doc(db, "users", uid), {
                  displayName: email.split("@")[0],
                  role: roleChoice,
                  createdAt: serverTimestamp()
                });

                if (roleChoice === "athlete" && teamId) {

                  await setDoc(
                    doc(db, "users", uid, "teams", teamId),
                    {
                      role: "athlete",
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

                await signInWithEmailAndPassword(
                  auth,
                  email,
                  password
                );
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

  if (loadingProfile) {
    return <div className="loading">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="loading">Profile not found.</div>;
  }

  {/* ================= MAIN APP ================= */}

  return (
    <div className="app">

      <div className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Sidebar content stays exactly as you had it */}
        ...
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
            {activeTab === "leaderboard" && <Leaderboard profile={profile} team={activeTeam} />}
            {activeTab === "progress" && <AthleteProgress profile={profile} team={activeTeam} />}
            {activeTab === "deep" && profile.role === "coach" && <AthleteDeepDive profile={profile} team={activeTeam} />}
            {activeTab === "coach" && profile.role === "coach" && <CoachDashboard profile={profile} team={activeTeam} />}
            {activeTab === "program" && profile.role === "coach" && <ProgramBuilder team={activeTeam} />}
            {activeTab === "createTeam" && profile.role === "coach" && <CreateTeam profile={profile} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ================= MOBILE BOTTOM NAV ================= */}

      <div className="mobile-nav">

        <div
          className={`mobile-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <div>🏠</div>
          <small>Home</small>
        </div>

        <div
          className={`mobile-nav-item ${activeTab === "workouts" ? "active" : ""}`}
          onClick={() => setActiveTab("workouts")}
        >
          <div>💪</div>
          <small>Workouts</small>
        </div>

        <div
          className={`mobile-nav-item ${activeTab === "progress" ? "active" : ""}`}
          onClick={() => setActiveTab("progress")}
        >
          <div>📈</div>
          <small>Progress</small>
        </div>

        {profile.role === "coach" && (
          <div
            className={`mobile-nav-item ${activeTab === "coach" ? "active" : ""}`}
            onClick={() => setActiveTab("coach")}
          >
            <div>🧠</div>
            <small>Coach</small>
          </div>
        )}

      </div>

    </div>
  );
}