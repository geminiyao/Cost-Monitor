import * as vscode from "vscode";
import { CostState } from "./types";

export class CostSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private latestData: CostState | null = null;
  private latestStatus: any = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();
    if (this.latestData) {
      this.postData(this.latestData);
    }
    if (this.latestStatus) {
      this.postStatus(this.latestStatus);
    }
  }

  update(data: CostState | null) {
    this.latestData = data;
    if (this.view) {
      this.postData(data);
    }
  }

  updateStatus(status: any) {
    this.latestStatus = status;
    if (this.view) {
      this.postStatus(status);
    }
  }

  private postData(data: CostState | null) {
    this.view?.webview.postMessage({ type: "update", data });
  }

  private postStatus(status: any) {
    this.view?.webview.postMessage({ type: "status", status });
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  :root {
    --green: #4ec9b0;
    --yellow: #cca700;
    --red: #f14c4c;
    --fg: var(--vscode-foreground);
    --bg: var(--vscode-sideBar-background);
    --muted: var(--vscode-descriptionForeground);
    --border: var(--vscode-panel-border);
    --badge-bg: var(--vscode-badge-background);
    --badge-fg: var(--vscode-badge-foreground);
  }
  * { box-sizing: border-box; margin:0; padding:0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--fg);
    background: var(--bg);
    padding: 12px;
    line-height: 1.5;
  }
  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .hero {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .hero-turn { font-size: 20px; font-weight: 700; }
  .hero-pct { font-size: 20px; font-weight: 700; }
  .hero-cost { font-size: 16px; color: var(--muted); }

  .bar-container {
    width: 100%;
    height: 14px;
    background: var(--vscode-input-background);
    border-radius: 7px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .bar-fill {
    height: 100%;
    border-radius: 7px;
    transition: width 0.4s ease, background 0.4s ease;
  }
  .bar-label {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
  }

  .breakdown-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 12px;
  }
  .breakdown-label { width: 90px; color: var(--muted); }
  .breakdown-bar {
    flex: 1;
    height: 8px;
    background: var(--vscode-input-background);
    border-radius: 4px;
    overflow: hidden;
  }
  .breakdown-fill {
    height: 100%;
    border-radius: 4px;
    background: var(--green);
    transition: width 0.4s ease;
  }
  .breakdown-val { width: 50px; text-align: right; font-variant-numeric: tabular-nums; }

  .warning-box {
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .warning-box.warning {
    background: rgba(204,167,0,0.15);
    border-left: 3px solid var(--yellow);
    color: var(--yellow);
  }
  .warning-box.danger {
    background: rgba(241,76,76,0.15);
    border-left: 3px solid var(--red);
    color: var(--red);
  }

  .chart-container {
    width: 100%;
    height: 80px;
    position: relative;
  }
  canvas { width: 100%; height: 100%; display: block; }

  .empty-state {
    text-align: center;
    color: var(--muted);
    padding: 20px 0;
  }
  .empty-state .icon { font-size: 32px; margin-bottom: 8px; }
  .diag-info {
    text-align: left;
    font-size: 11px;
    color: var(--muted);
    margin-top: 12px;
    padding: 8px;
    background: var(--vscode-input-background);
    border-radius: 4px;
  }
  .diag-info h3 {
    font-size: 11px;
    margin-bottom: 4px;
    color: var(--fg);
  }
  .diag-info ul {
    margin: 0;
    padding-left: 16px;
  }
  .diag-info li {
    margin-bottom: 2px;
  }
  .diag-path {
    font-family: monospace;
    font-size: 10px;
    word-break: break-all;
  }
</style>
</head>
<body>
<div id="app">
  <div class="empty-state">
    <div class="icon">&#9889;</div>
    <div>Waiting for session data...</div>
    <div style="font-size:11px;margin-top:4px;">Start a chat to see cost monitoring</div>
    <div id="diag"></div>
  </div>
</div>
<script>
(function() {
  const app = document.getElementById('app');
  const vscode = acquireVsCodeApi();
  let currentStatus = null;

  function fmtTok(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (n >= 1e3) return Math.round(n/1e3)+'K';
    return String(n);
  }

  function levelColor(level) {
    if (level === 'danger') return 'var(--red)';
    if (level === 'warning') return 'var(--yellow)';
    return 'var(--green)';
  }

  function renderDiag(status) {
    const diag = document.getElementById('diag');
    if (!diag || !status) return;
    
    let html = '<div class="diag-info">';
    html += '<h3>Diagnostic Info</h3>';
    
    // Workspace folders
    if (!status.workspaceFolders || status.workspaceFolders.length === 0) {
      html += '<div style="color:var(--red);">No workspace folder open</div>';
      html += '<div>Open a folder to use Cost Monitor</div>';
    } else {
      html += '<div>Workspace folders:</div><ul>';
      status.workspaceFolders.forEach(f => {
        html += '<li class="diag-path">' + f + '</li>';
      });
      html += '</ul>';
      
      // Watching paths
      if (status.watchingPaths && status.watchingPaths.length > 0) {
        html += '<div>Watching:</div><ul>';
        status.watchingPaths.forEach(p => {
          const exists = status.foundStateFiles && status.foundStateFiles.includes(p);
          html += '<li class="diag-path">' + p + (exists ? ' ✓' : ' (not found)') + '</li>';
        });
        html += '</ul>';
      }
      
      if (!status.foundStateFiles || status.foundStateFiles.length === 0) {
        html += '<div style="color:var(--yellow);margin-top:4px;">No .cost-state.json found</div>';
        html += '<div>Hook may not have run yet. Try starting a chat.</div>';
      }
    }
    
    html += '</div>';
    diag.innerHTML = html;
  }

  function render(d) {
    if (!d || !d.turns) {
      app.innerHTML = '<div class="empty-state"><div class="icon">&#9889;</div><div>Waiting for session data...</div><div style="font-size:11px;margin-top:4px;">Start a chat to see cost monitoring</div><div id="diag"></div></div>';
      if (currentStatus) renderDiag(currentStatus);
      return;
    }
    const color = levelColor(d.level);
    const pct = d.pct || 0;
    const maxTok = 200000;

    let warnings = '';
    if (d.warnings && d.warnings.length) {
      d.warnings.forEach(w => {
        const cls = d.level === 'danger' ? 'danger' : 'warning';
        warnings += '<div class="warning-box '+cls+'">'+w+'</div>';
      });
    }

    const bd = d.breakdown || {system:0, conversation:0, tool_io:0};
    const total = bd.system + bd.conversation + bd.tool_io || 1;

    const hist = d.history || [];

    app.innerHTML = \`
      \${warnings}
      <div class="section">
        <div class="hero">
          <span class="hero-turn">Turn \${d.turns}</span>
          <span class="hero-pct" style="color:\${color}">\${pct}%</span>
          <span class="hero-cost">$\${(d.cost||0).toFixed(2)}</span>
        </div>
        <div class="bar-container">
          <div class="bar-fill" style="width:\${pct}%;background:\${color}"></div>
        </div>
        <div class="bar-label">
          <span>~\${fmtTok(d.est_ctx||0)} tokens</span>
          <span>\${fmtTok(maxTok)} max</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Breakdown</div>
        <div class="breakdown-row">
          <span class="breakdown-label">System</span>
          <div class="breakdown-bar"><div class="breakdown-fill" style="width:\${(bd.system/total*100).toFixed(1)}%"></div></div>
          <span class="breakdown-val">~\${fmtTok(bd.system)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">Conversation</span>
          <div class="breakdown-bar"><div class="breakdown-fill" style="width:\${(bd.conversation/total*100).toFixed(1)}%"></div></div>
          <span class="breakdown-val">~\${fmtTok(bd.conversation)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">Tool I/O</span>
          <div class="breakdown-bar"><div class="breakdown-fill" style="width:\${(bd.tool_io/total*100).toFixed(1)}%"></div></div>
          <span class="breakdown-val">~\${fmtTok(bd.tool_io)}</span>
        </div>
      </div>

      \${hist.length > 1 ? \`
      <div class="section">
        <div class="section-title">Context Trend</div>
        <div class="chart-container">
          <canvas id="trendChart"></canvas>
        </div>
      </div>\` : ''}
    \`;

    if (hist.length > 1) drawChart(hist);
  }

  let currentHist = [];
  let resizeObserver = null;

  function drawChart(hist) {
    currentHist = hist;
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (currentHist.length > 0) {
          drawChartInner(currentHist);
        }
      });
      resizeObserver.observe(canvas.parentElement);
    }

    drawChartInner(hist);
  }

  function drawChartInner(hist) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = {t:8, r:8, b:18, l:30};
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    ctx.clearRect(0, 0, W, H);

    const style = getComputedStyle(document.documentElement);
    const muted = style.getPropertyValue('--muted').trim() || '#666';
    ctx.strokeStyle = muted;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(v => {
      const y = pad.t + ch - (v/100)*ch;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l+cw, y); ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.setLineDash([4,4]);
    ctx.lineWidth = 1;
    const warnY = pad.t + ch - (40/100)*ch;
    ctx.strokeStyle = 'rgba(204,167,0,0.5)';
    ctx.beginPath(); ctx.moveTo(pad.l, warnY); ctx.lineTo(pad.l+cw, warnY); ctx.stroke();
    const dangerY = pad.t + ch - (70/100)*ch;
    ctx.strokeStyle = 'rgba(241,76,76,0.5)';
    ctx.beginPath(); ctx.moveTo(pad.l, dangerY); ctx.lineTo(pad.l+cw, dangerY); ctx.stroke();
    ctx.setLineDash([]);

    const pts = hist.map((h, i) => ({
      x: pad.l + (hist.length === 1 ? cw/2 : (i/(hist.length-1))*cw),
      y: pad.t + ch - (h.pct/100)*ch
    }));
    const green = style.getPropertyValue('--green').trim() || '#4ec9b0';
    ctx.strokeStyle = green;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    ctx.globalAlpha = 0.1;
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad.t + ch);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, pad.t + ch);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    pts.forEach(p => {
      ctx.fillStyle = green;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      ctx.fill();
    });

    ctx.fillStyle = muted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    [0, 50, 100].forEach(v => {
      const y = pad.t + ch - (v/100)*ch;
      ctx.fillText(v+'%', pad.l - 4, y + 3);
    });

    ctx.textAlign = 'center';
    if (hist.length <= 10) {
      hist.forEach((h, i) => {
        ctx.fillText('T'+h.turn, pts[i].x, H - 2);
      });
    } else {
      const step = Math.ceil(hist.length / 6);
      for (let i = 0; i < hist.length; i += step) {
        ctx.fillText('T'+hist[i].turn, pts[i].x, H - 2);
      }
    }
  }

  window.addEventListener('message', e => {
    if (e.data.type === 'update') render(e.data.data);
    if (e.data.type === 'status') {
      currentStatus = e.data.status;
      // Re-render diag if in empty state
      const diag = document.getElementById('diag');
      if (diag && !e.data.data) renderDiag(currentStatus);
    }
  });

  const prev = vscode.getState();
  if (prev && prev.data) render(prev.data);
  if (prev && prev.status) { currentStatus = prev.status; renderDiag(currentStatus); }

  window.addEventListener('message', e => {
    if (e.data.type === 'update') vscode.setState({data: e.data.data, status: currentStatus});
    if (e.data.type === 'status') vscode.setState({data: e.data.data, status: e.data.status});
  });
})();
</script>
</body>
</html>`;
  }
}
