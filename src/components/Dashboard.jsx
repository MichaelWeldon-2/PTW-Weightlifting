import { useMemo, useEffect, useState } from "react";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import AnimatedStat from "./AnimatedStat";

function Dashboard({ profile, team }) {

  /* ================= STATE ================= */

  const [workouts, setWorkouts] = useState([]);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [competitionCountdown, setCompetitionCountdown] = useState(null);
  const [successFlash, setSuccessFlash] = useState(false);

  const isCoach = profile?.role === "coach";

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

    if (!workouts.length)
      return { topPerformer: null, mostImproved: null, totalVolume: 0 };

    const grouped = {};
    let totalVolume = 0;

    workouts.forEach(w => {

      if (!w?.athleteName) return;

      if (!grouped[w.athleteName])
        grouped[w.athleteName] = [];

      const weight = Number(w.weight) || 0;
      grouped[w.athleteName].push(weight);
      totalVolume += weight;
    });

    const leaders = [];
    const improvements = [];

    Object.entries(grouped).forEach(([name, weights]) => {

      if (!weights.length) return;

      const max = Math.max(...weights);
      const min = Math.min(...weights);

      leaders.push({ name, max });
      improvements.push({ name, improvement: max - min });
    });

    leaders.sort((a,b)=>b.max-a.max);
    improvements.sort((a,b)=>b.improvement-a.improvement);

    return {
      topPerformer: leaders[0] || null,
      mostImproved: improvements[0] || null,
      totalVolume
    };

  }, [workouts]);

  /* ================= LOAD PROGRAM ================= */

  useEffect(() => {

    if (!team?.id) return;

    const loadProgram = async () => {

      const snap = await getDoc(doc(db, "teamPrograms", team.id));
      if (!snap.exists()) return;

      const program = snap.data();

      if (program?.competitionDate) {
        const diff = Math.ceil(
          (new Date(program.competitionDate) - new Date()) /
          (1000 * 60 * 60 * 24)
        );
        setCompetitionCountdown(diff > 0 ? diff : 0);
      }

      const currentWeek = team?.currentWeek;

      program.blocks?.forEach(block => {
        if (
          currentWeek >= block.startWeek &&
          currentWeek <= block.endWeek
        ) {
          setCurrentBlock(block);
        }
      });
    };

    loadProgram();

  }, [team?.id, team?.currentWeek]);

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
    <div>

      <div className="hero-header">
        <div className="hero-overlay">
          <h1>{team?.name || "Team Dashboard"}</h1>
          <p>
            {team?.currentSeason || ""} • {currentBlock?.name || ""} • Week {team?.currentWeek || 0}
          </p>
        </div>
      </div>

      {competitionCountdown !== null && (
        <div className="competition-banner">
          Competition in <AnimatedStat value={competitionCountdown} /> days
        </div>
      )}

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