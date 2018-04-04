import { Logger as BaseLogger, transports } from 'winston';


export type LogLevel = 'debug' | 'verbose' | 'info' | 'warn' | 'error';

export class Logger extends BaseLogger {
  constructor (level: LogLevel) {
    super({
      level,
      transports: [
        new transports.Console({
          timestamp () {
            return new Date().toLocaleString();
          }
        })
      ]
    });
  }

  error = (error: string | Error) => {
    if (error instanceof Error) {
      error = error.stack || error.message;
    }
    return this.log('error', error);
  }
}
