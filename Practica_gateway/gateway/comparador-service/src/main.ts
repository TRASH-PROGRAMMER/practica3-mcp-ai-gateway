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

  // ⚠️ RabbitMQ DESHABILITADO para Taller 3 (solo HTTP REST)
  // Microservicio para escuchar eventos de productos
  // app.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.RMQ,
  //   options: {
  //     urls: [process.env.RABBITMQ_URL || 'amqp://user:pass@localhost:5672'],
  //     queue: 'producto_events',
  //     queueOptions: { durable: true },
  //     prefetchCount: 10, // Procesar hasta 10 mensajes en paralelo
  //   },
  // });

  // // Microservicio para responder queries del gateway
  // app.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.RMQ,
  //   options: {
  //     urls: [process.env.RABBITMQ_URL || 'amqp://user:pass@localhost:5672'],
  //     queue: 'comparador_queue',
  //     queueOptions: { durable: true },
  //     prefetchCount: 10,
  //   },
  // });

  // await app.startAllMicroservices();
  
  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  console.log('🚀 Servicio Comparador iniciado (Taller 3 - Solo HTTP REST)');
  console.log(`📊 API REST: http://localhost:${port}`);
  console.log(`✅ Endpoints disponibles:`);
  console.log(`   GET  http://localhost:${port}/productos`);
  console.log(`   GET  http://localhost:${port}/prescripciones`);
  console.log(`   POST http://localhost:${port}/comparador/comparar`);
}

bootstrap();
