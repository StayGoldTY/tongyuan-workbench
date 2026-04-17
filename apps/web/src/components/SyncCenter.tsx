import { FormEvent, useState } from "react";
import type { SyncSourceStatus } from "@tongyuan/contracts";

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
  const [reason, setReason] = useState("Invite a teammate to view TongYuan.");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return;
    }

    await onInvite(trimmedEmail, reason.trim());
  };

  return (
    <section className="panel sync-layout">
      <div className="sync-column">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Sync</p>
            <h2>Collector status</h2>
          </div>
        </div>
        <div className="sync-list">
          {syncStatuses.map((status) => (
            <article key={status.sourceKey} className="sync-card">
              <strong>{status.workspace}</strong>
              <span>{status.message}</span>
              <small>
                {status.status} · discovered {status.discoveredUnits} · uploaded {status.uploadedUnits}
              </small>
            </article>
          ))}
        </div>
      </div>
      <div className="sync-column">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Invite</p>
            <h2>Share with a teammate</h2>
          </div>
        </div>
        <form className="invite-form" onSubmit={handleSubmit}>
          <label htmlFor="invite-email">Teammate Email</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="invite-reason">Reason</label>
          <textarea
            id="invite-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button className="primary-button" disabled={inviteBusy} type="submit">
            {inviteBusy ? "Sending..." : "Send Invite"}
          </button>
          <p className="message-line">{inviteMessage}</p>
        </form>
      </div>
    </section>
  );
};

export default SyncCenter;
