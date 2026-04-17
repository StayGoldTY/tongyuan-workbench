import { useEffect, useState } from "react";
import type {
  ChatQueryResponse,
  Citation,
  DocumentDetail,
  SourceCatalogEntry,
  SyncSourceStatus,
} from "@tongyuan/contracts";
import ChatWorkspace from "./components/ChatWorkspace";
import CitationDrawer from "./components/CitationDrawer";
import LoginPanel from "./components/LoginPanel";
import NavigationRail from "./components/NavigationRail";
import SourceLibrary from "./components/SourceLibrary";
import SyncCenter from "./components/SyncCenter";
import {
  getCurrentSessionEmail,
  getDocumentDetail,
  listSources,
  listSyncStatuses,
  loginWithMagicLink,
  queryTongyuan,
  sendInvite,
  signOutSession,
  supportsMagicLink,
  supportsRemoteApi,
} from "./lib/apiClient";
import { countSyncedSources } from "./lib/workbenchPresentation";
import { supabaseClient } from "./lib/supabaseClient";

type WorkspaceView = "chat" | "sources" | "sync";

const App = () => {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [loginBusy, setLoginBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("请输入工作邮箱后继续。");
  const [inviteMessage, setInviteMessage] = useState("邀请会通过私有后端发出。");
  const [sources, setSources] = useState<SourceCatalogEntry[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<SyncSourceStatus[]>([]);
  const [response, setResponse] = useState<ChatQueryResponse | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetail | null>(null);

  const loadWorkspace = async () => {
    setWorkspaceBusy(true);

    try {
      const [sourceEntries, statuses] = await Promise.all([listSources(), listSyncStatuses()]);
      setSources(sourceEntries);
      setSyncStatuses(statuses);
      setStatusMessage(
        supportsRemoteApi()
          ? "已连接私有后端，当前页面会读取实时脱敏知识。"
          : "当前为演示模式，因为还没有配置远程接口。页面展示的是本地示例数据。",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "暂时无法加载工作台。";
      setStatusMessage(message);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  useEffect(() => {
    const hydrateSession = async () => {
      const existingEmail = await getCurrentSessionEmail();
      if (!existingEmail) {
        return;
      }

      setSessionEmail(existingEmail);
      setStatusMessage(`当前已登录：${existingEmail}`);
    };

    void hydrateSession();
  }, []);

  useEffect(() => {
    if (!supabaseClient) {
      return;
    }

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      if (session?.user.email) {
        setStatusMessage(`当前已登录：${session.user.email}`);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionEmail) {
      return;
    }

    void loadWorkspace();
  }, [sessionEmail]);

  const handleLogin = async (email: string) => {
    setLoginBusy(true);

    try {
      const mode = await loginWithMagicLink(email);
      if (mode === "demo") {
        setSessionEmail(email);
        setStatusMessage("当前已进入演示模式，因为还没有配置 Supabase 登录。");
        return;
      }

      setStatusMessage(`登录链接已发送到 ${email}，请在当前浏览器完成登录。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "暂时无法登录。";
      setStatusMessage(message);
    } finally {
      setLoginBusy(false);
    }
  };

  const handleQuery = async (question: string) => {
    setChatBusy(true);

    try {
      const nextResponse = await queryTongyuan({
        bot: "tongyuan",
        question,
        topK: 6,
      });

      setResponse(nextResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "暂时无法向童园提问。";
      setResponse({
        answer: message,
        confidenceLabel: "insufficient",
        citations: [],
        notes: ["请求在返回有依据的回答前就失败了。"],
      });
    } finally {
      setChatBusy(false);
    }
  };

  const handleCitationSelect = async (citation: Citation) => {
    setSelectedCitation(citation);
    setSelectedDocument(null);
    const detail = await getDocumentDetail(citation.id);
    setSelectedDocument(detail);
  };

  const handleInvite = async (email: string, reason: string) => {
    setInviteBusy(true);

    try {
      const result = await sendInvite({ email, reason });
      setInviteMessage(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "暂时无法发送邀请。";
      setInviteMessage(message);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutSession();
    } finally {
      setSessionEmail(null);
      setSources([]);
      setSyncStatuses([]);
      setResponse(null);
      setSelectedCitation(null);
      setSelectedDocument(null);
      setStatusMessage("你已退出登录。");
    }
  };

  if (!sessionEmail) {
    return (
      <LoginPanel
        busy={loginBusy}
        message={statusMessage}
        supportsMagicLink={supportsMagicLink()}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main className="workspace-shell">
      <NavigationRail
        activeView={activeView}
        onSelect={setActiveView}
        sourceCount={sources.length}
        syncedCount={countSyncedSources(syncStatuses)}
      />
      <section className="workspace-stage">
        <section className="panel workspace-hero">
          <div className="text-stack">
            <p className="eyebrow">童园工作知识台</p>
            <h2>把代码、聊天和项目资料，解释成业务同事能直接使用的答案</h2>
            <p className="hero-description">
              默认中文界面，默认业务语言，默认附带来源依据。页面适合直接给不懂代码的同事使用。
            </p>
          </div>
          <div className="badge-row">
            <span className="feature-pill">当前账号：{sessionEmail}</span>
            <span className="feature-pill">仅同步脱敏片段</span>
            <span className="feature-pill">代码与聊天分开检索</span>
          </div>
          <div className="hero-metric-row">
            <article className="hero-metric-card">
              <span>知识源总数</span>
              <strong>{sources.length}</strong>
            </article>
            <article className="hero-metric-card">
              <span>最近成功同步</span>
              <strong>{countSyncedSources(syncStatuses)}</strong>
            </article>
            <article className="hero-metric-card">
              <span>默认回答方式</span>
              <strong>业务说明</strong>
            </article>
          </div>
        </section>
        <header className="workspace-header">
          <p className="status-banner">{statusMessage}</p>
          <div className="header-actions">
            <button className="ghost-button" onClick={() => void loadWorkspace()} type="button">
              {workspaceBusy ? "正在刷新..." : "刷新工作台"}
            </button>
            <button className="ghost-button" onClick={() => void handleSignOut()} type="button">
              退出登录
            </button>
          </div>
        </header>
        {activeView === "chat" && (
          <ChatWorkspace
            busy={chatBusy}
            response={response}
            onCitationSelect={handleCitationSelect}
            onQuery={handleQuery}
          />
        )}
        {activeView === "sources" && <SourceLibrary sources={sources} />}
        {activeView === "sync" && (
          <SyncCenter
            inviteBusy={inviteBusy}
            inviteMessage={inviteMessage}
            syncStatuses={syncStatuses}
            onInvite={handleInvite}
          />
        )}
      </section>
      <CitationDrawer
        citation={selectedCitation}
        detail={selectedDocument}
        onClose={() => {
          setSelectedCitation(null);
          setSelectedDocument(null);
        }}
      />
    </main>
  );
};

export default App;
