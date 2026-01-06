import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
// El entity `Producto` vive en el proyecto sibling `practica1_parcial2`.
import { Producto } from './producto.entity';
import { ProductoService } from './producto.service';
import { ProductoController } from './producto.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Producto]),
    ClientsModule.register([
      {
        name: 'PRODUCTO_EVENTS',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],     // host de RabbitMQ (docker-compose, etc.)
          queue: 'producto_events',           // cola donde se publican los eventos
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [ProductoController],
  providers: [ProductoService],
  exports: [ProductoService],
})
export class ProductoModule {}
