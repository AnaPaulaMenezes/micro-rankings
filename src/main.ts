import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import * as momentTimezone from 'moment-timezone';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABITMQ_URL],
      noAck: false,
      queue: 'rankings'
    }
  });

  Date.prototype.toJSON = function (): any {
    return momentTimezone(this)
      .tz("America/Sao_Paulo")
      .format("YYYY-MM-DD HH:mm:ss.SSS")
  }

  await app.listen();
}
bootstrap();
