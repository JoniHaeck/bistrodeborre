import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "75px 90px", background: "#f7f6ef", color: "#193e34" }}>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>✳ tafelvrij.</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 73, fontWeight: 700 }}>Meer tijd voor wat telt.</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: "#58745e" }}>Eenvoudig reserveren voor restaurants.</div>
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#58745e" }}>tafelvrij.be · Een product van Hawk-ICT</div>
    </div>,
    { width: 1200, height: 630 },
  );
}
