import stompit from 'stompit';
import { logger } from '../../utils/logger.js';

export interface MqConnectionParams {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface IncomingMqMessage {
  body: string;
  headers: Record<string, string>;
}

/**
 * Thin wrapper over stompit (STOMP protocol) used to talk to ActiveMQ and
 * other STOMP-capable brokers. STOMP avoids native client libraries, which
 * keeps local testing setups simple.
 */
export class StompMqClient {
  private connection: any = null;

  connect(params: MqConnectionParams): Promise<void> {
    return new Promise((resolve, reject) => {
      stompit.connect(
        {
          host: params.host,
          port: params.port,
          connectHeaders: {
            host: '/',
            login: params.user,
            passcode: params.password,
            'heart-beat': '5000,5000',
          },
        },
        (err: Error | null, conn: any) => {
          if (err) {
            reject(err);
            return;
          }
          this.connection = conn;
          this.connection.on('error', (e: Error) => {
            logger.error(`STOMP connection error: ${e.message}`);
          });
          resolve();
        },
      );
    });
  }

  subscribe(queue: string, onMessage: (msg: IncomingMqMessage) => void | Promise<void>): void {
    if (!this.connection) throw new Error('Not connected');

    this.connection.subscribe(
      { destination: `/queue/${queue}`, ack: 'client-individual' },
      (err: Error | null, message: any) => {
        if (err) {
          logger.error(`STOMP subscribe error on ${queue}: ${err.message}`);
          return;
        }
        message.readString('utf-8', async (readErr: Error | null, bodyStr: string) => {
          if (readErr) {
            logger.error(`STOMP read error: ${readErr.message}`);
            return;
          }
          const headers: Record<string, string> = { ...message.headers };
          try {
            await onMessage({ body: bodyStr ?? '', headers });
          } catch (handlerErr) {
            logger.error(`MQ handler error: ${String(handlerErr)}`);
          } finally {
            this.connection.ack(message);
          }
        });
      },
    );
  }

  send(queue: string, body: string, headers: Record<string, string> = {}): void {
    if (!this.connection) throw new Error('Not connected');
    const frame = this.connection.send({ destination: `/queue/${queue}`, ...headers });
    frame.write(body);
    frame.end();
  }

  disconnect(): void {
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }
  }
}
