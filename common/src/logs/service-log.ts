import pino from 'pino';

export class ServiceLogger {
  private logger: pino.Logger<'log'>;

  constructor(serviceName: string) {
    this.logger = pino({
      name: serviceName,
      level: process.env.LOG_LEVEL || 'trace',
      customLevels: {
        log: 25
      },
      useOnlyCustomLevels: false,
      formatters: {
        level: (label, number) => {
          return { level: number, levelLabel: label };
        }
      },
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          customLevels: 'log:25',
          customColors: 'log:yellow',
        }
      } : undefined,
    });
  }

  log(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      (this.logger as any).log(optionalParams[0], message);
    } else {
      (this.logger as any).log(message);
    }
  }

  info(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.info({ level: 'info', ...optionalParams[0] }, message);
    } else {
      this.logger.info({ level: 'info' }, message);
    }
  }

  warn(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.warn({ level: 'warn', ...optionalParams[0] }, message);
    } else {
      this.logger.warn({ level: 'warn' }, message);
    }
  }

  error(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.error({ level: 'error', ...optionalParams[0] }, message);
    } else {
      this.logger.error({ level: 'error' }, message);
    }
  }

  debug(message: string, ...optionalParams: any[]): void {
    if (optionalParams.length > 0) {
      this.logger.debug({ level: 'debug', ...optionalParams[0] }, message);
    } else {
      this.logger.debug({ level: 'debug' }, message);
    }
  }
}
