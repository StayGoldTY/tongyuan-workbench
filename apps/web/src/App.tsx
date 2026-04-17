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
import { supabaseClient } from "./lib/supabaseClient";

type WorkspaceView = "chat" | "sources" | "sync";

const App = () => {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [loginBusy, setLoginBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Enter a work email to continue.");
  const [inviteMessage, setInviteMessage] = useState("Invites are sent from the private backend.");
  const [sources, setSources] = useState<SourceCatalogEntry[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<SyncSourceStatus[]>([]);
  const [response, setResponse] = useState<ChatQueryResponse | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetail | null>(null);

  const loadWorkspace = async () => {
    setWorkspaceBusy(true);

    try {
      const [sourceEntries, statuses] = await Promise.all([
        listSources(),
        listSyncStatuses(),
      ]);

      setSources(sourceEntries);
      setSyncStatuses(statuses);
      setStatusMessage(
        supportsRemoteApi()
          ? "Connected to the deployed backend."
          : "Demo mode is active because no remote API is configured.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load the workspace.";
      setStatusMessage(message);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  useEffect(() => {
    const hydrateSession = async () => {
      const existingEmail = await getCurrentSessionEmail();
      if (existingEmail) {
        setSessionEmail(existingEmail);
        setStatusMessage(`Signed in as ${existingEmail}.`);
      }
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
        setStatusMessage(`Signed in as ${session.user.email}.`);
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
        setStatusMessage("Entered demo mode because Supabase auth is not configured.");
      } else {
        setStatusMessage(`A magic link was sent to ${email}. Finish sign-in in the same browser.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
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
      const message = error instanceof Error ? error.message : "Unable to query TongYuan.";
      setResponse({
        answer: message,
        confidenceLabel: "insufficient",
        citations: [],
        notes: ["The request failed before grounded results were returned."],
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
      const message = error instanceof Error ? error.message : "Unable to send the invite.";
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
      setStatusMessage("Signed out.");
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
        syncedCount={syncStatuses.filter((item) => item.status === "synced").length}
      />
      <section className="workspace-stage">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Signed in</p>
            <h2>{sessionEmail}</h2>
          </div>
          <div className="header-actions">
            <span className="steady-badge">Raw material stays local. Only redacted evidence syncs.</span>
            <button className="ghost-button" onClick={() => void loadWorkspace()} type="button">
              {workspaceBusy ? "Refreshing..." : "Refresh"}
            </button>
            <button className="ghost-button" onClick={() => void handleSignOut()} type="button">
              Sign Out
            </button>
          </div>
        </header>
        <p className="status-banner">{statusMessage}</p>
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
