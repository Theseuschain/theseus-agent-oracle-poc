"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/**
 * Copies the current page URL (including any ?scenario=… params) to the
 * clipboard. The URL is already kept in sync with state by each page's
 * effect, so we just lift window.location.href verbatim.
 */
export function ShareLinkButton({ disabled }: { disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      className="btn flex items-center gap-1.5"
      title="Copy a link that reproduces this scenario"
      onClick={async () => {
        if (typeof window === "undefined") return;
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Some browsers block clipboard writes. Fall back to selecting
          // the URL via a transient input.
          const ta = document.createElement("textarea");
          ta.value = window.location.href;
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* give up quietly */
          } finally {
            document.body.removeChild(ta);
          }
        }
      }}
    >
      {copied ? <Check size={12} /> : <Link2 size={12} />}
      {copied ? "Link copied" : "Share scenario"}
    </button>
  );
}
