import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://user:pass@localhost:5672'],
      queue: 'productos_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.listen();
  console.log('🚀 Servicio de Productos escuchando en RabbitMQ (productos_queue)');
}
bootstrap();
