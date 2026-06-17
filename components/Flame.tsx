import { C } from "@/lib/theme";

export function Flame({ size = 22, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={glow ? { filter: `drop-shadow(0 0 6px ${C.gold})`, animation: "orxFlicker 3s ease-in-out infinite" } : {}}
    >
      <path
        d="M12 2c2.5 3 5 5.2 5 9a5 5 0 1 1-10 0c0-1.6.7-2.9 1.6-4 .2 1.2.9 2 1.9 2 .7-2.4-.5-4.6.5-7Z"
        fill={C.gold}
      />
      <path
        d="M12 12c1.3 1.2 2 2.2 2 3.6a2 2 0 1 1-4 0c0-1.1.6-1.9 1.2-2.6.1.6.4 1 .9 1 .3-1 0-1.4-.1-2Z"
        fill={C.blush}
        opacity=".9"
      />
    </svg>
  );
}
