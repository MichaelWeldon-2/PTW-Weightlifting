import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Dot
} from "recharts";

const seasonOrder = {
  Summer: 1,
  Fall: 2,
  Winter: 3,
  Spring: 4
};

export default function AthleteProgress({ profile, team }) {

  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("");
  const [liveMaxes, setLiveMaxes] = useState(null);
  const [historicalMaxes, setHistoricalMaxes] = useState([]);

  /* ================= LOAD TEAM ATHLETES ================= */

  useEffect(() => {
    if (!team?.members?.length) return;

    const q = query(
      collection(db, "users"),
      where("__name__", "in", team.members.slice(0, 10))
    );

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === "athlete");

      setAthletes(list);
    });

    return () => unsub();
  }, [team?.members]);

  /* ================= AUTO SELECT SELF ================= */

  useEffect(() => {
    if (profile?.role === "athlete") {
      setSelectedAthlete(profile.uid);
    }
  }, [profile]);

  /* ================= LOAD LIVE MAXES ================= */

  useEffect(() => {
    if (!selectedAthlete) return;

    const loadLive = async () => {
      const snap = await getDoc(
        doc(db, "seasonMaxesCurrent", selectedAthlete)
      );

      setLiveMaxes(snap.exists() ? snap.data() : null);
    };

    loadLive();
  }, [selectedAthlete]);

  /* ================= LOAD HISTORICAL SNAPSHOTS ================= */

  useEffect(() => {
    if (!team?.id || !selectedAthlete) return;

    const loadHistory = async () => {
      const ref = collection(db, "seasonMaxes", team.id, "athletes");

      const q = query(
        ref,
        where("athleteId", "==", selectedAthlete)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setHistoricalMaxes([]);
        return;
      }

      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setHistoricalMaxes(data);
    };

    loadHistory();
  }, [team?.id, selectedAthlete]);

  /* ================= CURRENT TOTAL ================= */

  const currentTotal = useMemo(() => {
    if (!liveMaxes) return 0;
    return (
      (liveMaxes.benchMax || 0) +
      (liveMaxes.squatMax || 0) +
      (liveMaxes.powerCleanMax || 0)
    );
  }, [liveMaxes]);

  /* ================= SORTED HISTORY ================= */

  const sortedHistory = useMemo(() => {
    if (!historicalMaxes.length) return [];

    return [...historicalMaxes].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return seasonOrder[a.season] - seasonOrder[b.season];
    });
  }, [historicalMaxes]);

  /* ================= % CHANGE ================= */

  const percentChange = useMemo(() => {
    if (sortedHistory.length < 1) return null;

    const lastSeason = sortedHistory[sortedHistory.length - 1];
    const previousTotal = lastSeason.total || 0;

    if (!previousTotal) return null;

    return Math.round(
      ((currentTotal - previousTotal) / previousTotal) * 100
    );
  }, [sortedHistory, currentTotal]);

  /* ================= BIGGEST OFFSEASON GAIN ================= */

  const biggestGain = useMemo(() => {
    if (sortedHistory.length < 2) return null;

    let maxGain = 0;
    let bestPeriod = null;

    for (let i = 1; i < sortedHistory.length; i++) {
      const gain =
        (sortedHistory[i].total || 0) -
        (sortedHistory[i - 1].total || 0);

      if (gain > maxGain) {
        maxGain = gain;
        bestPeriod = `${sortedHistory[i - 1].season} ${sortedHistory[i - 1].year}
          → ${sortedHistory[i].season} ${sortedHistory[i].year}`;
      }
    }

    return maxGain > 0 ? { maxGain, bestPeriod } : null;
  }, [sortedHistory]);

  /* ================= PR DETECTION ================= */

  const historyWithPR = useMemo(() => {
    let maxSoFar = 0;

    return sortedHistory.map(d => {
      if ((d.total || 0) > maxSoFar) {
        maxSoFar = d.total;
        return { ...d, isPR: true };
      }
      return { ...d, isPR: false };
    });
  }, [sortedHistory]);

  const chartData = useMemo(() => {
    return historyWithPR.map(d => ({
      label: `${d.season} ${d.year}`,
      total: d.total || 0,
      isPR: d.isPR
    }));
  }, [historyWithPR]);

  const careerBest =
    historyWithPR.length > 0
      ? historyWithPR.reduce((max, curr) =>
          curr.total > max.total ? curr : max
        )
      : null;

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📈 Athlete Performance Center</h2>

      {profile?.role === "coach" && (
        <select
          value={selectedAthlete}
          onChange={e => setSelectedAthlete(e.target.value)}
        >
          <option value="">Select Athlete</option>
          {athletes.map(a => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      )}

      <hr />

      {/* LIVE MAXES */}
      {liveMaxes && (
        <div className="dashboard-grid">
          <Metric label="Bench" value={`${liveMaxes.benchMax || 0} lbs`} />
          <Metric label="Squat" value={`${liveMaxes.squatMax || 0} lbs`} />
          <Metric label="Power Clean" value={`${liveMaxes.powerCleanMax || 0} lbs`} />
          <Metric label="TOTAL" value={`${currentTotal} lbs`} />
        </div>
      )}

      {/* % CHANGE */}
      {percentChange !== null && (
        <div style={{ marginTop: 20 }}>
          <strong>
            {percentChange > 0 && "🔥 "}
            {percentChange < 0 && "⚠️ "}
            {percentChange === 0 && "➖ "}
            {percentChange}% Change From Last Season
          </strong>
        </div>
      )}

      {/* BIGGEST GAIN */}
      {biggestGain && (
        <div style={{ marginTop: 10 }}>
          🏆 Biggest Offseason Gain: +{biggestGain.maxGain} lbs  
          <div style={{ fontSize: 12 }}>
            {biggestGain.bestPeriod}
          </div>
        </div>
      )}

      <hr />

      {/* HISTORICAL CHART */}
      {chartData.length === 0 && (
        <div>No historical season data yet.</div>
      )}

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#0e28b1"
              strokeWidth={3}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.isPR) {
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill="gold"
                      stroke="black"
                      strokeWidth={2}
                    />
                  );
                }
                return <Dot {...props} />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {careerBest && (
        <div style={{ marginTop: 15 }}>
          👑 Career Best Season: {careerBest.season} {careerBest.year}  
          ({careerBest.total} lbs)
        </div>
      )}

    </div>
  );
}

/* ================= METRIC CARD ================= */

function Metric({ label, value }) {
  return (
    <div className="card metric-card">
      <h4>{label}</h4>
      <div className="metric-value">{value}</div>
    </div>
  );
}