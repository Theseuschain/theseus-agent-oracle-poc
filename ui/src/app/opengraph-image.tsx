import { ImageResponse } from "next/og";

export const alt =
  "Theseus demo agents: eight autonomous agents you can run in a browser tab.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          color: "#e9e7e4",
          fontFamily: "serif",
          padding: "72px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "monospace",
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#9a9892",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <span
              style={{ fontFamily: "serif", fontSize: 22, color: "#e9e7e4" }}
            >
              Theseus
            </span>
            <span>/ demo agents</span>
          </div>
          <span>demo-agents.theseus.network</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontFamily: "serif",
              fontSize: 72,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#e9e7e4",
              display: "flex",
            }}
          >
            Eight autonomous agents,
          </div>
          <div
            style={{
              fontFamily: "serif",
              fontSize: 72,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#ff7a59",
              display: "flex",
            }}
          >
            running in a browser tab.
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 19,
              color: "#9a9892",
              marginTop: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
            }}
          >
            <span>oracle replacement</span>
            <span>· mechanism gate</span>
            <span>· proposal reviewer</span>
            <span>· sovereign fund</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "monospace",
            fontSize: 16,
            color: "#9a9892",
          }}
        >
          <span>Each posts a signed decision to a real chain.</span>
          <span>Every system prompt is public on PoA.</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
