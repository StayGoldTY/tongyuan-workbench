import { FormEvent, useState } from "react";

interface LoginPanelProps {
  busy: boolean;
  message: string;
  supportsMagicLink: boolean;
  onLogin: (email: string) => Promise<void>;
}

const LoginPanel = ({
  busy,
  message,
  supportsMagicLink,
  onLogin,
}: LoginPanelProps) => {
  const [email, setEmail] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return;
    }

    await onLogin(trimmedEmail);
  };

  return (
    <main className="login-stage">
      <section className="login-panel">
        <div className="login-copy">
          <p className="eyebrow">Private Work Knowledge</p>
          <h1>童园 Workbench</h1>
          <p>
            TongYuan keeps redacted work knowledge searchable without sending raw materials to the cloud.
          </p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Work Email</label>
          <input
            id="email"
            type="email"
            value={email}
            placeholder="name@company.com"
            onChange={(event) => setEmail(event.target.value)}
          />
          <button disabled={busy} type="submit">
            {busy ? "Working..." : supportsMagicLink ? "Send Magic Link" : "Enter Demo Mode"}
          </button>
          <p className="message-line">{message}</p>
        </form>
      </section>
    </main>
  );
};

export default LoginPanel;
