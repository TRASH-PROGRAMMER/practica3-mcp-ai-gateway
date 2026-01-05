import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { HmacSignatureService } from './hmac-signature.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ObservabilityService } from './observability.service';
import { StandardWebhookDto } from './standard-webhook.dto';
import { ExponentialBackoffService, BackoffConfig } from './exponential-backoff.service';

/**
 * Configuración de reintento para webhooks
 * Ahora usa exponential backoff real en lugar de delays fijos
 */
export interface RetryConfig extends Partial<BackoffConfig> {
  maxAttempts: number;
}

/**
 * Resultado del envío de webhook
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  attempt: number;
  error?: string;
  responseBody?: any;
}

/**
 * Suscripción de webhook
 */
export interface WebhookSubscription {
  id: number;
  name: string;
  endpointUrl: string;
  secret: string;
  events: string[];
  active: boolean;
  retryConfig?: RetryConfig;
}

/**
 * Servicio para enviar webhooks HTTP POST a URLs registradas
 * 
 * Características:
 * - ✅ Envío HTTP POST con firma HMAC-SHA256
 * - ✅ Reintentos con exponential backoff verdadero
 * - ✅ Jitter aleatorio para evitar thundering herd
 * - ✅ Timeouts configurables
 * - ✅ Circuit breaker integrado
 * - ✅ Logs estructurados con correlation IDs
 * - ✅ Métricas de entrega
 */
