import { Logger as BaseLogger, transports } from 'winston';


export class Logger extends BaseLogger {
  constructor () {
    super({
      level: 'debug',
      transports: [
        new transports.Console()
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
