import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CostState } from "./types";

export interface WatcherStatus {
  workspaceFolders: string[];
  watchingPaths: string[];
  foundStateFiles: string[];
}

export class CostDataWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private fsWatchers: fs.FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private onUpdate: (data: CostState | null) => void;
  private watchedPaths: Set<string> = new Set();

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

  getStatus(): WatcherStatus {
    const folders = vscode.workspace.workspaceFolders;
    const workspaceFolders = folders ? folders.map(f => f.uri.fsPath) : [];
    
    const watchingPaths: string[] = [];
    const foundStateFiles: string[] = [];
    
    for (const folder of workspaceFolders) {
      const pathsToCheck = [
        path.join(folder, ".codebuddy", "hooks", ".cost-state.json"),
        path.join(folder, ".cursor", "hooks", ".cost-state.json")
      ];
      
      for (const statePath of pathsToCheck) {
        watchingPaths.push(statePath);
        if (fs.existsSync(statePath)) {
          foundStateFiles.push(statePath);
        }
      }
    }
    
    return { workspaceFolders, watchingPaths, foundStateFiles };
  }

  private watchAllWorkspaces() {
    this.stopFsWatch();
    this.watchedPaths.clear();

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      console.log("[CostMonitor] No workspace folders found");
      return;
    }

    for (const folder of folders) {
      const pathsToWatch = [
        path.join(folder.uri.fsPath, ".codebuddy", "hooks", ".cost-state.json"),
        path.join(folder.uri.fsPath, ".cursor", "hooks", ".cost-state.json")
      ];

      for (const statePath of pathsToWatch) {
        const dir = path.dirname(statePath);
        if (!fs.existsSync(dir)) {
          try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[CostMonitor] Created directory: ${dir}`);
          } catch (err) {
            console.log(`[CostMonitor] Failed to create directory ${dir}:`, err);
            continue;
          }
        }

        this.tryWatch(statePath);
        this.readAndEmit(statePath);
      }
    }
  }

  private tryWatch(filePath: string) {
    if (this.watchedPaths.has(filePath)) {
      return;
    }

    const dir = path.dirname(filePath);
    const base = path.basename(filePath);

    try {
      if (!fs.existsSync(dir)) {
        console.log(`[CostMonitor] Directory does not exist: ${dir}`);
        return;
      }

      const watcher = fs.watch(dir, (eventType, filename) => {
        if (filename !== base) return;
        console.log(`[CostMonitor] File changed: ${filePath}`);
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.readAndEmit(filePath), 200);
      });

      this.fsWatchers.push(watcher);
      this.watchedPaths.add(filePath);
      console.log(`[CostMonitor] Watching: ${filePath}`);
    } catch (err) {
      console.log(`[CostMonitor] Failed to watch ${filePath}:`, err);
    }
  }

  private readAndEmit(filePath: string) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`[CostMonitor] File not found: ${filePath}`);
        return;
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const data: CostState = JSON.parse(raw);
      console.log(`[CostMonitor] Read data from ${filePath}:`, {
        turns: data.turns,
        pct: data.pct,
        cost: data.cost
      });
      this.onUpdate(data);
    } catch (err) {
      console.log(`[CostMonitor] Failed to read ${filePath}:`, err);
    }
  }

  resetState() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    for (const folder of folders) {
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
    for (const watcher of this.fsWatchers) {
      watcher.close();
    }
    this.fsWatchers = [];
    this.watchedPaths.clear();
  }

  dispose() {
    this.stopFsWatch();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.disposables.forEach((d) => d.dispose());
  }
}
