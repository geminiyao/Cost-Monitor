import * as vscode from "vscode";
import { CostState } from "./types";

export class CostStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      50
    );
    this.item.command = "costMonitor.showDetail";
    this.item.tooltip = "Click to open Cost Monitor detail panel";
    this.item.text = "$(zap) Cost Monitor";
    this.item.show();
  }

  update(data: CostState | null) {
    if (!data || !data.turns) {
      this.item.text = "$(zap) Cost Monitor";
      this.item.backgroundColor = undefined;
      this.item.tooltip = "No session data yet";
      return;
    }

    const pct = data.pct ?? 0;
    const cost = data.cost ?? 0;
    const turns = data.turns ?? 0;

    this.item.text = `$(zap) T${turns} | ${pct}% | $${cost.toFixed(2)}`;

    if (data.level === "danger") {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
      this.item.tooltip = `Context ${pct}% — start a new chat!`;
    } else if (data.level === "warning") {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      this.item.tooltip = `Context ${pct}% — consider wrapping up`;
    } else {
      this.item.backgroundColor = undefined;
      this.item.tooltip = `Turn ${turns} · Context ${pct}% · ~${fmtTok(data.est_ctx)} tokens · $${cost.toFixed(2)}`;
    }
  }

  dispose() {
    this.item.dispose();
  }
}

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
