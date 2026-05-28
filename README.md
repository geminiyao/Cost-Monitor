# Cost Monitor HUD

Persistent HUD showing AI context usage, token cost, and session health across IDE and CLI environments.

## Overview

This project provides token usage monitoring for AI coding assistants. It consists of two main components:

1. **VS Code Extension** (`.vsix`) - Installed in Cursor IDE or CodeBuddy IDE to display token usage
2. **Python Hook** (`cost-monitor.py`) - Runs after each AI response to collect usage data

**Supported Environments:**
- ✅ **Cursor IDE** - Extension + Hook (via `.cursor/hooks/`)
- ✅ **CodeBuddy IDE** - Extension + Hook (via `.codebuddy/hooks/`)
- ✅ **Claude Code CLI** - Statusline plugin (via `cli-plugin/`)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Coding Session                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │        cost-monitor.py (Hook)           │
        │  - Reads session data from stdin        │
        │  - Calculates token usage & cost       │
        └─────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │  .cost-state.json   │         │   stdout (terminal)  │
    │  (for VS Code Ext)  │         │  (for CLI statusline)│
    └─────────────────────┘         └─────────────────────┘
              │                               │
              ▼                               ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │  VS Code Extension  │         │  Claude Code /      │
    │  - Status Bar HUD   │         │  CodeBuddy CLI      │
    │  - Sidebar Panel    │         │  - Terminal output   │
    └─────────────────────┘         └─────────────────────┘
```

**Data Flow:**
1. AI responds → Hook triggered
2. `cost-monitor.py` reads session data → writes `.cost-state.json`
3. VS Code extension watches `.cost-state.json` → updates UI
4. CLI mode: `cost-monitor.py` outputs to stdout → terminal display

## Installation

### Prerequisites

- Node.js (for building the extension)
- Python 3.x (for running the hook)
- VS Code / Cursor / CodeBuddy IDE

### Build the Extension

```bash
# Clone the repository
git clone https://github.com/geminiyao/Cost-Monitor.git
cd Cost-Monitor

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package as .vsix
npm run package
```

Output: `cost-monitor-hud-0.1.0.vsix`

### Install Extension to IDE

**Cursor IDE:**
```bash
cursor --install-extension cost-monitor-hud-0.1.0.vsix --force
```

**CodeBuddy IDE:**
```bash
codebuddy --install-extension cost-monitor-hud-0.1.0.vsix --force
```

## Configuration

### Cursor IDE Setup

Cursor uses `.cursor/hooks/hooks.json` to configure hooks.

**Step 1: Copy hook script**
```bash
mkdir -p .cursor/hooks
cp cost-monitor.py .cursor/hooks/
```

**Step 2: Configure hooks**
Create/edit `.cursor/hooks/hooks.json`:
```json
{
  "hooks": {
    "afterAgentResponse": [
      {
        "type": "command",
        "command": "python .cursor/hooks/cost-monitor.py --cursor",
        "description": "Cost Monitor: track token usage"
      }
    ]
  }
}
```

**Key points:**
- Hook event: `afterAgentResponse`
- Command: `python .cursor/hooks/cost-monitor.py --cursor` (note `--cursor` flag)
- Output: `.cursor/hooks/.cost-state.json` (watched by extension)

### CodeBuddy IDE Setup

CodeBuddy uses `.codebuddy/settings.json` to configure hooks.

**Step 1: Copy hook script**
```bash
mkdir -p .codebuddy/hooks
cp cost-monitor.py .codebuddy/hooks/
```

**Step 2: Configure hooks**
Create/edit `.codebuddy/settings.json`:
```json
{
  "hooks": {
    "afterResponse": [
      {
        "type": "command",
        "command": "python .codebuddy/hooks/cost-monitor.py",
        "description": "Cost Monitor: track token usage"
      }
    ]
  }
}
```

**Key points:**
- Hook event: `afterResponse` (may vary by version, check docs)
- Command: `python .codebuddy/hooks/cost-monitor.py` (no `--cursor` flag)
- Output: `.codebuddy/hooks/.cost-state.json` (watched by extension)

**Note:** The exact hook event name depends on your CodeBuddy IDE version. Check the documentation for the correct event name (could be `afterResponse`, `onReply`, `postMessage`, etc.).

### Claude Code CLI Setup

For CLI usage, use the statusline plugin:

**Option A: Install via plugin system**
```bash
claude /plugin install cost-monitor-hud
```

**Option B: Manual setup**
Copy `cli-plugin/` to your Claude Code plugins directory.

## Configuration Differences Summary

| Aspect | Cursor IDE | CodeBuddy IDE | Claude Code CLI |
|--------|-------------|----------------|-----------------|
| **Hook config file** | `.cursor/hooks/hooks.json` | `.codebuddy/settings.json` | N/A (plugin system) |
| **Hook event** | `afterAgentResponse` | `afterResponse`* | N/A |
| **Hook command** | `python ... --cursor` | `python ...` (no flag) | N/A |
| **Output location** | `.cursor/hooks/.cost-state.json` | `.codebuddy/hooks/.cost-state.json` | stdout (terminal) |
| **Extension watches** | `.cursor/hooks/.cost-state.json` | `.codebuddy/hooks/.cost-state.json` | N/A |

*`afterResponse` may vary by CodeBuddy version

## Troubleshooting

### "Waiting for session data..." in IDE

**Cause:** The `.cost-state.json` file is not being generated.

**Solution:**
1. Check if hook is configured correctly
2. Verify `cost-monitor.py` is in the right location
3. Start a chat and check if `.cost-state.json` is created

**Debug steps:**
```bash
# Check if hook script exists
ls -la .cursor/hooks/cost-monitor.py  # Cursor
ls -la .codebuddy/hooks/cost-monitor.py  # CodeBuddy

# Manual test
echo '{"transcript_path": "test.jsonl"}' | python .cursor/hooks/cost-monitor.py --cursor
ls -la .cursor/hooks/.cost-state.json
```

### Chart aspect ratio issue

**Cause:** Canvas chart doesn't resize properly when sidebar is widened.

**Status:** Fixed in latest version. If you still see issues, rebuild the extension.

### Hook not running

**Check hook configuration:**
- Cursor: `.cursor/hooks/hooks.json`
- CodeBuddy: `.codebuddy/settings.json`

**Verify Python is available:**
```bash
python --version
# or
python3 --version
```

## Project Structure

```
Cost-Monitor/
├── src/                    # TypeScript source (extension)
│   ├── extension.ts        # Extension entry point
│   ├── statusBar.ts        # Status bar HUD
│   ├── sidebarProvider.ts  # Sidebar webview with chart
│   ├── dataWatcher.ts      # Watches .cost-state.json
│   └── types.ts           # Type definitions
├── cli-plugin/            # CLI plugin for Claude Code
│   ├── plugin.json        # Plugin metadata
│   └── statusline.js      # Statusline renderer
├── cost-monitor.py        # Python hook (MUST be deployed to project)
├── media/                 # Icons and images
├── out/                   # Compiled JavaScript (generated)
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript config
└── README.md             # This file
```

## Development

### Build from source

```bash
npm install
npm run compile
npm run package  # Creates cost-monitor-hud-0.1.0.vsix
```

### Watch mode (auto-recompile)

```bash
npm run watch
```

### Test the extension

1. Build the `.vsix`
2. Install to Cursor/CodeBuddy
3. Reload the IDE
4. Start a chat to trigger the hook
5. Check the Cost Monitor panel

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
