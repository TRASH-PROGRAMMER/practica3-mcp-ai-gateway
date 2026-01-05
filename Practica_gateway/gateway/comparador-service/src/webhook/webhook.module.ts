import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { HmacSignatureService } from './hmac-signature.service';
import { WebhookController } from './webhook.controller';
import { WebhookAdminController } from './webhook-admin.controller';
import { WebhookMonitoringDashboardController } from './webhook-monitoring-dashboard.controller';
import { WebhookDiagnosisController } from './webhook-diagnosis.controller';
import { EventTransformerController } from './event-transformer.controller';
import { WebhookSubscriptionController } from './webhook-subscription.controller';
import { HmacValidationMiddleware } from './hmac-validation.middleware';
import { IdempotencyService } from './idempotency.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { ObservabilityService, CorrelationIdMiddleware } from './observability.service';
import { DistributedTracingService } from './distributed-tracing.service';
import { FailureDiagnosisService } from './failure-diagnosis.service';
import { EventTransformerService } from './event-transformer.service';
import { WebhookSenderService } from './webhook-sender.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { ExponentialBackoffService } from './exponential-backoff.service';
import { SupabaseService } from './supabase.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { TelegramController } from './telegram.controller';

/**
 * Módulo de Webhooks Empresarial
 * 
 * Proporciona:
 * - ✅ Validación HMAC-SHA256 con anti-replay
 * - ✅ Idempotencia para prevenir duplicados
 * - ✅ Circuit Breaker para protección de endpoints externos
 * - ✅ Dead Letter Queue con reintentos automáticos
 * - ✅ Observabilidad con correlation IDs y logs estructurados
 * - ✅ Métricas y trazas distribuidas
 * - ✅ Distributed tracing para rastrear eventos entre servicios
 * - ✅ Dashboard de monitoreo en tiempo real
 * - ✅ Diagnóstico automático de fallos
 * - ✅ Transformación de eventos a formato estándar de webhook
 * - ✅ Envío HTTP POST a URLs registradas con reintentos
 * - ✅ Gestión de suscripciones de webhook
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ScheduleModule.forRoot(), // Para cron jobs de DLQ
  ],
  controllers: [
    WebhookController,
    WebhookAdminController,
    WebhookMonitoringDashboardController,
    WebhookDiagnosisController,
    EventTransformerController,
    WebhookSubscriptionController,
    TelegramController,
  ],
  providers: [
    HmacSignatureService,
    HmacValidationMiddleware,
    IdempotencyService,
    CircuitBreakerService,
    DeadLetterQueueService,
    ObservabilityService,
    DistributedTracingService,
    FailureDiagnosisService,
    EventTransformerService,
    ExponentialBackoffService,
    SupabaseService,
    WebhookSenderService,
    WebhookDeliveryService,
    CorrelationIdMiddleware,
    TelegramNotificationService,
  ],
  exports: [
    HmacSignatureService,
    HmacValidationMiddleware,
    IdempotencyService,
    CircuitBreakerService,
    DeadLetterQueueService,
    ObservabilityService,
    DistributedTracingService,
    FailureDiagnosisService,
    ExponentialBackoffService,
    EventTransformerService,
    WebhookSenderService,
    WebhookDeliveryService,
  ],
})
export class WebhookModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar middleware de correlation ID a todas las rutas de webhook
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('webhook');
  }
}
