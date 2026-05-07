"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  /** "live" | "mock" — surfaces a small status badge. */
  mode: "live" | "mock";
}

export function TopBar({ mode }: Props) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-bg/70 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <a
            href="https://theseus.network"
            className="flex items-baseline gap-2 group"
            aria-label="theseus.network"
          >
            <span className="serif text-lg group-hover:text-coral transition">
              Theseus
            </span>
            <span className="text-fg-mute mono text-xs">/</span>
            <span className="mono text-[11px] uppercase tracking-wider text-fg-dim">
              agents
            </span>
          </a>
          <nav className="flex items-center gap-1 ml-2 p-0.5 rounded-[8px] bg-surface-2 border border-border">
            <Tab href="/" label="Aave Oracle" pathname={pathname} />
            <Tab href="/terra" label="Terra Failsafe" pathname={pathname} />
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`badge ${mode === "live" ? "badge-priced" : "badge-stale"} hidden sm:inline-flex`}
          >
            {mode === "live" ? "live chain" : "mock data"}
          </span>
          <a
            href="https://theseus.network/docs"
            className="mono text-[11px] text-fg-dim hover:text-fg hidden md:inline"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs
          </a>
          <a
            href="https://github.com/Theseuschain/theseus-agent-oracle-poc"
            className="mono text-[11px] text-fg-dim hover:text-fg"
            target="_blank"
            rel="noopener noreferrer"
          >
            github
          </a>
          <a
            href="https://theseus.network"
            className="mono text-[11px] text-fg-dim hover:text-coral"
            target="_blank"
            rel="noopener noreferrer"
          >
            theseus.network ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function Tab({ href, label, pathname }: { href: string; label: string; pathname: string | null }) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`mono text-[11px] py-1 px-2.5 rounded-[6px] transition ${
        active ? "bg-coral text-bg" : "text-fg-dim hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
}