@Injectable()
export class WebhookSenderService {
  private readonly logger = new Logger(WebhookSenderService.name);
  private readonly defaultTimeout = 30000; // 30 segundos
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 5,
    baseDelay: 1000,      // 1s
    multiplier: 2,        // 2x cada vez
    maxDelay: 60000,      // 1 minuto máximo
    enableJitter: true,   // Jitter activado
    jitterFactor: 0.1,    // ±10%
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly hmacService: HmacSignatureService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly observability: ObservabilityService,
    private readonly backoff: ExponentialBackoffService,
  ) {}

  /**
   * Envía un webhook a una URL específica con exponential backoff
   */
  async sendWebhook(
    webhook: StandardWebhookDto,
    subscription: WebhookSubscription,
  ): Promise<WebhookDeliveryResult> {
    const retryConfig = { ...this.defaultRetryConfig, ...subscription.retryConfig };

    this.observability.info('Iniciando envío de webhook con exponential backoff', {
      subscriptionId: subscription.id,
      subscriptionName: subscription.name,
      url: subscription.endpointUrl,
      eventId: webhook.metadata.eventId,
      eventType: webhook.metadata.eventType,
      backoffStrategy: {
        baseDelay: retryConfig.baseDelay,
        multiplier: retryConfig.multiplier,
        maxAttempts: retryConfig.maxAttempts,
      },
    });

    // Usar ExponentialBackoffService para reintentos
    const result = await this.backoff.executeWithRetry(
      async () => await this.attemptSend(webhook, subscription),
      retryConfig,
      {
        operation: 'sendWebhook',
        subscriptionId: subscription.id,
        eventId: webhook.metadata.eventId,
      },
    );

    // Convertir resultado de backoff a WebhookDeliveryResult
    if (result.success && result.data) {
      this.observability.info('Webhook entregado exitosamente', {
        subscriptionId: subscription.id,
        attempts: result.attempts,
        totalDuration: result.totalDuration,
        delays: result.delays,
        statusCode: result.data.statusCode,
      });

      return {
        ...result.data,
        attempt: result.attempts,
        responseTime: result.totalDuration,
      };
    } else {
      this.observability.error(
        'Webhook fallido después de todos los intentos',
        result.error || new Error('Unknown error'),
        {
          subscriptionId: subscription.id,
          attempts: result.attempts,
          totalDuration: result.totalDuration,
          delays: result.delays,
        },
      );

      return {
        success: false,
        responseTime: result.totalDuration,
        attempt: result.attempts,
        error: result.error?.message || 'Max retry attempts exceeded',
      };
    }
  }

  /**
   * Intenta enviar el webhook una vez (sin reintentos)
   * Ahora es llamado por ExponentialBackoffService
   */
  private async attemptSend(
    webhook: StandardWebhookDto,
    subscription: WebhookSubscription,
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();

    try {
      // Generar firma HMAC con el secret de la suscripción
      const signature = this.generateSignature(webhook, subscription.secret);

      // Preparar headers
      const headers = {
        ...(webhook.headers || {}),
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Event-ID': webhook.metadata.eventId,
        'X-Event-Type': webhook.metadata.eventType,
        'X-Correlation-ID': webhook.metadata.correlationId,
        'User-Agent': 'Webhook-Service/1.0',
      };

      // Enviar con circuit breaker
      const response = await this.circuitBreaker.execute(
        `webhook-${subscription.id}`,
        async () => {
          return await firstValueFrom(
            this.httpService.post(subscription.endpointUrl, webhook, {
              headers,
              timeout: this.defaultTimeout,
              validateStatus: (status) => status >= 200 && status < 600, // No lanzar error por status
            }),
          );
        },
        {
          failureThreshold: 5,
          timeout: this.defaultTimeout + 5000, // timeout + buffer
        },
      );

      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      if (!success) {
        // Lanzar error para que el backoff service reintente
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        statusCode: response.status,
        responseTime,
        attempt: 1,
        responseBody: response.data,
      };
    } catch (error) {
      // Re-lanzar error para que el backoff service maneje el retry
      throw error;
    }
  }

  /**
   * Verifica si un webhook debe ser enviado a una suscripción
   */
  shouldSendToSubscription(eventType: string, subscription: WebhookSubscription): boolean {
    if (!subscription.active) {
      return false;
    }

    // Verificar si la suscripción incluye este tipo de evento
    return (
      subscription.events.includes('*') || // wildcard
      subscription.events.includes(eventType) ||
      subscription.events.some((pattern) => this.matchEventPattern(eventType, pattern))
    );
  }

  /**
   * Verifica si un tipo de evento coincide con un patrón
   * Soporta wildcards: producto.* coincide con producto.creado, producto.actualizado, etc.
   */
  private matchEventPattern(eventType: string, pattern: string): boolean {
    // Convertir patrón a regex
    // producto.* -> ^producto\\..*$
    // *.creado -> ^.*\\.creado$
    const regexPattern = pattern
      .replace(/\./g, '\\.') // Escapar puntos
      .replace(/\*/g, '.*'); // Wildcard a regex

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventType);
  }

  /**
   * Genera firma HMAC-SHA256 para el webhook
   */
  private generateSignature(webhook: StandardWebhookDto, secret: string): string {
    const payload = JSON.stringify(webhook);
    return this.hmacService.generateSignature(payload);
  }

  /**
   * Obtiene estadísticas de envío y estrategia de backoff
   */
  getStats(): Record<string, any> {
    const delaySequence = this.backoff.calculateDelaySequence(this.defaultRetryConfig);

    return {
      defaultTimeout: this.defaultTimeout,
      defaultRetryConfig: this.defaultRetryConfig,
      backoffStrategy: {
        type: 'exponential',
        baseDelay: `${this.defaultRetryConfig.baseDelay}ms`,
        multiplier: `${this.defaultRetryConfig.multiplier}x`,
        maxDelay: `${this.defaultRetryConfig.maxDelay}ms`,
        maxAttempts: this.defaultRetryConfig.maxAttempts,
        jitter: this.defaultRetryConfig.enableJitter ? `±${(this.defaultRetryConfig.jitterFactor || 0.1) * 100}%` : 'disabled',
      },
      delaySequence: delaySequence.map(d => `${d}ms`),
      maxTotalDuration: `${delaySequence.reduce((sum, d) => sum + d, 0)}ms`,
    };
  }
}
