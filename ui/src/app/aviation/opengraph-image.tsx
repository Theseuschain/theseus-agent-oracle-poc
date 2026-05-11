import { ImageResponse } from "next/og";

export const alt =
  "Aviation Safety Reviewer. A Theseus agent reviewing aircraft type-certification changes before delivery.";
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
            <span>/ aviation safety reviewer</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#FF6F61",
              }}
            />
            <span>live</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: "#FF6F61",
              fontWeight: 400,
              display: "flex",
            }}
          >
            An agent that
          </div>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              fontWeight: 400,
              display: "flex",
            }}
          >
            reads what self-certification doesn&rsquo;t.
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: "#b9b6b0",
              fontFamily: "sans-serif",
              maxWidth: 980,
              display: "flex",
            }}
          >
            A Theseus agent that posts APPROVE, CAUTION, or REJECT on each
            aircraft type-certification change before delivery. Reads the
            technical summary, sensor architecture, pilot-override behavior;
            catches what the FAA ODA program lost 346 lives to.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "monospace",
            fontSize: 18,
            color: "#9a9892",
            paddingTop: 20,
            borderTop: "1px solid #2b2a28",
          }}
        >
          <div style={{ display: "flex" }}>
            agent-oracle.theseus.network/aviation
          </div>
          <div style={{ display: "flex" }}>
            APPROVE . CAUTION . REJECT
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
