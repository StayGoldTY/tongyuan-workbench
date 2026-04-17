type WorkspaceView = "chat" | "sources" | "sync";

interface NavigationRailProps {
  activeView: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  sourceCount: number;
  syncedCount: number;
}

const navItems: Array<{ key: WorkspaceView; label: string; description: string }> = [
  { key: "chat", label: "Ask", description: "Query TongYuan and inspect grounded citations." },
  { key: "sources", label: "Sources", description: "Browse the connected code and chat roots." },
  { key: "sync", label: "Sync", description: "Review collector runs and invite teammates." },
];

const NavigationRail = ({
  activeView,
  onSelect,
  sourceCount,
  syncedCount,
}: NavigationRailProps) => (
  <aside className="navigation-rail">
    <div className="navigation-hero">
      <p className="eyebrow">TongYuan</p>
      <h1>童园</h1>
      <p className="supporting-copy">
        A private work knowledge desk for repositories, chats, and sync history.
      </p>
    </div>
    <div className="stat-grid">
      <div className="stat-card">
        <span>Sources</span>
        <strong>{sourceCount}</strong>
      </div>
      <div className="stat-card">
        <span>Synced</span>
        <strong>{syncedCount}</strong>
      </div>
    </div>
    <nav className="nav-list" aria-label="Primary">
      {navItems.map((item) => (
        <button
          key={item.key}
          className={activeView === item.key ? "nav-item active" : "nav-item"}
          onClick={() => onSelect(item.key)}
          type="button"
        >
          <span>{item.label}</span>
          <small>{item.description}</small>
        </button>
      ))}
    </nav>
  </aside>
);

export default NavigationRail;
