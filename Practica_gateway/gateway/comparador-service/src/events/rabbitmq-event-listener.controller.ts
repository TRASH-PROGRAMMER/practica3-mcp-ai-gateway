import { Module } from '@nestjs/common';
import { RabbitMQEventListenerService } from './rabbitmq-event-listener.service';
import { ObservabilityService } from '../webhook/observability.service';
import { DistributedTracingService } from '../webhook/distributed-tracing.service';

/**
 * Módulo de Listeners de RabbitMQ con Observabilidad
 * 
 * Responsabilidades:
 * - Escuchar eventos internos de RabbitMQ
 * - Logging estructurado JSON de eventos
 * - Distributed tracing de procesamiento
 * - Manejo de errores con ACK/NACK
 * - Métricas de rendimiento
 * - Estadísticas de procesamiento
 */
@Module({
  providers: [
    RabbitMQEventListenerService,
    ObservabilityService,
    DistributedTracingService,
  ],
  exports: [RabbitMQEventListenerService],
})
export class RabbitMQEventListenerModule {}
