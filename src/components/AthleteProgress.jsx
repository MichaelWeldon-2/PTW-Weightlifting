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

  const [roster, setRoster] = useState([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [liveMaxes, setLiveMaxes] = useState(null);
  const [historicalMaxes, setHistoricalMaxes] = useState([]);

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */

  useEffect(() => {
    if (!team?.id) return;

    const rosterRef = collection(db, "athletes", team.id, "roster");

    const unsub = onSnapshot(rosterRef, snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setRoster(list);
    });

    return () => unsub();
  }, [team?.id]);

  /* ================= AUTO SELECT SELF ================= */

  useEffect(() => {
    if (!profile || isCoach) return;

    const match = roster.find(r => r.linkedUid === profile.uid);
    if (match) setSelectedRosterId(match.id);
  }, [profile, roster, isCoach]);

  /* ================= LOAD LIVE MAXES ================= */

  useEffect(() => {
    if (!selectedRosterId) return;

    const loadLive = async () => {
      const snap = await getDoc(
        doc(db, "seasonMaxesCurrent", selectedRosterId)
      );
      setLiveMaxes(snap.exists() ? snap.data() : null);
    };

    loadLive();
  }, [selectedRosterId]);

  /* ================= LOAD HISTORICAL SNAPSHOTS ================= */

  useEffect(() => {
    if (!team?.id || !selectedRosterId) return;

    const loadHistory = async () => {
      const ref = collection(db, "seasonMaxes", team.id, "athletes");

      const q = query(
        ref,
        where("athleteRosterId", "==", selectedRosterId)
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
  }, [team?.id, selectedRosterId]);

  /* ================= CURRENT TOTAL ================= */

  const currentTotal = useMemo(() => {
    if (!liveMaxes) return 0;
    return (
      (liveMaxes.benchMax || 0) +
      (liveMaxes.squatMax || 0) +
      (liveMaxes.powerCleanMax || 0)
    );
  }, [liveMaxes]);

  /* ================= SORT HISTORY ================= */

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

  /* ================= BIGGEST GAIN ================= */

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

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "";

  /* ================= UI ================= */

  return (
    <div className="card">

      <h2>📈 Athlete Performance Center</h2>

      {isCoach && (
        <select
          value={selectedRosterId}
          onChange={e => setSelectedRosterId(e.target.value)}
        >
          <option value="">Select Athlete</option>
          {roster.map(r => (
            <option key={r.id} value={r.id}>
              {r.displayName}
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

      {/* CHART */}
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

/* ================= METRIC ================= */

function Metric({ label, value }) {
  return (
    <div className="card metric-card">
      <h4>{label}</h4>
      <div className="metric-value">{value}</div>
    </div>
  );
}