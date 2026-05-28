# Cost Monitor HUD

Persistent HUD showing AI context usage, token cost, and session health across IDE and CLI environments.

## IDE Extension (Cursor / CodeBuddy IDE)

### What it does

- **Status Bar**: Always-visible item at the bottom showing `T5 | 32% | $0.15`
  - Green (normal), yellow background (>40%), red background (>70%)
  - Click to open the detail sidebar
- **Sidebar Panel**: Full breakdown with progress bar, token distribution, trend chart, and warnings

### Install

```bash
# From the project root
cd cost-monitor-hud
npm install
npm run compile
npm run package

# Install into Cursor
cursor --install-extension cost-monitor-hud-0.1.0.vsix --force

# Install into CodeBuddy IDE (if CLI available)
codebuddy --install-extension cost-monitor-hud-0.1.0.vsix --force
```

### Data Source

The extension watches `.codebuddy/hooks/.cost-state.json` which is written by the `cost-monitor.py` hook on every AI response. No extra configuration needed.

## Claude Code CLI

### Option A: Install claude-hud (recommended)

```bash
claude /plugin install claude-hud
```

### Option B: Use the custom statusline plugin

The plugin at `.codebuddy/plugins/cost-monitor-hud/` works with both Claude Code and CodeBuddy Code CLI.

## Architecture

```
cost-monitor.py (hook)
    ├── writes → .cost-state.json (structured data)
    │               └── watched by → VSCode Extension (Status Bar + Sidebar)
    └── stdout → Claude Code / CodeBuddy Code CLI (additional_context injection)
```
