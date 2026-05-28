#!/usr/bin/env python3
"""
Cost Monitor Hook — real-time token usage + cost display.

Usage:
  CodeBuddy / Claude Code (Stop hook):  python cost-monitor.py
  Cursor (afterAgentResponse hook):     python cost-monitor.py --cursor
"""

import sys
import json
import os
import time
import io
from datetime import datetime

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Configuration ──────────────────────────────────────────────────────
MAX_CONTEXT_TOKENS = 200_000
WARN_PCT = 40
DANGER_PCT = 70
PRICE_INPUT_PER_M = 3.0
PRICE_OUTPUT_PER_M = 15.0
PRICE_CACHE_READ_PER_M = 0.3
BAR_WIDTH = 20
BAR_WIDTH_SMALL = 12
SESSION_TIMEOUT_SEC = 600  # 10 min — Cursor session detection
CHARS_PER_TOKEN = 3.0      # mixed content average

# ── ANSI Colors ────────────────────────────────────────────────────────
DIM       = "\033[2m"
RESET     = "\033[0m"
BOLD      = "\033[1m"
WHITE_B   = "\033[1;37m"
GREEN     = "\033[38;5;72m"
YELLOW    = "\033[38;5;178m"
RED       = "\033[38;5;167m"
YELLOW_B  = "\033[1;38;5;178m"
RED_B     = "\033[1;38;5;167m"
DARK_GRAY = "\033[38;5;238m"
GRAY      = "\033[38;5;245m"


def level_color(pct):
    if pct < WARN_PCT:
        return GREEN
    return YELLOW if pct < DANGER_PCT else RED


def bar(pct, width=BAR_WIDTH):
    filled = min(int(pct / 100 * width), width)
    c = level_color(pct)
    return f"{c}{'█' * filled}{DARK_GRAY}{'░' * (width - filled)}{RESET}"


