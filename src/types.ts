export interface CostState {
  turns: number;
  cumul_chars: number;
  last_ts: number;
  pct: number;
  est_ctx: number;
  est_output: number;
  cost: number;
  level: "normal" | "warning" | "danger";
  warnings: string[];
  breakdown: {
    system: number;
    conversation: number;
    tool_io: number;
  };
  history: Array<{
    turn: number;
    pct: number;
    cost: number;
  }>;
}
