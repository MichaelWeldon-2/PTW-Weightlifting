import { useMemo } from "react";

function Dashboard({ profile, workouts = [] }) {

  /* SAFETY GUARD */
  if (!profile) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const isCoach = profile.role === "coach";

  /* ANALYTICS */
  const analytics = useMemo(() => {

    if (!Array.isArray(workouts) || workouts.length === 0) {
      return {
        topPerformer: null,
        mostImproved: null,
        totalVolume: 0
      };
    }

    const grouped = {};

    workouts.forEach(w => {
      if (!grouped[w.athleteName]) {
        grouped[w.athleteName] = [];
      }
      grouped[w.athleteName].push(w);
    });

    const leaders = [];
    const improvements = [];
    let totalVolume = 0;

    Object.keys(grouped).forEach(name => {
      const lifts = grouped[name];
      const weights = lifts.map(l => l.weight || 0);

      const max = Math.max(...weights);
      const min = Math.min(...weights);

      const improvement = max - min;

      leaders.push({ name, max });
      improvements.push({ name, improvement });

      totalVolume += weights.reduce((a, b) => a + b, 0);
    });

    leaders.sort((a, b) => b.max - a.max);
    improvements.sort((a, b) => b.improvement - a.improvement);

    return {
      topPerformer: leaders[0] || null,
      mostImproved: improvements[0] || null,
      totalVolume
    };

  }, [workouts]);

  return (
    <div>

      <h2>Dashboard</h2>

      <div className="dashboard-grid">

        <div className="card">
          <h3>Top Performer</h3>
          <p>{analytics.topPerformer?.name || "N/A"}</p>
        </div>

        <div className="card">
          <h3>Most Improved</h3>
          <p>{analytics.mostImproved?.name || "N/A"}</p>
        </div>

        <div className="card">
          <h3>Total Team Volume</h3>
          <p>{analytics.totalVolume.toLocaleString()} lbs</p>
        </div>

      </div>

      {isCoach && (
        <div className="card">
          <h3>Coach Overview</h3>
          <p>You have full team visibility.</p>
        </div>
      )}

    </div>
  );
}

export default Dashboard;
