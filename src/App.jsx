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
  const [displayName, setDisplayName] = useState("");

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
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Full Name"
            />

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

      if (!displayName.trim()) {
        alert("Please enter your full name.");
        return;
      }

      let teamId = null;

      if (roleChoice === "athlete") {

        if (!inviteCode.trim()) {
          alert("Invite code required.");
          return;
        }

        const q = query(
          collection(db, "teams"),
          where("inviteCode", "==", inviteCode.trim().toUpperCase())
        );

        const snap = await getDocs(q);

        if (snap.empty) {
          alert("Invalid invite code.");
          return;
        }

        teamId = snap.docs[0].id;
      }

      // 1️⃣ Create Auth account
      await createUserWithEmailAndPassword(auth, email, password);

      // 2️⃣ Wait for auth state to be ready
      const currentUser = auth.currentUser;

      if (!currentUser) {
        alert("Authentication failed. Try again.");
        return;
      }

      const uid = currentUser.uid;

      // 3️⃣ Create user profile in Firestore
      await setDoc(doc(db, "users", uid), {
        displayName: displayName.trim(),
        role: roleChoice,
        teamId: teamId || null,
        createdAt: serverTimestamp()
      });

      // 4️⃣ If athlete → join team
      if (roleChoice === "athlete" && teamId) {

        await setDoc(
          doc(db, "users", uid, "teams", teamId),
          {
            role: "athlete",
            joinedAt: serverTimestamp()
          }
        );

        await setDoc(
          doc(db, "teams", teamId),
          {
          members: arrayUnion(uid)
        },
        {merge: true}
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

        <button onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? "Already have an account? Sign In" : "Need an account? Register"}
        </button>
      </div>
    );
  }

  /* ================= MAIN APP ================= */

  return (
    <div className="app">

      <div className="sidebar">
        <h3 style={{ marginBottom: 20 }}>PTW</h3>

        <SidebarItem label="Dashboard" active={activeTab==="dashboard"} onClick={()=>setActiveTab("dashboard")} />
        <SidebarItem label="Workouts" active={activeTab==="workouts"} onClick={()=>setActiveTab("workouts")} />
        <SidebarItem label="Progress" active={activeTab==="progress"} onClick={()=>setActiveTab("progress")} />
        <SidebarItem label="Leaderboard" active={activeTab==="leaderboard"} onClick={()=>setActiveTab("leaderboard")} />

        {profile?.role === "coach" && (
          <>
            <SidebarItem label="Coach" active={activeTab==="coach"} onClick={()=>setActiveTab("coach")} />
            <SidebarItem label="Analytics" active={activeTab==="deep"} onClick={()=>setActiveTab("deep")} />
            <SidebarItem label="Program Builder" active={activeTab==="program"} onClick={()=>setActiveTab("program")} />
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
            {activeTab === "deep" && profile?.role==="coach" && <AthleteDeepDive team={activeTeam} />}
            {activeTab === "coach" && profile?.role==="coach" && <CoachDashboard team={activeTeam} />}
            {activeTab === "program" && profile?.role==="coach" && <ProgramBuilder team={activeTeam} />}
            {activeTab === "createTeam" && profile?.role==="coach" && <CreateTeam profile={profile} />}
            {activeTab === "account" && <Account profile={profile} />}

          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

function SidebarItem({ label, active, onClick }) {
  return (
    <div className={`sidebar-item ${active ? "active" : ""}`} onClick={onClick}>
      {label}
    </div>
  );
}