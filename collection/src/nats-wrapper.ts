import { connect, NatsConnection, JetStreamClient } from 'nats';
import { logger } from './logger';

class NatsWrapper {
  private _client?: NatsConnection;
  private _jetstream?: JetStreamClient;

  get client() {
    if (!this._client) {
      throw new Error('Cannot access NATS client before connecting');
    }
    return this._client;
  }

  get jetstream() {
    if (!this._jetstream) {
      throw new Error('Cannot access JetStream before connecting');
    }
    return this._jetstream;
  }

  async connect(url: string, clusterId: string, clientId: string) {
    try {
      this._client = await connect({
        servers: url,
        name: clientId,
      });

      this._jetstream = this._client.jetstream();

      logger.log(`Connected to NATS at ${url}`);

      // Handle connection events
      const client = this._client;
      (async () => {
        for await (const status of client.status()) {
          logger.log(`NATS connection status: ${status.type}: ${status.data}`);
        }
      })().catch((err) => {
        logger.error('Error in NATS status handler:', err);
      });

      return this._client;
    } catch (err) {
      logger.error('Error connecting to NATS:', err);
      throw err;
    }
  }

  async close() {
    if (this._client) {
      await this._client.drain();
      await this._client.close();
      logger.log('NATS connection closed');
    }
  }
}

export const natsWrapper = new NatsWrapper();
