import { useEffect, useState, useMemo } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  documentId
} from "firebase/firestore";
import { db } from "../firebase";

export default function AthleteDeepDive({ team }) {

  const [athletes, setAthletes] = useState([]);
  const [selected, setSelected] = useState("");
  const [workouts, setWorkouts] = useState([]);

  /* ================= LOAD TEAM ATHLETES (OPTIMIZED) ================= */

  useEffect(() => {

    if (!team?.id || !team?.members?.length) {
      setAthletes([]);
      return;
    }

    const loadAthletes = async () => {

      try {

        const memberIds = team.members;

        // Firestore "in" query limit = 10
        const chunks = [];
        for (let i = 0; i < memberIds.length; i += 10) {
          chunks.push(memberIds.slice(i, i + 10));
        }

        const results = [];

        for (let chunk of chunks) {
          const q = query(
            collection(db, "users"),
            where(documentId(), "in", chunk)
          );

          const unsub = onSnapshot(q, snap => {
            snap.docs.forEach(docSnap => {
              const data = docSnap.data();
              if (data.role === "athlete") {
                results.push({
                  id: docSnap.id,
                  ...data
                });
              }
            });

            setAthletes([...results]);
          });

          return () => unsub();
        }

      } catch (err) {
        console.error("Athlete load error:", err);
      }
    };

    loadAthletes();

  }, [team]);

  /* ================= LOAD WORKOUTS ================= */

  useEffect(() => {

    if (!selected || !team?.id) {
      setWorkouts([]);
      return;
    }

    const q = query(
      collection(db, "workouts"),
      where("teamId", "==", team.id),
      where("athleteId", "==", selected)
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

  }, [selected, team]);

  /* ================= ANALYTICS ENGINE (UNCHANGED) ================= */

  const analytics = useMemo(() => {

    if (!workouts.length) {
      return {
        passRate: 0,
        totalVolume: 0,
        riskLevel: "Stable",
        fatigue: false,
        plateaus: [],
        insights: [],
        recommendations: [],
        recommendedLoads: {},
        performanceScore: 0,
        grade: "C",
        momentum: 0
      };
    }

    const sorted = [...workouts]
      .filter(w => w.createdAt?.seconds)
      .sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);

    let totalPass = 0;
    let totalAttempts = 0;
    let totalVolume = 0;

    const liftMap = {};

    sorted.forEach(w => {

      const weight = Number(w.weight) || 0;

      totalAttempts++;
      totalVolume += weight;
      if (w.result === "Pass") totalPass++;

      if (!liftMap[w.exercise]) {
        liftMap[w.exercise] = [];
      }

      liftMap[w.exercise].push(weight);
    });

    const passRate =
      totalAttempts > 0
        ? Math.round((totalPass / totalAttempts) * 100)
        : 0;

    const failRate =
      totalAttempts > 0
        ? (totalAttempts - totalPass) / totalAttempts
        : 0;

    const plateaus = [];

    Object.entries(liftMap).forEach(([exercise, weights]) => {
      if (weights.length >= 6) {
        const last6 = weights.slice(-6);
        const max = Math.max(...last6);
        const min = Math.min(...last6);

        if (max - min <= 5) {
          plateaus.push(exercise);
        }
      }
    });

    let fatigue = false;

    if (sorted.length >= 10) {

      const volumes = sorted.map(w => Number(w.weight) || 0);

      const last5 = volumes.slice(-5).reduce((s,v)=>s+v,0);
      const prev5 = volumes.slice(-10,-5).reduce((s,v)=>s+v,0);

      if (prev5 > 0 && last5 > prev5 * 1.3) {
        fatigue = true;
      }
    }

    let riskScore = 0;

    if (failRate >= 0.5) riskScore += 2;
    else if (failRate >= 0.3) riskScore += 1;

    if (fatigue) riskScore += 1;
    if (plateaus.length > 0) riskScore += 1;

    let riskLevel = "Stable";
    if (riskScore >= 3) riskLevel = "Critical";
    else if (riskScore === 2) riskLevel = "Warning";

    const insights = [];

    if (plateaus.length)
      insights.push(`Plateau detected in: ${plateaus.join(", ")}`);

    if (fatigue)
      insights.push("Volume spike detected — monitor fatigue");

    if (failRate >= 0.5)
      insights.push("High fail rate — reduce load");

    if (passRate >= 80)
      insights.push("Strong performance — increase intensity");

    const recommendations = [];

    if (riskLevel === "Critical")
      recommendations.push("Deload 10% next session");

    if (riskLevel === "Warning")
      recommendations.push("Reduce load by 5% next session");

    if (plateaus.length > 0)
      recommendations.push("Change stimulus (tempo, pause, or volume)");

    if (fatigue)
      recommendations.push("Insert recovery / light day");

    if (passRate >= 85 && !fatigue && plateaus.length === 0)
      recommendations.push("Increase load 2.5–5% next week");

    const recommendedLoads = {};

    Object.entries(liftMap).forEach(([exercise, weights]) => {

      if (!weights.length) return;

      const lastWeight = weights[weights.length - 1];
      let nextWeight = lastWeight;

      if (riskLevel === "Critical") {
        nextWeight = Math.round(lastWeight * 0.9 / 5) * 5;
      }
      else if (riskLevel === "Warning") {
        nextWeight = Math.round(lastWeight * 0.95 / 5) * 5;
      }
      else if (passRate >= 85 && !fatigue && !plateaus.includes(exercise)) {
        nextWeight = Math.round(lastWeight * 1.03 / 5) * 5;
      }

      recommendedLoads[exercise] = nextWeight;
    });

    let performanceScore = 100;

    performanceScore -= failRate * 40;
    if (fatigue) performanceScore -= 10;
    if (plateaus.length > 0) performanceScore -= 10;
    if (passRate >= 85) performanceScore += 5;

    performanceScore = Math.max(0, Math.min(100, Math.round(performanceScore)));

    let momentum = 0;

    Object.values(liftMap).forEach(weights => {
      if (weights.length >= 2) {
        const last = weights[weights.length - 1];
        const prev = weights[weights.length - 2];
        momentum += (last - prev);
      }
    });

    momentum = Math.round(momentum);

    let grade = "C";

    if (performanceScore >= 90) grade = "A+";
    else if (performanceScore >= 85) grade = "A";
    else if (performanceScore >= 75) grade = "B";
    else if (performanceScore >= 65) grade = "C";
    else if (performanceScore >= 50) grade = "D";
    else grade = "F";

    return {
      passRate,
      totalVolume,
      riskLevel,
      fatigue,
      plateaus,
      insights,
      recommendations,
      recommendedLoads,
      performanceScore,
      grade,
      momentum
    };

  }, [workouts]);

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📊 Athlete Deep Analytics</h2>

      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
      >
        <option value="">Select Athlete</option>
        {athletes.map(a => (
          <option key={a.id} value={a.id}>
            {a.displayName}
          </option>
        ))}
      </select>

      {!selected && <p>Select an athlete to view analytics</p>}

      {selected && (
        <>
          <div className="dashboard-grid">
            <Metric label="Pass Rate" value={`${analytics.passRate}%`} />
            <Metric label="Total Volume" value={`${analytics.totalVolume.toLocaleString()} lbs`} />
            <Metric label="Risk Level" value={analytics.riskLevel} />
          </div>

          <hr />

          <h3>🎯 Performance Grade</h3>
          <div className={`recommendation-box grade-${analytics.grade.replace("+","plus").toLowerCase()}`}>
            Grade: {analytics.grade}
            <br />
            Score: {analytics.performanceScore}/100
            <br />
            Momentum: {analytics.momentum >= 0 ? "+" : ""}{analytics.momentum}
          </div>

          <hr />

          <h3>📈 Programming Recommendation</h3>
          {analytics.recommendations.map((r, i) => (
            <div key={i} className="recommendation-box">
              {r}
            </div>
          ))}

          <hr />

          <h3>🏋️ Next Session Load Targets</h3>
          {Object.entries(analytics.recommendedLoads).map(([lift, weight]) => (
            <div key={lift} className="recommendation-box">
              {lift}: {weight} lbs
            </div>
          ))}

          <hr />

          <h3>🔍 Smart Insights</h3>
          {analytics.insights.map((i, index) => (
            <div key={index} className="insight-card">
              {i}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="card metric-card">
      <h4>{label}</h4>
      <div className="metric-value">{value}</div>
    </div>
  );
}