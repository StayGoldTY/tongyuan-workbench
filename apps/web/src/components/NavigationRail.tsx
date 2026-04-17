type WorkspaceView = "chat" | "sources" | "sync";

interface NavigationRailProps {
  activeView: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  sourceCount: number;
  syncedCount: number;
}

const navItems: Array<{ key: WorkspaceView; label: string; description: string }> = [
  { key: "chat", label: "业务问答", description: "用同事听得懂的话解释项目、流程和讨论结论。" },
  { key: "sources", label: "知识来源", description: "查看已接入的代码、聊天与资料根目录。" },
  { key: "sync", label: "同步中心", description: "查看采集结果、同步状态和协作邀请。" },
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
        面向中文同事的私人工作知识台。默认按业务视角回答，不直接把技术实现甩给使用者。
      </p>
    </div>
    <div className="stat-grid">
      <div className="stat-card">
        <span>知识源</span>
        <strong>{sourceCount}</strong>
      </div>
      <div className="stat-card">
        <span>已同步</span>
        <strong>{syncedCount}</strong>
      </div>
    </div>
    <div className="navigation-highlights">
      <span className="feature-pill">中文界面</span>
      <span className="feature-pill">业务解释</span>
      <span className="feature-pill">脱敏检索</span>
    </div>
    <nav aria-label="主导航" className="nav-list">
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
