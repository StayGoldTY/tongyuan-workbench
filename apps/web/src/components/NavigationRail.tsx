type WorkspaceView = "chat" | "sources" | "sync";

interface NavigationRailProps {
  activeView: WorkspaceView;
  onRefresh: () => void;
  onSelect: (view: WorkspaceView) => void;
  onSignOut: () => void;
  sessionEmail: string;
  sourceCount: number;
  syncedCount: number;
  workspaceBusy: boolean;
}

const navItems: Array<{ key: WorkspaceView; label: string; description: string }> = [
  {
    key: "chat",
    label: "聊天",
    description: "直接提问，拿业务化结论和依据。",
  },
  {
    key: "sources",
    label: "资料来源",
    description: "查看已接入的代码、聊天和文档资料。",
  },
  {
    key: "sync",
    label: "同步状态",
    description: "看采集结果、异常提醒和协作邀请。",
  },
];

const NavigationRail = ({
  activeView,
  onRefresh,
  onSelect,
  onSignOut,
  sessionEmail,
  sourceCount,
  syncedCount,
  workspaceBusy,
}: NavigationRailProps) => (
  <header className="topbar">
    <div className="brand-block">
      <div className="brand-mark">童</div>
      <div className="brand-copy">
        <p className="eyebrow">TongYuan</p>
        <strong>童园</strong>
        <small>{sessionEmail}</small>
      </div>
    </div>
    <nav aria-label="主导航" className="topbar-tabs">
      {navItems.map((item) => (
        <button
          key={item.key}
          className={activeView === item.key ? "topbar-tab active" : "topbar-tab"}
          onClick={() => onSelect(item.key)}
          type="button"
        >
          <span>{item.label}</span>
          <small>{item.description}</small>
        </button>
      ))}
    </nav>
    <div className="topbar-side">
      <div className="compact-stats">
        <span className="mini-chip">来源 {sourceCount}</span>
        <span className="mini-chip">已同步 {syncedCount}</span>
      </div>
      <div className="topbar-actions">
        <button className="ghost-button" onClick={onRefresh} type="button">
          {workspaceBusy ? "刷新中..." : "刷新"}
        </button>
        <button className="ghost-button" onClick={onSignOut} type="button">
          退出
        </button>
      </div>
    </div>
  </header>
);

export default NavigationRail;
