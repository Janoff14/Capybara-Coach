"use client";

import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  mode: "login" | "register";
  children: React.ReactNode;
};

export function AuthShell({ title, description, mode, children }: AuthShellProps) {
  const isLogin = mode === "login";

  return (
    <div className="reader-catalog reader-auth">
      <main className="reader-auth-wrap">
        <div className="reader-auth-capy" aria-hidden="true">
          <i /><i /><span><b /><b /><em /></span>
        </div>

        <section className="reader-auth-card">
          <header>
            <p>Capybara Coach · Reading Room</p>
            <span>Form 42-B</span>
          </header>

          <nav aria-label="Account mode">
            <Link href="/login" className={isLogin ? "is-active" : ""}>Sign in</Link>
            <Link href="/register" className={!isLogin ? "is-active" : ""}>New member</Link>
          </nav>

          <div className="reader-auth-stamp">Card holder</div>
          <div className="reader-auth-body">
            <p className="reader-overline">
              {isLogin ? "Returning borrower · check in" : "New borrower · issue a card"}
            </p>
            <h1>{isLogin ? "Welcome back to the desk." : "Apply for a reading-room card."}</h1>
            <p className="reader-auth-description">{description}</p>
            <div className="reader-auth-form">{children}</div>
          </div>

          <footer>
            <span>Read · recall · assess · file · drill</span>
            <span>{title} · est. 2026</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
