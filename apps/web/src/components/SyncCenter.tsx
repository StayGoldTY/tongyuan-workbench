import { FormEvent, useState } from "react";
import type { SyncSourceStatus } from "@tongyuan/contracts";
import {
  countFailedSources,
  countSkippedSources,
  countSyncedSources,
  formatSourceAppLabel,
  formatSyncStatusLabel,
} from "../lib/workbenchPresentation";

interface SyncCenterProps {
  inviteMessage: string;
  inviteBusy: boolean;
  syncStatuses: SyncSourceStatus[];
  onInvite: (email: string, reason: string) => Promise<void>;
}

const SyncCenter = ({
  inviteMessage,
  inviteBusy,
  syncStatuses,
  onInvite,
}: SyncCenterProps) => {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("邀请同事查看童园里的脱敏工作知识。");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return;
    }

    await onInvite(trimmedEmail, reason.trim());
  };

  return (
    <section className="panel sync-layout content-panel">
      <div className="sync-column">
        <div className="panel-header">
          <div className="text-stack">
            <p className="eyebrow">同步状态</p>
            <h2>采集进度、异常提醒和分享开通，都放在这里。</h2>
            <p className="supporting-copy">
              这里会显示每一个知识源最近一次处理结果，方便确认哪些资料已经真正进入童园，哪些还需要继续适配。
            </p>
          </div>
        </div>
        <div className="sync-summary-grid">
          <div className="sync-summary-card">
            <span>已同步</span>
            <strong>{countSyncedSources(syncStatuses)}</strong>
          </div>
          <div className="sync-summary-card">
            <span>已跳过</span>
            <strong>{countSkippedSources(syncStatuses)}</strong>
          </div>
          <div className="sync-summary-card">
            <span>失败</span>
            <strong>{countFailedSources(syncStatuses)}</strong>
          </div>
        </div>
        <div className="sync-list">
          {syncStatuses.length > 0 ? (
            syncStatuses.map((status) => (
              <article key={status.sourceKey} className="sync-card">
                <div className="source-heading">
                  <strong>{status.workspace}</strong>
                  <span className={`health-${status.status === "failed" ? "failed" : status.status === "skipped" ? "warning" : "ready"}`}>
                    {formatSyncStatusLabel(status.status)}
                  </span>
                </div>
                <p>{status.message}</p>
                <small>
                  {formatSourceAppLabel(status.sourceApp)} · 发现 {status.discoveredUnits} 条 · 入库 {status.uploadedUnits} 条
                </small>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <strong>当前还没有同步记录。</strong>
              <p>完成第一次采集后，这里会出现每个来源的处理结果。</p>
            </div>
          )}
        </div>
      </div>
      <div className="sync-column">
        <div className="panel-header">
          <div className="text-stack">
            <p className="eyebrow">协作邀请</p>
            <h2>给同事开通只读访问。</h2>
            <p className="supporting-copy">
              邀请只针对允许共享的脱敏知识片段，浏览器端不会直接暴露服务密钥。
            </p>
          </div>
        </div>
        <form className="invite-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="invite-email">
            同事邮箱
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="field-label" htmlFor="invite-reason">
            邀请说明
          </label>
          <textarea
            id="invite-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button className="primary-button" disabled={inviteBusy} type="submit">
            {inviteBusy ? "正在发送..." : "发送邀请"}
          </button>
          <p className="message-line">{inviteMessage}</p>
        </form>
      </div>
    </section>
  );
};

export default SyncCenter;
