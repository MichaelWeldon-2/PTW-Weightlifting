import { useMemo, useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import AnimatedStat from "./AnimatedStat";
import { calculateTeamAnalytics } from "../utils/teamAnalytics";

function Dashboard({ profile, team }) {

  /* ================= STATE ================= */

  const [workouts, setWorkouts] = useState([]);
  const [roster, setRoster] = useState([]);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [competitionCountdown, setCompetitionCountdown] = useState(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [dashboardNotes, setDashboardNotes] = useState([]);

  const isCoach = profile?.role === "coach";

  /* ================= HERO IMAGE SUPPORT ================= */

  // Uses team.headerImage if it exists
  const heroStyle = team?.headerImage
    ? { backgroundImage: `url(${team.headerImage})` }
    : {};

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) {
      setRoster([]);
      return;
    }

    const rosterRef = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(rosterRef, snap => {
      setRoster(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= LOAD TEAM WORKOUTS ================= */

  useEffect(() => {
    if (!team?.id) {
      setWorkouts([]);
      return;
    }

    const q = query(
      collection(db, "workouts"),
      where("teamId", "==", team.id)
    );

    const unsub = onSnapshot(q, snap => {
      setWorkouts(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= LOAD DASHBOARD NOTES ================= */

  useEffect(() => {
    if (!team?.id) return;

    const q = query(
      collection(db, "notes"),
      where("teamId", "==", team.id),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(q, snap => {

      let notes = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      if (!isCoach) {
        notes = notes.filter(n =>
          n.visibility === "team" ||
          n.athleteRosterId === profile.athleteId
        );
      } else {
        notes = notes.filter(n => n.visibility === "team");
      }

      setDashboardNotes(notes.slice(0, 8));
    });

    return () => unsub();

  }, [team?.id, profile, isCoach]);

  /* ================= CURRENT PHASE ================= */

  useEffect(() => {
    if (!team?.id) return;

    const phaseRef = doc(db, "annualPlans", team.id);

    getDoc(phaseRef).then(snap => {

      if (!snap.exists()) {
        setCurrentPhase(null);
        return;
      }

      const data = snap.data();
      const today = new Date();

      const phase = data.phases?.find(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return today >= start && today <= end;
      });

      if (!phase) {
        setCurrentPhase(null);
        return;
      }

      const start = new Date(phase.startDate);
      const diffDays = Math.floor(
        (today - start) / (1000 * 60 * 60 * 24)
      );

      const week = Math.floor(diffDays / 7) + 1;

      const totalWeeks =
        phase.totalWeeks ||
        Math.ceil(
          (new Date(phase.endDate) - start) /
          (1000 * 60 * 60 * 24 * 7)
        );

      setCurrentPhase({
        name: phase.name,
        week,
        totalWeeks
      });

    });

  }, [team?.id]);

  /* ================= TEAM FATIGUE ================= */

  const teamFatigue = useMemo(() => {

    if (!workouts.length)
      return { status: "Stable", failRate: 0 };

    const recent = workouts.slice(-20);
    const fails = recent.filter(w => w.result === "Fail").length;
    const failRate = recent.length ? fails / recent.length : 0;

    if (failRate >= 0.5) return { status: "Critical", failRate };
    if (failRate >= 0.3) return { status: "Warning", failRate };

    return { status: "Stable", failRate };

  }, [workouts]);

  /* ================= ANALYTICS ================= */

  const analytics = useMemo(() => {
    return calculateTeamAnalytics(workouts, roster, 30);
  }, [workouts, roster]);

  /* ================= ADVANCE WEEK ================= */

  const advanceWeek = async () => {

    if (!team?.id) return;

    let nextType = "Normal";

    if (teamFatigue.status === "Critical")
      nextType = "Deload";

    if (competitionCountdown !== null && competitionCountdown <= 7)
      nextType = "Taper";

    await setDoc(
      doc(db, "teams", team.id),
      {
        currentWeek: (team.currentWeek || 0) + 1,
        trainingDayType: nextType
      },
      { merge: true }
    );

    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 800);
  };

  const fatigueClass =
    teamFatigue.status === "Critical"
      ? "status-critical"
      : teamFatigue.status === "Warning"
      ? "status-warning"
      : "status-stable";

  if (!profile) {
    return <div className="loading">Loading dashboard...</div>;
  }

  /* ================= RENDER ================= */

  return (
    <div className="dashboard-wrapper">

      {/* ================= HERO HEADER (IMAGE ENABLED) ================= */}
      <div className="hero-header" style={heroStyle}>
        <div className="hero-overlay">
          <h1>{team?.name || "Team Dashboard"}</h1>
          <p>
            {currentPhase
              ? `${currentPhase.name} • Week ${currentPhase.week}/${currentPhase.totalWeeks}`
              : ""}
          </p>
        </div>
      </div>

      <div className="dashboard-grid">

        <AnimatedCard>
          <h3>Top Performer</h3>
          <div className="metric-value">
            {analytics.topPerformer?.name || "N/A"}
          </div>
        </AnimatedCard>

        <AnimatedCard>
          <h3>Most Improved</h3>
          <div className="metric-value">
            {analytics.mostImproved?.name || "N/A"}
          </div>
        </AnimatedCard>

        <AnimatedCard>
          <h3>Total Volume</h3>
          <div className="metric-value">
            <AnimatedStat value={analytics.totalVolume} /> lbs
          </div>
        </AnimatedCard>

        <AnimatedCard>
          <h3>Team Fatigue</h3>
          <span className={`status-chip ${fatigueClass}`}>
            {teamFatigue.status}
          </span>
          <div style={{ marginTop: 8 }}>
            <AnimatedStat value={Math.round(teamFatigue.failRate * 100)} />%
          </div>
        </AnimatedCard>

      </div>

      {/* ================= NOTES FEED ================= */}

      <div className="card" style={{ marginTop: 30 }}>
        <h3>📢 Team Updates</h3>

        {dashboardNotes.length === 0 && (
          <div style={{ opacity: 0.6 }}>No updates yet.</div>
        )}

        {dashboardNotes.map(note => {

          const date = note.createdAt?.seconds
            ? new Date(note.createdAt.seconds * 1000)
            : null;

          const isTeam = note.visibility === "team";

          return (
            <div
              key={note.id}
              style={{
                marginBottom: 15,
                paddingBottom: 10,
                borderBottom: "1px solid var(--border)"
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {isTeam ? "📢 Team" : "👤 Personal"} —
                {note.createdByName} —
                {date?.toLocaleDateString()}
              </div>

              <div style={{ marginTop: 6 }}>
                {note.text}
              </div>
            </div>
          );
        })}
      </div>

      {isCoach && (
        <motion.div
          className={`card ${successFlash ? "success-flash" : ""}`}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3>Season Controls</h3>
          <button onClick={advanceWeek}>
            Advance Week
          </button>
        </motion.div>
      )}

    </div>
  );
}

function AnimatedCard({ children }) {
  return (
    <motion.div
      className="card metric-card"
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

export default Dashboard;