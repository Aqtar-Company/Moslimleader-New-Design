const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const stamp = () => new Date().toISOString().slice(11, 19);

export const log = {
  info: (...a) => console.log(`${C.dim}${stamp()}${C.reset} ${C.blue}·${C.reset}`, ...a),
  step: (...a) => console.log(`${C.dim}${stamp()}${C.reset} ${C.cyan}▶${C.reset}`, ...a),
  ok: (...a) => console.log(`${C.dim}${stamp()}${C.reset} ${C.green}✓${C.reset}`, ...a),
  warn: (...a) => console.warn(`${C.dim}${stamp()}${C.reset} ${C.yellow}!${C.reset}`, ...a),
  err: (...a) => console.error(`${C.dim}${stamp()}${C.reset} ${C.red}✗${C.reset}`, ...a),
  money: (usd) => `${C.yellow}$${usd.toFixed(2)}${C.reset}`,
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
