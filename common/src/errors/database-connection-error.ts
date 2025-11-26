import { CustomError } from './custom-error';

export class DatabaseConnectionError extends CustomError {
  statusCode = 503;
  reason = 'Error connecting to database';

  constructor(public originalError?: Error) {
    super('Error connecting to database');

    Object.setPrototypeOf(this, DatabaseConnectionError.prototype);
  }

  serializeErrors() {
    return [{ 
      message: this.reason,
      ...(this.originalError && { details: this.originalError.message })
    }];
  }
}
