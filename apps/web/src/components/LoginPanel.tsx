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
          <p className="eyebrow">童园工作知识台</p>
          <h1>让同事用中文业务语言，直接问懂工作。</h1>
          <p className="hero-description">
            童园会把代码、聊天和项目资料整理成可引用的业务回答。默认原始资料留在本机，云端只保留脱敏后的知识片段。
          </p>
          <div className="login-bullets">
            <div className="feature-pill">默认中文协作</div>
            <div className="feature-pill">默认业务视角回答</div>
            <div className="feature-pill">只同步脱敏内容</div>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="email">
            工作邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            placeholder="name@company.com"
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "正在处理..." : supportsMagicLink ? "发送登录链接" : "进入演示模式"}
          </button>
          <p className="message-line">{message}</p>
        </form>
      </section>
    </main>
  );
};

export default LoginPanel;
