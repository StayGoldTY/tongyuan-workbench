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
    <section className="chat-layout">
      <section className="composer-card">
        <div className="panel-header">
          <div className="text-stack">
            <p className="eyebrow">业务问答</p>
            <h2>像在微信里问我一样，直接说场景就行。</h2>
            <p className="supporting-copy">
              童园会优先把代码和聊天线索翻译成业务语言，不主动堆技术术语。除非你明确要求，否则回答会先讲结论、影响和下一步。
            </p>
          </div>
          <span className={busy ? "pulse-badge" : "steady-badge"}>
            {busy ? "正在整理依据" : "可以开始提问"}
          </span>
        </div>
        <form className="chat-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="question">
            你现在想了解什么？
          </label>
          <textarea
            id="question"
            placeholder="例如：这个功能现在主要服务哪个业务环节？上次讨论最后是怎么定的？最近同步里哪些变化需要提醒同事？"
            rows={6}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <p className="field-note">
            问题越像日常沟通越好，童园会自动把技术资料转成能对外沟通的话。
          </p>
          <div className="prompt-list">
            {examplePrompts.map((prompt) => (
              <button key={prompt} onClick={() => setQuestion(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>
          <div className="composer-actions">
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "童园整理中..." : "发送问题"}
            </button>
          </div>
        </form>
      </section>

      <section className="answer-card">
        <div className="answer-header">
          <div className="text-stack">
            <p className="eyebrow">本次回答</p>
            <h3>先给业务结论，再给依据。</h3>
          </div>
          <span className={`confidence-badge confidence-${response?.confidenceLabel ?? "insufficient"}`}>
            {formatConfidenceLabel(response?.confidenceLabel ?? "insufficient")}
          </span>
        </div>
        <div className="answer-bubble">
          <p className="answer-copy">
            {response?.answer ??
              "问题先直接说业务场景就可以。童园会结合代码资料、聊天记录和摘要内容，优先回答“这件事是做什么的、影响谁、下一步怎么推进”。"}
          </p>
        </div>
        <div className="note-list">
          {(
            response?.notes ?? [
              "回答会附带来源依据。",
              "如果证据不够，童园会明确说暂时不能下结论。",
            ]
          ).map((note) => (
            <span className="note-chip" key={note}>
              {note}
            </span>
          ))}
        </div>
      </section>

      <section className="source-strip-card">
        <div className="strip-header">
          <div className="text-stack">
            <p className="eyebrow">引用依据</p>
            <h3>点开任一依据，可以看脱敏后的原始片段。</h3>
          </div>
        </div>
        <div className="citation-grid">
          {(response?.citations ?? []).length > 0 ? (
            (response?.citations ?? []).map((citation) => (
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
            ))
          ) : (
            <div className="empty-state">
              <strong>这次还没有可展示的引用依据。</strong>
              <p>等你发出问题后，这里会显示相关资料片段、时间和来源类型。</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
};

export default ChatWorkspace;