def fmt_tok(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


# ── Transcript Analysis (CodeBuddy / Claude Code) ─────────────────────

def analyze_transcript(path):
    if not path or not os.path.exists(path):
        return None

    user_turns = 0
    total_input = total_output = total_cache_read = total_cache_create = 0
    last_input = 0
    user_chars = asst_chars = tool_in_chars = tool_out_chars = 0

    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                e = json.loads(raw)
            except json.JSONDecodeError:
                continue

            t = e.get("type", "")

            if t == "user":
                msg = e.get("message", {})
                content = msg.get("content", "")
                if isinstance(content, str):
                    user_turns += 1
                    user_chars += len(content)
                elif isinstance(content, list):
                    for blk in content:
                        if not isinstance(blk, dict):
                            continue
                        if blk.get("type") == "tool_result":
                            rc = blk.get("content", "")
                            if isinstance(rc, str):
                                tool_out_chars += len(rc)
                            elif isinstance(rc, list):
                                for s in rc:
                                    if isinstance(s, dict) and s.get("type") == "text":
                                        tool_out_chars += len(s.get("text", ""))

            elif t == "assistant":
                msg = e.get("message", {})
                usage = msg.get("usage") or {}
                if usage:
                    inp = usage.get("input_tokens", 0)
                    out = usage.get("output_tokens", 0)
                    total_input += inp
                    total_output += out
                    total_cache_read += usage.get("cache_read_input_tokens", 0)
                    total_cache_create += usage.get("cache_creation_input_tokens", 0)
                    last_input = inp

                blocks = msg.get("content", [])
                if isinstance(blocks, list):
                    for blk in blocks:
                        if not isinstance(blk, dict):
                            continue
                        if blk.get("type") == "text":
                            asst_chars += len(blk.get("text", ""))
                        elif blk.get("type") == "tool_use":
                            tool_in_chars += len(json.dumps(blk.get("input", {}), ensure_ascii=False))

    est_conversation = int((user_chars + asst_chars) / CHARS_PER_TOKEN)
    est_tool_io = int((tool_in_chars + tool_out_chars) / CHARS_PER_TOKEN)
    est_system = max(0, last_input - est_conversation - est_tool_io)

    return dict(
        user_turns=user_turns,
        last_input=last_input,
        total_input=total_input,
        total_output=total_output,
        cache_read=total_cache_read,
        cache_create=total_cache_create,
        est_system=est_system,
        est_conversation=est_conversation,
        est_tool_io=est_tool_io,
    )


def calc_cost(d):
    full = d["total_input"] - d["cache_read"]
    return (
        full * PRICE_INPUT_PER_M / 1e6
        + d["cache_read"] * PRICE_CACHE_READ_PER_M / 1e6
        + d["total_output"] * PRICE_OUTPUT_PER_M / 1e6
    )


# ── Rendering ──────────────────────────────────────────────────────────

def render_cli(data, cost):
    """Render for CodeBuddy / Claude Code terminal."""
    turns = data["user_turns"]
    ctx = data["last_input"]
    pct = min(100, int(ctx / MAX_CONTEXT_TOKENS * 100))
    c = level_color(pct)
    lines = []

    lines.append(f"  {DIM}── cost ─────────────────────────────────────────────{RESET}")
    lines.append(
        f"  {WHITE_B}Turn {turns}{RESET} · "
        f"{bar(pct)} {c}{pct}%{RESET} · "
        f"~{fmt_tok(ctx)} / {fmt_tok(MAX_CONTEXT_TOKENS)} · "
        f"{c}${cost:.2f}{RESET}"
    )

    # breakdown
    total = ctx if ctx > 0 else 1
    items = [
        ("system", data["est_system"]),
        ("chat", data["est_conversation"]),
        ("tool I/O", data["est_tool_io"]),
    ]
    lines.append("")
    lines.append(f"  {DIM}breakdown:{RESET}")
    for label, val in items:
        p = min(100, int(val / MAX_CONTEXT_TOKENS * 100))
        share = int(val / total * 100)
        lines.append(
            f"    {label:<9s} ~{fmt_tok(val):>5s}  "
            f"{bar(p, BAR_WIDTH_SMALL)}  "
            f"{GRAY}{share}%{RESET}"
        )

    # cache savings
    if data["cache_read"] > 0 and data["total_input"] > 0:
        rate = int(data["cache_read"] / data["total_input"] * 100)
        saved = data["cache_read"] * (PRICE_INPUT_PER_M - PRICE_CACHE_READ_PER_M) / 1e6
        lines.append(f"    {DIM}cache hit {rate}%  saved ~${saved:.2f}{RESET}")

    # warnings
    if pct >= DANGER_PCT:
        lines.append(
            f"  {RED_B}✖ context nearly full — "
            f"/compact or start a new chat now{RESET}"
        )
    elif pct >= WARN_PCT:
        lines.append(
            f"  {YELLOW_B}⚠ context getting heavy — "
            f"consider /compact or new chat{RESET}"
        )

    return "\n".join(lines)


# ── CodeBuddy / Claude Code entry point ───────────────────────────────

def run_cli(input_data):
    tp = input_data.get("transcript_path", "")
    data = analyze_transcript(tp)
    if not data or data["user_turns"] == 0:
        return

    cost = calc_cost(data)
    display = render_cli(data, cost)

    turns = data["user_turns"]
    pct = min(100, int(data["last_input"] / MAX_CONTEXT_TOKENS * 100))
    title_seq = f"\033]0;⚡ Turn {turns} · {pct}% · ${cost:.2f}\007"

    print(title_seq + display)


# ── Cursor entry point ────────────────────────────────────────────────

def run_cursor(input_data):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    state_path = os.path.join(script_dir, ".cost-state.json")
    project_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
    log_path = os.path.join(project_root, ".cursor-cost.log")

    state = {"turns": 0, "cumul_chars": 0, "last_ts": 0}
    if os.path.exists(state_path):
        try:
            with open(state_path, "r", encoding="utf-8") as f:
                state = json.load(f)
        except Exception:
            pass

    now = time.time()
    is_new = (now - state.get("last_ts", 0)) > SESSION_TIMEOUT_SEC

    if is_new:
        state = {"turns": 0, "cumul_chars": 0, "last_ts": now}
        header = (
            f"\n  {DIM}── cost monitor ── new session "
            f"──────────────────────{RESET}\n"
        )
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(header + "\n")

    response_text = json.dumps(input_data, ensure_ascii=False)
    state["turns"] += 1
    state["cumul_chars"] += len(response_text)
    state["last_ts"] = now

    # Context estimation model:
    #   ~25K base overhead (system prompt + tool defs + rules + skills + MCP)
    #   + each turn adds ~8K on average (user msg + AI response + tool I/O)
    #   We only see the response text (~30% of per-turn growth),
    #   so also use turn count as a stronger signal.
    BASE_OVERHEAD = 25_000
    AVG_PER_TURN = 8_000
    turn_est = state["turns"] * AVG_PER_TURN
    char_est = int(state["cumul_chars"] / CHARS_PER_TOKEN * 3.0)
    conversation_tokens = max(turn_est, char_est)
    est_ctx = BASE_OVERHEAD + conversation_tokens
    est_output = int(state["cumul_chars"] / CHARS_PER_TOKEN)
    pct = min(100, int(est_ctx / MAX_CONTEXT_TOKENS * 100))
    c = level_color(pct)

    cost = (
        est_ctx * PRICE_INPUT_PER_M / 1e6
        + est_output * PRICE_OUTPUT_PER_M / 1e6
    )

    ts = datetime.now().strftime("%H:%M")
    turns = state["turns"]

    line = (
        f"  {ts}  {WHITE_B}Turn {turns:<3d}{RESET} "
        f"{bar(pct)} {c}{pct:>3d}%{RESET}  "
        f"~{fmt_tok(est_ctx):>5s}  {c}${cost:.2f}{RESET}"
    )

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(line + "\n")
        if pct >= DANGER_PCT:
            f.write(
                f"                  {RED_B}✖ start a new chat now{RESET}\n"
            )
        elif pct >= WARN_PCT:
            f.write(
                f"                  {YELLOW_B}⚠ context heavy — "
                f"consider wrapping up{RESET}\n"
            )

    # Determine level and warnings for IDE HUD consumption
    level = "normal"
    warnings = []
    if pct >= DANGER_PCT:
        level = "danger"
        warnings.append("Context nearly full — start a new chat now")
    elif pct >= WARN_PCT:
        level = "warning"
        warnings.append("Context getting heavy — consider wrapping up")

    BASE_OVERHEAD_TOKENS = 25_000
    state["pct"] = pct
    state["est_ctx"] = est_ctx
    state["est_output"] = est_output
    state["cost"] = round(cost, 4)
    state["level"] = level
    state["warnings"] = warnings
    state["breakdown"] = {
        "system": BASE_OVERHEAD_TOKENS,
        "conversation": conversation_tokens,
        "tool_io": 0,
    }

    history = state.get("history", [])
    history.append({"turn": turns, "pct": pct, "cost": round(cost, 4)})
    if len(history) > 50:
        history = history[-50:]
    state["history"] = history

    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

    if pct >= WARN_PCT:
        ctx_json = {
            "additional_context": (
                f"[Cost Monitor] Turn {turns}, context ~{pct}% "
                f"(~{fmt_tok(est_ctx)} tokens, ~${cost:.2f}). "
                "Consider: 1) remove unused file references "
                "2) start a new chat for remaining tasks"
            )
        }
        print(json.dumps(ctx_json))


# ── Main ──────────────────────────────────────────────────────────────

def main():
    cursor_mode = "--cursor" in sys.argv

    try:
        raw = sys.stdin.read()
        input_data = json.loads(raw) if raw.strip() else {}
    except Exception:
        input_data = {}

    if cursor_mode:
        run_cursor(input_data)
    else:
        run_cli(input_data)


if __name__ == "__main__":
    main()
