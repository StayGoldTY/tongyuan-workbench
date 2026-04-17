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
import { countSyncedSources, formatSourceAppLabel } from "./lib/workbenchPresentation";
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
          ? "已连接私有知识库，当前回答会优先基于脱敏后的真实工作资料生成。"
          : "当前是演示模式，页面显示的是本地示例数据；接通 Supabase 后会切换到真实知识库。",
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
        setStatusMessage("当前进入的是演示模式，因为还没有启用 Supabase 登录。");
        return;
      }

      setStatusMessage(`登录链接已经发送到 ${email}，请在当前浏览器完成登录。`);
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
        notes: ["这次请求还没拿到可用依据，建议稍后再试一次。"],
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
    <main className="app-shell">
      <NavigationRail
        activeView={activeView}
        onRefresh={() => void loadWorkspace()}
        onSelect={setActiveView}
        onSignOut={() => void handleSignOut()}
        sessionEmail={sessionEmail}
        sourceCount={sources.length}
        syncedCount={countSyncedSources(syncStatuses)}
        workspaceBusy={workspaceBusy}
      />
      <section className="app-stage">
        <section className="status-strip">
          <div className="status-copy">
            <p className="eyebrow">工作知识库</p>
            <strong>首页只保留一个聊天框，其他学习和核对信息放到旁边标签。</strong>
            <p>{statusMessage}</p>
          </div>
          {sources.length > 0 ? (
            <div className="status-inline-list">
              {sources.slice(0, 3).map((source) => (
                <span className="mini-chip" key={source.sourceKey}>
                  {source.workspace} · {formatSourceAppLabel(source.sourceApp)}
                </span>
              ))}
            </div>
          ) : null}
        </section>

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
