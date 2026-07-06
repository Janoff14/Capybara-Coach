"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";

import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/capture", label: "Read & note" },
  { href: "/practice", label: "Practice" },
  { href: "/notes", label: "Notes" },
];

type ReaderCatalogShellProps = {
  activeHref: string;
  children: React.ReactNode;
  displayName?: string | null;
  fullBleed?: boolean;
  onLogout: () => void;
};

export function ReaderCatalogShell({
  activeHref,
  children,
  displayName,
  fullBleed = false,
  onLogout,
}: ReaderCatalogShellProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [chainPulled, setChainPulled] = useState(false);

  useEffect(() => {
    let frameId: number | null = null;
    try {
      const saved = window.localStorage.getItem("capy-reader-theme");
      if (saved === "dark" || saved === "light") {
        frameId = window.requestAnimationFrame(() => setTheme(saved));
      }
    } catch {
      // Local storage is optional; the light theme remains usable without it.
    }
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.readerTheme = theme;
    return () => {
      delete document.documentElement.dataset.readerTheme;
    };
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setChainPulled(true);
    window.setTimeout(() => setChainPulled(false), 520);
    try {
      window.localStorage.setItem("capy-reader-theme", next);
    } catch {
      // Theme persistence is a convenience, not a requirement.
    }
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("q");
    const query = input instanceof HTMLInputElement ? input.value.trim() : "";
    if (!query) return;
    router.push(`/documents?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="reader-catalog" data-theme={theme}>
      <header className="reader-catalog-header">
        <div className="reader-catalog-header-row">
          <Link href="/dashboard" className="reader-catalog-brand">
            Capybara Coach <span>— reading room</span>
          </Link>

          <div className="reader-catalog-utilities">
            <form className="reader-catalog-search" role="search" onSubmit={handleSearchSubmit}>
              <Search aria-hidden="true" />
              <label className="sr-only" htmlFor="reader-catalog-search">Find a card</label>
              <input
                id="reader-catalog-search"
                name="q"
                type="search"
                placeholder="Find a card…"
              />
              <button type="submit" className="reader-catalog-search-submit">Search</button>
            </form>

            <button
              type="button"
              className="reader-catalog-lamp"
              onClick={toggleTheme}
              title={theme === "dark" ? "Lights on" : "Pull for lights-out"}
              aria-label={theme === "dark" ? "Turn lights on" : "Turn lights off"}
              aria-pressed={theme === "dark"}
            >
              <span className="reader-lamp-glow" />
              <span className="reader-lamp-shade" />
              <span className="reader-lamp-rim" />
              <span className="reader-lamp-stem" />
              <span className="reader-lamp-base" />
              <span className={chainPulled ? "reader-lamp-chain is-pulled" : "reader-lamp-chain"} />
            </button>

            <div className="reader-catalog-id">
              <p>Reader № 042</p>
              <strong>{displayName || "M. Student"}</strong>
            </div>

            <button type="button" className="reader-catalog-logout" onClick={onLogout} title="Log out">
              <LogOut aria-hidden="true" />
              <span className="sr-only">Log out</span>
            </button>
          </div>
        </div>

        <div className="reader-catalog-nav-row">
          <nav className="reader-catalog-tabs" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.href === activeHref ? "reader-catalog-tab is-active" : "reader-catalog-tab"}
              >
                <span>{item.label}</span>
                <i aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <UploadDocumentDialog
            buttonLabel="Catalog new PDF"
            buttonClassName="reader-catalog-upload"
          />
        </div>
      </header>

      <main className={fullBleed ? "reader-catalog-main" : "reader-catalog-main reader-catalog-content"}>
        {children}
      </main>
    </div>
  );
}
