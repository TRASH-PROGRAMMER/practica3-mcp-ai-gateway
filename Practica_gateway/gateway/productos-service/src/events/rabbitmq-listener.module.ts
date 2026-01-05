import { Module } from '@nestjs/common';
import { GatewayRabbitMQListenerService } from './rabbitmq-listener.service';
import { GatewayRabbitMQStatsController } from './rabbitmq-stats.controller';

/**
 * Módulo de Listeners de RabbitMQ para Gateway/Productos Service
 * 
 * Responsabilidades:
 * - Escuchar eventos internos de RabbitMQ
 * - Sincronizar datos entre servicios
 * - Procesar notificaciones del sistema
 * - Logging estructurado JSON
 * - Estadísticas de procesamiento
 */
@Module({
  providers: [GatewayRabbitMQListenerService],
  controllers: [GatewayRabbitMQStatsController],
  exports: [GatewayRabbitMQListenerService],
})
export class GatewayRabbitMQListenerModule {}
