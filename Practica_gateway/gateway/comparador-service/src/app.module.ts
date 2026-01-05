import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProductoRead } from './read_model/producto-read.entity';
import { DetallePrescripcion } from './read_model/detalle-prescripcion.entity';
import { Prescripcion } from './prescripcion/prescripcion.entity';
import { Comparacion } from './comparacion/comparacion.entity';
import { ProductoEventsController } from './events/producto-events.controller';
import { ComparadorController } from './comparador/comparador.controller';
import { ComparadorService } from './comparador/comparador.service';
import { PrescripcionModule } from './prescripcion/prescripcion.module';
import { RabbitMQEventListenerModule } from './events/rabbitmq-event-listener.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'comparador.db',
      entities: [ProductoRead, DetallePrescripcion, Prescripcion, Comparacion],
      synchronize: true, // solo dev
    }),
    TypeOrmModule.forFeature([ProductoRead, DetallePrescripcion, Comparacion]),
    ClientsModule.register([
      {
        name: 'EVENT_BUS',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://user:pass@localhost:5672'],
          queue: 'producto_events',
          queueOptions: { durable: true },
        },
      },
    ]),
    PrescripcionModule,
    RabbitMQEventListenerModule, // Módulo de listeners de RabbitMQ con observabilidad
    WebhookModule, // Sistema de webhooks y observabilidad
  ],
  controllers: [ProductoEventsController, ComparadorController],
  providers: [ComparadorService],
})
export class AppModule {}
