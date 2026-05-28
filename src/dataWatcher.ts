import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CostState } from "./types";

export class CostDataWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private fsWatcher: fs.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private onUpdate: (data: CostState | null) => void;

  constructor(onUpdate: (data: CostState | null) => void) {
    this.onUpdate = onUpdate;
  }

  init() {
    this.watchAllWorkspaces();
    vscode.workspace.onDidChangeWorkspaceFolders(
      () => this.watchAllWorkspaces(),
      null,
      this.disposables
    );
  }

  private watchAllWorkspaces() {
    this.stopFsWatch();

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return;

    for (const folder of folders) {
      // Watch both .codebuddy/hooks/ and .cursor/hooks/ for compatibility
      const pathsToWatch = [
        path.join(folder.uri.fsPath, ".codebuddy", "hooks", ".cost-state.json"),
        path.join(folder.uri.fsPath, ".cursor", "hooks", ".cost-state.json")
      ];

      for (const statePath of pathsToWatch) {
        this.tryWatch(statePath);
        this.readAndEmit(statePath);
      }
    }
  }

  private tryWatch(filePath: string) {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);

    try {
      if (!fs.existsSync(dir)) return;

      this.fsWatcher = fs.watch(dir, (eventType, filename) => {
        if (filename !== base) return;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.readAndEmit(filePath), 200);
      });
    } catch {
      // directory may not exist yet; silently ignore
    }
  }

  private readAndEmit(filePath: string) {
    try {
      if (!fs.existsSync(filePath)) return;
      const raw = fs.readFileSync(filePath, "utf-8");
      const data: CostState = JSON.parse(raw);
      this.onUpdate(data);
    } catch {
      // malformed JSON or file locked; skip
    }
  }

  resetState() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    for (const folder of folders) {
      // Reset both .codebuddy/hooks/ and .cursor/hooks/ for compatibility
      const pathsToReset = [
        path.join(folder.uri.fsPath, ".codebuddy", "hooks", ".cost-state.json"),
        path.join(folder.uri.fsPath, ".cursor", "hooks", ".cost-state.json")
      ];

      for (const statePath of pathsToReset) {
        try {
          if (fs.existsSync(statePath)) {
            fs.writeFileSync(
              statePath,
              JSON.stringify({ turns: 0, cumul_chars: 0, last_ts: 0 }, null, 2),
              "utf-8"
            );
          }
        } catch {
          // ignore
        }
      }
    }
    this.onUpdate(null);
  }

  private stopFsWatch() {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
  }

  dispose() {
    this.stopFsWatch();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.disposables.forEach((d) => d.dispose());
  }
}
