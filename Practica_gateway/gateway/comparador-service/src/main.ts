import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true, // Asegurar que el body parser esté habilitado
  });

  // Habilitar CORS
  app.enableCors();

  // Microservicio para escuchar eventos de productos
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://user:pass@localhost:5672'],
      queue: 'producto_events',
      queueOptions: { durable: true },
      prefetchCount: 10, // Procesar hasta 10 mensajes en paralelo
    },
  });

  // Microservicio para responder queries del gateway
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://user:pass@localhost:5672'],
      queue: 'comparador_queue',
      queueOptions: { durable: true },
      prefetchCount: 10,
    },
  });

  await app.startAllMicroservices();
  
  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  console.log('🚀 Servicio Comparador iniciado');
  console.log(`📊 API REST: http://localhost:${port}`);
  console.log(`📨 RabbitMQ Listeners activos: producto_events, comparador_queue`);
  console.log(`🔍 Dashboard Observabilidad: http://localhost:${port}/webhook/dashboard`);
  console.log(`📈 Estadísticas RabbitMQ: http://localhost:${port}/events/rabbitmq/stats`);
}

bootstrap();
