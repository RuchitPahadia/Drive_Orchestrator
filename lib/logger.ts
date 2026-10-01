/**
 * @file lib/logger.ts
 * @description Minimal leveled logger. Replaces scattered raw `console.log` calls so
 * log verbosity can be controlled centrally and info-level noise suppressed in production.
 *
 * Level is read from `LOG_LEVEL` (debug | info | warn | error). Default is `info`
 * in development and `warn` in production. In production (or when `LOG_FORMAT=json`)
 * each record is emitted as a single structured JSON line (`{ time, level, msg }`) suitable
 * for log drains / aggregators; otherwise output stays human-readable. Dependency-free.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveLevel(): Level {
  const fromEnv = process.env.LOG_LEVEL?.toLowerCase();
  if (fromEnv && fromEnv in LEVEL_WEIGHT) return fromEnv as Level;
  return process.env.NODE_ENV === 'production' ? 'warn' : 'info';
}

const activeWeight = LEVEL_WEIGHT[resolveLevel()];
const useJson =
  process.env.LOG_FORMAT === 'json' ||
  (process.env.NODE_ENV === 'production' && process.env.LOG_FORMAT !== 'pretty');

/** Render a single arg for the structured `msg` field (Errors keep message + stack). */
function render(arg: unknown): string {
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function emit(level: Level, args: unknown[]) {
  if (LEVEL_WEIGHT[level] < activeWeight) return;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (useJson) {
    sink(JSON.stringify({ time: new Date().toISOString(), level, msg: args.map(render).join(' ') }));
  } else {
    sink(...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

