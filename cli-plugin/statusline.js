#!/usr/bin/env node
/**
 * Cost Monitor — Claude Code / CodeBuddy Code statusline plugin.
 *
 * Reads the session JSON from stdin (provided by the statusline API on each tick)
 * and renders a compact one-line or two-line HUD showing context health and cost.
 *
 * Compatible with:
 *   - Claude Code v1.0.80+ (native statusline API)
 *   - CodeBuddy Code v1.16.0+ (Claude Code–compatible hooks)
 */

const WARN_PCT = 40;
const DANGER_PCT = 70;
const MAX_CONTEXT = 200000;
const BAR_WIDTH = 15;

const GREEN = "\x1b[38;5;72m";
const YELLOW = "\x1b[38;5;178m";
const RED = "\x1b[38;5;167m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function levelColor(pct) {
  if (pct < WARN_PCT) return GREEN;
  return pct < DANGER_PCT ? YELLOW : RED;
}

function bar(pct) {
  const filled = Math.min(Math.round((pct / 100) * BAR_WIDTH), BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const c = levelColor(pct);
  return `${c}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
}

function fmtTok(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

function processInput(raw) {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const contextTokens =
    input.context_tokens ||
    input.last_input_tokens ||
    (input.usage && input.usage.input_tokens) ||
    0;

  const pct = Math.min(100, Math.round((contextTokens / MAX_CONTEXT) * 100));
  const c = levelColor(pct);

  const turns = input.turns || input.turn_number || "?";

  const inputCost = (contextTokens * 3.0) / 1e6;
  const outputTokens = (input.usage && input.usage.output_tokens) || 0;
  const outputCost = (outputTokens * 15.0) / 1e6;
  const totalCost = inputCost + outputCost;

  let line1 = `${BOLD}T${turns}${RESET} ${bar(pct)} ${c}${pct}%${RESET} ~${fmtTok(contextTokens)} ${c}$${totalCost.toFixed(2)}${RESET}`;

  if (pct >= DANGER_PCT) {
    line1 += ` ${RED}${BOLD}✖ new chat!${RESET}`;
  } else if (pct >= WARN_PCT) {
    line1 += ` ${YELLOW}⚠ heavy${RESET}`;
  }

  process.stdout.write(line1 + "\n");
}

let chunks = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (chunks += d));
process.stdin.on("end", () => processInput(chunks));
