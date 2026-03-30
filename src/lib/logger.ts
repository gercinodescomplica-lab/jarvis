type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function format(level: LogLevel, service: string, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${service}] ${message}`;
  if (meta !== undefined) {
    const metaStr = meta instanceof Error
      ? meta.stack ?? meta.message
      : typeof meta === 'object'
        ? JSON.stringify(meta)
        : String(meta);
    return `${base} ${metaStr}`;
  }
  return base;
}

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createLogger(service: string): Logger {
  return {
    debug(message, meta) {
      if (shouldLog('debug')) console.debug(format('debug', service, message, meta));
    },
    info(message, meta) {
      if (shouldLog('info')) console.log(format('info', service, message, meta));
    },
    warn(message, meta) {
      if (shouldLog('warn')) console.warn(format('warn', service, message, meta));
    },
    error(message, meta) {
      if (shouldLog('error')) console.error(format('error', service, message, meta));
    },
  };
}
