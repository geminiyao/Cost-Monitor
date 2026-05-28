import * as vscode from "vscode";
import { CostStatusBar } from "./statusBar";
import { CostSidebarProvider } from "./sidebarProvider";
import { CostDataWatcher } from "./dataWatcher";

let statusBar: CostStatusBar;
let watcher: CostDataWatcher;

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new CostSidebarProvider(context.extensionUri);

  statusBar = new CostStatusBar();
  watcher = new CostDataWatcher((data) => {
    statusBar.update(data);
    sidebarProvider.update(data);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "costMonitor.sidebar",
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("costMonitor.showDetail", () => {
      vscode.commands.executeCommand("costMonitor.sidebar.focus");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("costMonitor.reset", () => {
      watcher.resetState();
      statusBar.update(null);
      sidebarProvider.update(null);
      vscode.window.showInformationMessage("Cost Monitor: Session reset.");
    })
  );

  context.subscriptions.push(statusBar, watcher);

  watcher.init();

  // Send initial status to sidebar
  const initialStatus = watcher.getStatus();
  sidebarProvider.updateStatus(initialStatus);
}

export function deactivate() {}
