import { motion } from "framer-motion";

interface Props {
  label: string;
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#475569";
  if (score < 30)   return "#00ff88";
  if (score < 55)   return "#ffcc00";
  if (score < 75)   return "#ff8800";
  return "#ff3355";
}

function scoreBgGradient(score: number | null | undefined): string {
  const c = scoreColor(score);
  return `linear-gradient(90deg, ${c}44, ${c})`;
}

export default function ScoreCard({ label, score, size = "md" }: Props) {
  const color = scoreColor(score);
  const pct = score != null ? Math.min(score, 100) : 0;

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div
        className="font-bold tabular-nums leading-none"
        style={{
          color,
          fontSize: size === "lg" ? "2rem" : size === "sm" ? "1.1rem" : "1.5rem",
          textShadow: `0 0 18px ${color}44`,
        }}
      >
        {score != null ? score.toFixed(1) : "—"}
      </div>
      <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: scoreBgGradient(score) }}
        />
      </div>
    </div>
  );
}
