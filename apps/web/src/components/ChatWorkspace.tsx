import { FormEvent, useState } from "react";
import type { ChatQueryResponse, Citation } from "@tongyuan/contracts";
import {
  examplePrompts,
  formatConfidenceLabel,
  formatSourceAppLabel,
  formatTimestamp,
} from "../lib/workbenchPresentation";

interface ChatWorkspaceProps {
  busy: boolean;
  response: ChatQueryResponse | null;
  onCitationSelect: (citation: Citation) => void;
  onQuery: (question: string) => Promise<void>;
}

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
        <div className="text-stack">
          <p className="eyebrow">业务问答</p>
          <h2>让童园把资料翻成同事听得懂的话</h2>
          <p className="supporting-copy">
            默认按业务影响、流程含义和建议动作来回答。除非你明确要求，否则不会直接堆代码术语。
          </p>
        </div>
        <div className="badge-row">
          <span className="steady-badge">默认业务解释模式</span>
          <span className={busy ? "pulse-badge" : "steady-badge"}>
            {busy ? "正在整理依据" : "随时可提问"}
          </span>
        </div>
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="question">
          你想问什么
        </label>
        <textarea
          id="question"
          placeholder="例如：这个页面现在主要给谁用？这项需求之前怎么定的？最近同步里有什么变化值得提醒同事？"
          rows={5}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <p className="field-note">越像日常聊天越好，童园会自动把技术资料转成业务表达。</p>
        <div className="chat-actions">
          <div className="prompt-list">
            {examplePrompts.map((prompt) => (
              <button key={prompt} onClick={() => setQuestion(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "童园正在整理..." : "开始提问"}
          </button>
        </div>
      </form>
      <div className="answer-panel">
        <div className="answer-header">
          <div className="text-stack">
            <p className="eyebrow">本次回答</p>
            <h3>业务化说明</h3>
          </div>
          <span className={`confidence-badge confidence-${response?.confidenceLabel ?? "insufficient"}`}>
            {formatConfidenceLabel(response?.confidenceLabel ?? "insufficient")}
          </span>
        </div>
        <p className="answer-copy">
          {response?.answer ??
            "直接用业务话术来问就可以。童园会结合代码、聊天和摘要资料，先给你业务结论，再说明影响和下一步。"}
        </p>
        <div className="note-list">
          {(response?.notes ?? ["回答会附带来源依据；如果证据不足，童园会明确告诉你不能下结论。"]).map(
            (note) => (
              <span className="note-chip" key={note}>
                {note}
              </span>
            ),
          )}
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
            <div className="citation-heading">
              <strong>{citation.title}</strong>
              <span>{formatSourceAppLabel(citation.sourceApp)}</span>
            </div>
            <p className="citation-workspace">{citation.workspace}</p>
            <small>{citation.excerpt}</small>
            <div className="citation-meta">
              <span>可信度 {Math.round(citation.confidence * 100)}%</span>
              <span>{formatTimestamp(citation.eventTime)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ChatWorkspace;
