import { ImageResponse } from "next/og";

export const alt = "Precios de AdPropIA para administración inmobiliaria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #0b1738 0%, #0355e8 58%, #1472fa 100%)",
          color: "white",
          padding: 64,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            border: "2px solid rgba(255,255,255,0.28)",
            padding: 48,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>AdPropIA</div>
            <div style={{ fontSize: 24, opacity: 0.86 }}>Precios públicos</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -4, lineHeight: 0.95, maxWidth: 820 }}>
              Planes claros para operar mejor
            </div>
            <div style={{ fontSize: 32, lineHeight: 1.25, maxWidth: 760, opacity: 0.9 }}>
              Mensual, anual y adicionales operativos para administraciones inmobiliarias.
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, fontSize: 26, fontWeight: 700 }}>
            <span style={{ background: "white", color: "#0355e8", padding: "14px 20px" }}>Inicial</span>
            <span style={{ background: "white", color: "#0355e8", padding: "14px 20px" }}>Profesional</span>
            <span style={{ background: "white", color: "#0355e8", padding: "14px 20px" }}>Operativo</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
