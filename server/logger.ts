/**
 * logger.ts — Structured logging for production observability
 *
 * Outputs JSON lines to stdout/stderr so Railway's log aggregator can parse them.
 * Each log line includes: timestamp, level, component, message, and optional metadata.
 *
 * Usage:
 *   import { log } from './logger';
 *   log.info('booking', 'Booking created', { bookingId: 42, total: 5951 });
 *   log.error('storage', 'Upload failed', { key: 'abc', error: err.message });
 *   log.warn('maps', 'Rate limit hit', { adminId: 7 });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  component: string;
  msg: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default to 'info' in production, 'debug' in development
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
}

function emit(level: LogLevel, component: string, msg: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    component,
    msg,
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const log = {
  debug: (component: string, msg: string, meta?: Record<string, unknown>) => emit('debug', component, msg, meta),
  info:  (component: string, msg: string, meta?: Record<string, unknown>) => emit('info', component, msg, meta),
  warn:  (component: string, msg: string, meta?: Record<string, unknown>) => emit('warn', component, msg, meta),
  error: (component: string, msg: string, meta?: Record<string, unknown>) => emit('error', component, msg, meta),
};

/**
 * Format an Error object into a loggable metadata object
 */
export function errorMeta(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join(' | '),
      name: err.constructor.name,
    };
  }
  return { error: String(err) };
}

export default log;
