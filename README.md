# Cost Monitor HUD

Persistent HUD showing AI context usage, token cost, and session health across IDE and CLI environments.

## Quick Start

### For Cursor IDE Users

1. **Install the extension:**
   ```bash
   cursor --install-extension cost-monitor-hud-0.1.0.vsix --force
   ```

2. **Configure the hook:**
   ```bash
   mkdir -p .cursor/hooks
   cp cost-monitor.py .cursor/hooks/
   ```
   
   Create `.cursor/hooks/hooks.json`:
   ```json
   {
     "hooks": {
       "afterAgentResponse": [
         {
           "type": "command",
           "command": "python .cursor/hooks/cost-monitor.py --cursor"
         }
       ]
     }
   }
   ```

3. **Restart Cursor** and start chatting!

### For CodeBuddy IDE Users

1. **Install the extension:**
   - Open CodeBuddy IDE
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Install from VSIX"
   - Select `cost-monitor-hud-0.1.0.vsix`

2. **Configure the hook:**
   ```bash
   mkdir -p .codebuddy/hooks
   cp cost-monitor.py .codebuddy/hooks/
   ```
   
   Create/edit `.codebuddy/settings.json`:
   ```json
   {
     "hooks": {
       "Stop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "python \"$CODEBUDDY_PROJECT_DIR/.codebuddy/hooks/cost-monitor.py\""
             }
           ]
         }
       ]
     }
   }
   ```

3. **Restart CodeBuddy IDE** and start chatting!

### For Claude Code CLI Users

1. **Install the plugin:**
   ```bash
   claude /plugin install cost-monitor-hud
   ```

2. **Or manually copy** `cli-plugin/` to your Claude Code plugins directory.

3. **Start Claude Code** - the statusline will appear automatically.

---

## What It Does

### VS Code Extension (Cursor & CodeBuddy IDE)

- **Status Bar**: Always-visible item at the bottom showing `T5 | 32% | $0.15`
  - Green (normal), yellow background (>40%), red background (>70%)
  - Click to open the detail sidebar
- **Sidebar Panel**: Full breakdown with progress bar, token distribution, trend chart, and warnings

### CLI Plugin (Claude Code & CodeBuddy CLI)

- **Terminal Output**: Rich terminal UI showing context usage, cost, and warnings after each response

---

## Detailed Installation Guide

### Prerequisites

- **Node.js** (v18+) - for building the extension from source
- **Python 3.x** - for running the hook script
- **VS Code / Cursor / CodeBuddy IDE** - for running the extension

### Build from Source (Optional)

If you want to build the extension yourself:

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

### Install Pre-built Extension

