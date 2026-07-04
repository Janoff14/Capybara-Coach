"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  mode: "login" | "register";
  children: React.ReactNode;
};

export function AuthShell({ title, description, mode, children }: AuthShellProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [chainPulled, setChainPulled] = useState(false);

  useEffect(() => {
    let frameId: number | null = null;
    try {
      const saved = window.localStorage.getItem("capy-reader-theme");
      if (saved === "light" || saved === "dark") {
        frameId = window.requestAnimationFrame(() => setTheme(saved));
      }
    } catch {
      // The desk still works without persisted theme state.
    }
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setChainPulled(true);
    window.setTimeout(() => setChainPulled(false), 520);
    try {
      window.localStorage.setItem("capy-reader-theme", next);
    } catch {
      // Persistence is optional.
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="reader-catalog reader-auth" data-theme={theme}>
      <button
        type="button"
        className="reader-catalog-lamp reader-auth-lamp"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Turn lights on" : "Turn lights off"}
      >
        <span className="reader-lamp-glow" />
        <span className="reader-lamp-shade" />
        <span className="reader-lamp-rim" />
        <span className="reader-lamp-stem" />
        <span className="reader-lamp-base" />
        <span className={chainPulled ? "reader-lamp-chain is-pulled" : "reader-lamp-chain"} />
      </button>

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
