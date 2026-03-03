import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc
} from "firebase/firestore";
import { db } from "../firebase";
import HeroHeader from "./HeroHeader";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

export default function DailyProgress({ profile, team }) {

  const [roster, setRoster] = useState([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [workouts, setWorkouts] = useState([]);
  const [liveMaxes, setLiveMaxes] = useState({});

  const isCoach = profile?.role === "coach";

  /* ================= LOAD ROSTER ================= */
  useEffect(() => {
    if (!team?.id) return;

    const unsub = onSnapshot(
      collection(db, "athletes", team.id, "roster"),
      snap => {
        setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => unsub();
  }, [team?.id]);

  /* ================= AUTO SELECT SELF ================= */
  useEffect(() => {
    if (!profile || isCoach) return;

    const match = roster.find(r => r.linkedUid === profile.uid);
    if (match) setSelectedRosterId(match.id);

  }, [profile, roster, isCoach]);

  /* ================= LOAD WORKOUTS ================= */
  useEffect(() => {
    if (!selectedRosterId) return;

    const q = query(
      collection(db, "workouts"),
      where("athleteRosterId", "==", selectedRosterId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, snap => {
      setWorkouts(snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
    });

    return () => unsub();
  }, [selectedRosterId]);

  /* ================= LOAD LIVE MAXES ================= */
  useEffect(() => {
    if (!selectedRosterId) return;

    const unsub = onSnapshot(
      doc(db, "seasonMaxesCurrent", selectedRosterId),
      snap => {
        setLiveMaxes(snap.exists() ? snap.data() : {});
      }
    );

    return () => unsub();
  }, [selectedRosterId]);

  /* ================= CLEAN CHART DATA ================= */
  const chartData = useMemo(() => {

    const dataMap = {};

    workouts.forEach(w => {
      if (!w.createdAt?.seconds) return;

      const date = new Date(w.createdAt.seconds * 1000)
        .toLocaleDateString();

      if (!dataMap[date]) {
        dataMap[date] = {
          date,
          Bench: null,
          Squat: null,
          PowerClean: null,
          BenchResult: null,
          SquatResult: null,
          PowerCleanResult: null
        };
      }

      dataMap[date][w.exercise] = w.weight;
      dataMap[date][`${w.exercise}Result`] = w.result;
    });

    return Object.values(dataMap);

  }, [workouts]);

  const athleteName =
    roster.find(r => r.id === selectedRosterId)?.displayName || "Daily Progress";

  return (
    <div className="workout-wrapper">

      <HeroHeader
        title="Daily Progress"
        image={team?.pageImages?.progress}
      />

      <div className="hero-header">
        <h2>{athleteName}</h2>
      </div>

      {/* ================= LIVE MAX CARD ================= */}
      {selectedRosterId && (
        <div className="card workout-card" style={{ marginBottom: 20 }}>
          <h3>Current Maxes</h3>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            textAlign: "center"
          }}>
            <div>
              <strong>Bench</strong>
              <div>{liveMaxes?.benchMax || 0} lbs</div>
            </div>

            <div>
              <strong>Squat</strong>
              <div>{liveMaxes?.squatMax || 0} lbs</div>
            </div>

            <div>
              <strong>Power Clean</strong>
              <div>{liveMaxes?.powerCleanMax || 0} lbs</div>
            </div>
          </div>
        </div>
      )}

      {/* ================= GRAPH CARD ================= */}
      <div className="card workout-card">

        <h3>Workout Performance Trend</h3>

        {/* Coach Selector */}
        {isCoach && (
          <select
            value={selectedRosterId}
            onChange={e => setSelectedRosterId(e.target.value)}
            style={{ marginBottom: 20 }}
          >
            <option value="">Select Athlete</option>
            {roster.map(r => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </select>
        )}

        {!selectedRosterId ? (
          <div>Select an athlete to view data.</div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />

              {/* BENCH */}
              <Line
                type="monotone"
                dataKey="Bench"
                stroke="#2563eb"
                strokeWidth={3}
                connectNulls
                dot={({ cx, cy, payload }) => {
                  if (payload.Bench == null) return null;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={
                        payload.BenchResult === "Pass"
                          ? "#22c55e"
                          : "#ef4444"
                      }
                    />
                  );
                }}
              />

              {/* SQUAT */}
              <Line
                type="monotone"
                dataKey="Squat"
                stroke="#dc2626"
                strokeWidth={3}
                connectNulls
                dot={({ cx, cy, payload }) => {
                  if (payload.Squat == null) return null;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={
                        payload.SquatResult === "Pass"
                          ? "#22c55e"
                          : "#ef4444"
                      }
                    />
                  );
                }}
              />

              {/* POWER CLEAN */}
              <Line
                type="monotone"
                dataKey="PowerClean"
                stroke="#16a34a"
                strokeWidth={3}
                connectNulls
                dot={({ cx, cy, payload }) => {
                  if (payload.PowerClean == null) return null;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={
                        payload.PowerCleanResult === "Pass"
                          ? "#22c55e"
                          : "#ef4444"
                      }
                    />
                  );
                }}
              />

            </LineChart>
          </ResponsiveContainer>
        )}

      </div>
    </div>
  );
}