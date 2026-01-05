import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Prescripcion } from './prescripcion.entity';
import { DetallePrescripcion } from '../read_model/detalle-prescripcion.entity';
import { PrescripcionController } from './prescripcion.controller';
import { PrescripcionService } from './prescripcion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescripcion, DetallePrescripcion]),
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
  ],
  controllers: [PrescripcionController],
  providers: [PrescripcionService],
  exports: [PrescripcionService],
})
export class PrescripcionModule {}
