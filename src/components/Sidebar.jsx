function Sidebar({activeTab,setActiveTab,collapsed,setCollapsed}){

return(
<div className={`sidebar ${collapsed?"collapsed":""}`}>

  <div className="sidebar-header">
    <h2>{collapsed?"PTW":"PTW Weightlifting"}</h2>
    <button onClick={()=>setCollapsed(!collapsed)}>
      {collapsed?"➡":"⬅"}
    </button>
  </div>

  <div
    className={`sidebar-item ${activeTab==="dashboard"?"active":""}`}
    onClick={()=>setActiveTab("dashboard")}
  >
    📊 {!collapsed && "Dashboard"}
  </div>

  <div
    className={`sidebar-item ${activeTab==="leaderboard"?"active":""}`}
    onClick={()=>setActiveTab("leaderboard")}
  >
    🏆 {!collapsed && "Leaderboard"}
  </div>

  <div
    className={`sidebar-item ${activeTab==="workouts"?"active":""}`}
    onClick={()=>setActiveTab("workouts")}
  >
    🏋 {!collapsed && "Workouts"}
  </div>

  <div
    className={`sidebar-item ${activeTab==="account"?"active":""}`}
    onClick={()=>setActiveTab("account")}
  >
    ⚙ {!collapsed && "Account"}
  </div>

</div>
);
}

export default Sidebar;