Download the latest `cost-monitor-hud-0.1.0.vsix` from the [Releases](https://github.com/geminiyao/Cost-Monitor/releases) page.

#### Cursor IDE

```bash
cursor --install-extension cost-monitor-hud-0.1.0.vsix --force
```

#### CodeBuddy IDE

**Method 1 - Via UI:**
1. Open CodeBuddy IDE
2. Press `Ctrl+Shift+P`
3. Type "Install from VSIX"
4. Select the `.vsix` file

**Method 2 - Via command line** (if `codebuddy` command is available):
```bash
codebuddy --install-extension cost-monitor-hud-0.1.0.vsix --force
```

#### VS Code (Standard)

```bash
code --install-extension cost-monitor-hud-0.1.0.vsix --force
```

---

## Detailed Configuration Guide

### Cursor IDE Configuration

Cursor uses `.cursor/hooks/hooks.json` to configure hooks.

#### Step 1: Copy Hook Script

```bash
mkdir -p .cursor/hooks
cp /path/to/cost-monitor.py .cursor/hooks/
```

#### Step 2: Create Hook Configuration

Create or edit `.cursor/hooks/hooks.json`:

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

**Important:**
- Hook event: `afterAgentResponse` (triggered after each AI response)
- Command: `python .cursor/hooks/cost-monitor.py --cursor` (note the `--cursor` flag)
- Output: `.cursor/hooks/.cost-state.json` (watched by the extension)

#### Step 3: Verify Configuration

1. Start a chat in Cursor
2. Check if `.cursor/hooks/.cost-state.json` is created
3. The Cost Monitor extension should show data

**Manual Test:**
```bash
echo '{}' | python .cursor/hooks/cost-monitor.py --cursor
ls -la .cursor/hooks/.cost-state.json
```

---

### CodeBuddy IDE Configuration

CodeBuddy uses `.codebuddy/settings.json` to configure hooks.

#### Step 1: Copy Hook Script

```bash
mkdir -p .codebuddy/hooks
cp /path/to/cost-monitor.py .codebuddy/hooks/
```

#### Step 2: Create Hook Configuration

Create or edit `.codebuddy/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python \"$CODEBUDDY_PROJECT_DIR/.codebuddy/hooks/cost-monitor.py\""
          }
        ]
      }
    ]
  }
}
```

**Important:**
- Hook event: `Stop` (triggered when AI stops responding)
- Command: Uses `$CODEBUDDY_PROJECT_DIR` environment variable
- Output: `.codebuddy/hooks/.cost-state.json` (watched by the extension)

**Note:** The exact hook event name may vary by CodeBuddy version. Check the documentation for the correct event name.

#### Step 3: Verify Configuration

1. Start a chat in CodeBuddy IDE
2. Check if `.codebuddy/hooks/.cost-state.json` is created
3. The Cost Monitor extension should show data

**Manual Test:**
```bash
echo '{"transcript_path": ""}' | python .codebuddy/hooks/cost-monitor.py
ls -la .codebuddy/hooks/.cost-state.json
```

---

### Claude Code CLI Configuration

For CLI usage, use the statusline plugin.

#### Option A: Install via Plugin System

```bash
claude /plugin install cost-monitor-hud
```

#### Option B: Manual Setup

Copy `cli-plugin/` directory to your Claude Code plugins directory:

```bash
cp -r cli-plugin ~/.claude/plugins/cost-monitor-hud
```

Or follow Claude Code's plugin installation documentation.

---

## Configuration Differences

| Aspect | Cursor IDE | CodeBuddy IDE | Claude Code CLI |
|--------|-------------|----------------|-----------------|
| **Config File** | `.cursor/hooks/hooks.json` | `.codebuddy/settings.json` | Plugin system |
| **Hook Event** | `afterAgentResponse` | `Stop` | N/A |
| **Hook Command** | `python ... --cursor` | `python ...` | N/A |
| **Output** | `.cursor/hooks/.cost-state.json` | `.codebuddy/hooks/.cost-state.json` | stdout (terminal) |
| **Extension Watches** | `.cursor/hooks/.cost-state.json` | `.codebuddy/hooks/.cost-state.json` | N/A |

---

## Troubleshooting

### "Waiting for session data..." in IDE

**Cause:** The `.cost-state.json` file is not being generated.

**Solution:**
1. Check if hook is configured correctly
2. Verify `cost-monitor.py` is in the right location
3. Start a chat and check if `.cost-state.json` is created

**Debug Steps:**
```bash
# Check if hook script exists
ls -la .cursor/hooks/cost-monitor.py  # Cursor
ls -la .codebuddy/hooks/cost-monitor.py  # CodeBuddy

# Manual test - Cursor mode
echo '{}' | python .cursor/hooks/cost-monitor.py --cursor
ls -la .cursor/hooks/.cost-state.json

# Manual test - CodeBuddy mode
echo '{"transcript_path": ""}' | python .codebuddy/hooks/cost-monitor.py
ls -la .codebuddy/hooks/.cost-state.json
```

### Chart Aspect Ratio Issue (Fixed)

**Cause:** Canvas chart doesn't resize properly when sidebar is widened.

**Status:** Fixed in v0.1.0. If you still see issues, rebuild the extension.

### Hook Not Running

**Check hook configuration:**
- Cursor: `.cursor/hooks/hooks.json`
- CodeBuddy: `.codebuddy/settings.json`

**Verify Python is available:**
```bash
python --version
# or
python3 --version
```

**Check hook event name:**
- Cursor: Should be `afterAgentResponse`
- CodeBuddy: Should be `Stop` (may vary by version)

### Extension Not Loading

**Check if extension is installed:**
```bash
# Cursor
cursor --list-extensions | grep cost-monitor

# CodeBuddy (if command available)
codebuddy --list-extensions | grep cost-monitor

# VS Code
code --list-extensions | grep cost-monitor
```

**Reinstall if needed:**
```bash
cursor --install-extension cost-monitor-hud-0.1.0.vsix --force
```

---

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

---

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
├── templates/             # Configuration templates
│   └── .codebuddy/
│       └── settings.json  # CodeBuddy settings template
├── test-hook.ps1         # Hook testing script (PowerShell)
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript config
└── README.md             # This file
```

---

## Development

### Build from Source

```bash
npm install
npm run compile
npm run package  # Creates cost-monitor-hud-0.1.0.vsix
```

### Watch Mode (Auto-recompile)

```bash
npm run watch
```

### Test the Extension

1. Build the `.vsix`
2. Install to Cursor/CodeBuddy
3. Reload the IDE
4. Start a chat to trigger the hook
5. Check the Cost Monitor panel

### Run Tests

```bash
# Test hook in CLI mode
echo '{"transcript_path": ""}' | python cost-monitor.py

# Test hook in Cursor mode
echo '{}' | python cost-monitor.py --cursor

# Check generated .cost-state.json
cat .codebuddy/hooks/.cost-state.json
cat .cursor/hooks/.cost-state.json
```

---

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

- **Issues**: [GitHub Issues](https://github.com/geminiyao/Cost-Monitor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/geminiyao/Cost-Monitor/discussions)

---

**Made with ❤️ for AI coding assistants**
