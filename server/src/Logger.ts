import { createLogger, format, transports } from 'winston';


export type LogLevel = 'debug' | 'verbose' | 'info' | 'warn' | 'error';

/**
 * Логгер в консоль. Вызовы как в winston 2: logger.info('text', ...meta),
 * logger.error(errorObject) печатает стек
 */
export class Logger {
  private logger;

  constructor (level: LogLevel) {
    this.logger = createLogger({
      format: format.combine(
        format.timestamp({ format: () => new Date().toLocaleString() }),
        format.printf(info => `${info.timestamp} - ${info.level}: ${info.message}`)
      ),
      level,
      transports: [new transports.Console()]
    });
  }

  debug (...args: unknown[]) { this.log('debug', args); }
  verbose (...args: unknown[]) { this.log('verbose', args); }
  info (...args: unknown[]) { this.log('info', args); }
  warn (...args: unknown[]) { this.log('warn', args); }
  error (...args: unknown[]) { this.log('error', args); }

  private log (level: LogLevel, args: unknown[]) {
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.message;
      }
      return typeof arg === 'string' ? arg : JSON.stringify(arg);
    }).join(' ');
    this.logger.log(level, message);
  }
}
