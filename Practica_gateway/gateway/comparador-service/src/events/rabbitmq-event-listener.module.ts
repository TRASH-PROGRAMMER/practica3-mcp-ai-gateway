import { Module } from '@nestjs/common';
import { RabbitMQEventListenerService } from './rabbitmq-event-listener.service';
import { RabbitMQStatsController } from './rabbitmq-stats.controller';
import { WebhookModule } from '../webhook/webhook.module';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyController } from './idempotency.controller';

/**
 * Módulo de Listeners de RabbitMQ con Observabilidad e Idempotencia
 * 
 * Responsabilidades:
 * - Escuchar eventos internos de RabbitMQ
 * - Logging estructurado JSON de eventos
 * - Distributed tracing de procesamiento
 * - Manejo de errores con ACK/NACK
 * - Métricas de rendimiento
 * - Estadísticas de procesamiento
 * - Transformación a formato estándar
 * - Envío automático de webhooks a URLs registradas
 * - Deduplicación de mensajes con Idempotent Consumer
 */
@Module({
  imports: [WebhookModule],
  providers: [
    RabbitMQEventListenerService,
    IdempotencyService,
  ],
  controllers: [
    RabbitMQStatsController,
    IdempotencyController,
  ],
  exports: [
    RabbitMQEventListenerService,
    IdempotencyService,
  ],
})
export class RabbitMQEventListenerModule {}
