// Design tokens — lifted from the prototype so the build stays visually faithful.
export const C = {
  ink: "#16131F",
  panel: "#1F1A2C",
  panel2: "#272035",
  gold: "#EBB45C",
  goldSoft: "#F4D49A",
  blush: "#E6A1AB",
  ivory: "#F6F0E8",
  muted: "#A99BBC",
  line: "rgba(246,240,232,0.10)",
} as const;

export const display = "'Cormorant Garamond', Georgia, serif";
export const ui = "'Figtree', system-ui, sans-serif";

export const btnGold: React.CSSProperties = {
  width: "100%",
  padding: "16px",
  borderRadius: 16,
  border: "none",
  background: `linear-gradient(180deg,${C.goldSoft},${C.gold})`,
  color: "#2A1E08",
  fontWeight: 700,
  fontSize: 16,
  boxShadow: "0 8px 30px rgba(235,180,92,.3)",
};
