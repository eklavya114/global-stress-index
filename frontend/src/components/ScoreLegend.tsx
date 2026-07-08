import { motion } from "framer-motion";

const STOPS = [
  { label: "0", color: "#064e3b" },
  { label: "20", color: "#166534" },
  { label: "35", color: "#ca8a04" },
  { label: "50", color: "#ea580c" },
  { label: "65", color: "#dc2626" },
  { label: "100", color: "#7f1d1d" },
];

export default function ScoreLegend() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="absolute bottom-14 left-5 z-10 rounded-xl px-4 py-3"
      style={{
        background: "rgba(2,8,20,0.82)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        minWidth: 180,
      }}
    >
      <div className="text-xs text-slate-500 tracking-widest uppercase mb-2.5">Stress Level</div>

      {/* Gradient bar */}
      <div
        className="h-2 rounded-full w-full mb-1.5"
        style={{
          background: `linear-gradient(to right, ${STOPS.map((s) => s.color).join(", ")})`,
        }}
      />

      <div className="flex justify-between text-xs text-slate-600">
        <span>Stable</span>
        <span>Crisis</span>
      </div>

      {/* No data indicator */}
      <div className="mt-2.5 pt-2.5 flex items-center gap-2 text-xs text-slate-600" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: "#1a2f4e" }} />
        No data available
      </div>
    </motion.div>
  );
}
