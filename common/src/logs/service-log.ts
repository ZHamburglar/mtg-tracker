export class ServiceLogger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  // private getTimestamp(): string {
  //   const now = new Date();
  //   const month = String(now.getMonth() + 1).padStart(2, '0');
  //   const day = String(now.getDate()).padStart(2, '0');
  //   const hours = String(now.getHours()).padStart(2, '0');
  //   const minutes = String(now.getMinutes()).padStart(2, '0');
  //   const seconds = String(now.getSeconds()).padStart(2, '0');
  //   return `${month}-${day} ${hours}:${minutes}:${seconds}`;
  // }

  private formatMessage(message: string): string {
    return `[${this.serviceName}] ${message}`;
  }

  log(message: string, ...optionalParams: any[]): void {
    console.log(this.formatMessage(message), ...optionalParams);
  }

  info(message: string, ...optionalParams: any[]): void {
    console.info(this.formatMessage(message), ...optionalParams);
  }

  warn(message: string, ...optionalParams: any[]): void {
    console.warn(this.formatMessage(message), ...optionalParams);
  }

  error(message: string, ...optionalParams: any[]): void {
    console.error(this.formatMessage(message), ...optionalParams);
  }

  debug(message: string, ...optionalParams: any[]): void {
    console.debug(this.formatMessage(message), ...optionalParams);
  }
}
