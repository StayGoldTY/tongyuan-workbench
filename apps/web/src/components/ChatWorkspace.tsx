import { FormEvent, useState } from "react";
import type { ChatQueryResponse, Citation } from "@tongyuan/contracts";

interface ChatWorkspaceProps {
  busy: boolean;
  response: ChatQueryResponse | null;
  onCitationSelect: (citation: Citation) => void;
  onQuery: (question: string) => Promise<void>;
}

const examplePrompts = [
  "How is the HAINAN.Server backend layered?",
  "Which API is tied to a Lekima page?",
  "What changed in the latest sync preview?",
];

const ChatWorkspace = ({
  busy,
  response,
  onCitationSelect,
  onQuery,
}: ChatWorkspaceProps) => {
  const [question, setQuestion] = useState(examplePrompts[0]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    await onQuery(trimmedQuestion);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Chat</p>
          <h2>Grounded work Q&amp;A</h2>
        </div>
        <span className={busy ? "pulse-badge" : "steady-badge"}>
          {busy ? "Retrieving" : "Ready"}
        </span>
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="chat-actions">
          <div className="prompt-list">
            {examplePrompts.map((prompt) => (
              <button key={prompt} onClick={() => setQuestion(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Asking TongYuan..." : "Ask TongYuan"}
          </button>
        </div>
      </form>
      <div className="answer-panel">
        <h3>Answer</h3>
        <p>{response?.answer ?? "Ask a question and TongYuan will return a grounded answer with citations."}</p>
        <div className="note-list">
          {response?.notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
      </div>
      <div className="citation-grid">
        {(response?.citations ?? []).map((citation) => (
          <button
            key={citation.id}
            className="citation-card"
            onClick={() => onCitationSelect(citation)}
            type="button"
          >
            <strong>{citation.title}</strong>
            <span>{citation.workspace}</span>
            <small>{citation.excerpt}</small>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ChatWorkspace;
