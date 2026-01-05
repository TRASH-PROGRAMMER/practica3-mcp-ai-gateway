/**
 * EJEMPLO COMPLETO: Integración del Sistema de Observabilidad
 * 
 * Este archivo muestra cómo integrar todos los componentes de observabilidad
 * en un servicio de webhooks empresarial.
 * 
 * NOTA: Este es un archivo de EJEMPLO con código de referencia.
 * Algunos métodos pueden requerir ajustes según la implementación específica.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService, Span } from './distributed-tracing.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { FailureDiagnosisService } from './failure-diagnosis.service';
import { IdempotencyService } from '../events/idempotency.service';

/**
 * Servicio de Ejemplo: Procesamiento de Eventos con Observabilidad Completa
 */
@Injectable()
export class ObservabilityExampleService {
  private readonly logger = new Logger(ObservabilityExampleService.name);

  constructor(
    private readonly http: HttpService,
    private readonly observability: ObservabilityService,
    private readonly tracing: DistributedTracingService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly dlq: DeadLetterQueueService,
    private readonly diagnosis: FailureDiagnosisService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Ejemplo 1: Procesar evento con observabilidad completa
   */
  async processEvent(event: any) {
    // 1. Verificar idempotencia
    const key = await this.idempotency.generateKey(event.type, event.id, 'process');
    const check = await this.idempotency.isDuplicate(key);
    const isDuplicate = check.isDuplicate;
    
    if (isDuplicate) {
      this.observability.warn('Evento duplicado detectado', {
        eventId: event.id,
        eventType: event.type,
      });
      return { status: 'duplicate', eventId: event.id };
    }

    // 2. Marcar como procesado
    await this.idempotency.markProcessed(key, { status: 'processing' });

    // 3. Obtener contexto actual
    const context = this.observability.getCurrentContext();

    // 4. Crear span principal para la operación
    return await this.tracing.traceOperation(
      'event.process',
      async (mainSpan: Span) => {
        // Agregar tags al span principal
        this.observability.info('Event details', {
          eventId: event.id,
          eventType: event.type,
          priority: event.priority || 'normal',
        });

        // Log estructurado de inicio
        this.observability.info('Iniciando procesamiento de evento', {
          eventId: event.id,
          eventType: event.type,
        });

        try {
          // 5. Validar evento
          await this.validateEvent(event, mainSpan);

          // 6. Enriquecer evento
          const enrichedEvent = await this.enrichEvent(event, mainSpan);

          // 7. Enviar a webhooks configurados
          const webhookResults = await this.sendToWebhooks(
            enrichedEvent,
            mainSpan
          );

          // 8. Persistir resultado
          await this.persistResult(enrichedEvent, webhookResults, mainSpan);

          // 9. Marcar como completado
          await this.idempotency.markProcessed(key, {
            status: 'completed',
            webhooksSent: webhookResults.length,
            successful: webhookResults.filter(r => r.success).length,
          });

          // Log de éxito
          this.observability.info('Evento procesado exitosamente', {
            eventId: event.id,
            webhooksSent: webhookResults.length,
            successful: webhookResults.filter(r => r.success).length,
          });

          return {
            status: 'success',
            eventId: event.id,
            webhookResults,
          };

        } catch (error) {
          // Log estructurado de error
          this.observability.error(
            'Error al procesar evento',
            error as Error,
            {
              eventId: event.id,
              eventType: event.type,
            }
          );

          // Marcar como fallido
          await this.idempotency.markProcessed(key, {
            status: 'failed',
            error: (error as Error).message,
          });

          // Agregar a DLQ
          await this.dlq.addToQueue(
            event.id,
            event.type,
            event,
            error as Error
          );

          // Diagnosticar automáticamente
          try {
            const traceId = mainSpan.traceId;
            const diagnosis = await this.diagnosis.diagnoseFailure(traceId);

            this.logger.error(
              `🔍 Diagnóstico automático:\n` +
              `Root Cause: ${diagnosis.rootCause}\n` +
              `Severity: ${diagnosis.severity}\n` +
              `Recommendations:\n${diagnosis.recommendations.map(r => `  - ${r}`).join('\n')}`
            );
          } catch (diagError) {
            this.logger.warn('No se pudo generar diagnóstico automático');
          }

          throw error;
        }
      },
      context?.requestId,
      context?.traceId
    );
  }

  /**
   * Ejemplo 2: Validación con span hijo
   */
  private async validateEvent(event: any, parentSpan: Span) {
    return await this.tracing.traceOperation(
      'event.validate',
      async (span: Span) => {
        this.observability.info('Validating event', {
          eventId: event.id,
        });

        // Simular validación
        if (!event.type) {
          throw new Error('Evento sin tipo');
        }

        if (!event.payload) {
          throw new Error('Evento sin payload');
        }

        this.observability.info('Validación exitosa');

        this.observability.debug('Evento validado', {
          eventId: event.id,
        });
      },
      parentSpan.spanId,
      parentSpan.traceId
    );
  }

  /**
   * Ejemplo 3: Enriquecimiento con múltiples llamadas externas
   */
  private async enrichEvent(event: any, parentSpan: Span) {
    return await this.tracing.traceOperation(
      'event.enrich',
      async (span: Span) => {
        // Llamadas en paralelo con observabilidad
        const [userData, metadata] = await Promise.all([
          this.fetchUserData(event.userId, span),
          this.fetchMetadata(event.type, span),
        ]);

        return {
          ...event,
          user: userData,
          metadata,
          enrichedAt: new Date().toISOString(),
        };
      },
      parentSpan.spanId,
      parentSpan.traceId
    );
  }

  /**
   * Ejemplo 4: Llamada externa con circuit breaker y propagación de contexto
   */
  private async fetchUserData(userId: string, parentSpan: Span) {
    return await this.tracing.traceOperation(
      'user.fetch',
      async (span: Span) => {
        this.observability.info('Fetching user data', {
          userId,
        });

        // Preparar headers con propagación de contexto
        const context = this.observability.getCurrentContext();
        const headers = {
          ...this.observability.getPropagatetionHeaders(context ?? undefined),
          ...this.tracing.injectTraceContext(span),
          'Content-Type': 'application/json',
        };

        // Usar circuit breaker
        return await this.circuitBreaker.execute(
          'user-service',
          async () => {
            this.observability.info('Obteniendo datos de usuario', { userId });

            const response = await firstValueFrom(
              this.http.get(`https://api.example.com/users/${userId}`, {
                headers,
                timeout: 5000,
              })
            );

            this.observability.info('Usuario obtenido', {
              statusCode: response.status,
            });

            return response.data;
          },
          {
            failureThreshold: 3,
            timeout: 10000,
          }
        );
      },
      parentSpan.spanId,
      parentSpan.traceId
    );
  }

  /**
   * Ejemplo 5: Envío de webhooks con manejo completo de errores
   */
  private async sendToWebhooks(event: any, parentSpan: Span) {
    return await this.tracing.traceOperation(
      'webhooks.send',
      async (span: Span) => {
        // Obtener webhooks configurados (simulado)
        const webhooks = await this.getConfiguredWebhooks(event.type);

        this.observability.info('Enviando a webhooks', {
          eventId: event.id,
          webhookCount: webhooks.length,
        });

        // Enviar a cada webhook con observabilidad
        const results = await Promise.allSettled(
          webhooks.map(webhook =>
            this.sendSingleWebhook(webhook, event, span)
          )
        );

        // Procesar resultados
        return results.map((result, index) => {
          const webhook = webhooks[index];
          
          if (result.status === 'fulfilled') {
            return {
              webhook: webhook.url,
              success: true,
              statusCode: result.value,
            };
          } else {
            return {
              webhook: webhook.url,
              success: false,
              error: result.reason.message,
            };
          }
        });
      },
      parentSpan.spanId,
      parentSpan.traceId
    );
  }

  /**
   * Ejemplo 6: Envío individual de webhook con observabilidad completa
   */
  private async sendSingleWebhook(
    webhook: any,
    event: any,
    parentSpan: Span
  ): Promise<number> {
    return await this.tracing.traceOperation(
      'webhook.send',
      async (span: Span) => {
        this.observability.info('Sending webhook', {
          webhookUrl: webhook.url,
          eventId: event.id,
          method: 'POST',
        });

        // Medir tiempo de envío
        return await this.observability.measureOperation(
          'webhook.http.post',
          async () => {
            // Preparar headers con propagación
            const context = this.observability.getCurrentContext();
            const headers = {
              ...this.observability.getPropagatetionHeaders(context ?? undefined),
              ...this.tracing.injectTraceContext(span),
              'Content-Type': 'application/json',
              'X-Event-Type': event.type,
              'X-Event-ID': event.id,
            };

            // Circuit breaker por webhook
            return await this.circuitBreaker.execute(
              `webhook-${webhook.url}`,
              async () => {
                this.observability.info('Enviando webhook', {
                  url: webhook.url,
                  eventId: event.id,
                });

                const response = await firstValueFrom(
                  this.http.post(webhook.url, event, {
                    headers,
                    timeout: 30000,
                  })
                );

                if (response.status >= 200 && response.status < 300) {
                  this.observability.info('Webhook enviado exitosamente', {
                    url: webhook.url,
                    statusCode: response.status,
                  });

                  this.observability.info('Webhook delivered', {
                    statusCode: response.status,
                  });
                } else {
                  throw new Error(`HTTP ${response.status}`);
                }

                return response.status;
              },
              {
                failureThreshold: 5,
                timeout: 60000,
              }
            );
          },
          {
            webhookUrl: webhook.url,
            eventId: event.id,
          }
        );
      },
      parentSpan.spanId,
      parentSpan.traceId
    );
  }

  /**
   * Ejemplo 7: Persistencia con manejo de errores
   */
  private async persistResult(
    event: any,
    webhookResults: any[],
    parentSpan: Span
  ) {
    return await this.tracing.traceOperation(
      'result.persist',
      async (span: Span) => {
        try {
          // Simular guardado en base de datos
          await new Promise(resolve => setTimeout(resolve, 50));

          this.observability.info('Resultado persistido', {
            eventId: event.id,
            webhooksSent: webhookResults.length,
          });
        } catch (error) {
          this.observability.error(
            'Error al persistir resultado',
            error as Error,
            { eventId: event.id }
          );
          throw error;
        }
      },
      parentSpan.spanId,
      parentSpan.traceId
    );
  }

  /**
   * Método auxiliar: Obtener webhooks configurados
   */
  private async getConfiguredWebhooks(eventType: string) {
    // Simulado - en producción obtener de DB
    return [
      { url: 'https://webhook1.example.com/events', eventTypes: ['*'] },
      { url: 'https://webhook2.example.com/events', eventTypes: [eventType] },
    ];
  }

  /**
   * Método auxiliar: Obtener metadata
   */
  private async fetchMetadata(eventType: string, parentSpan: Span) {
    return await this.tracing.traceOperation(
      'metadata.fetch',
      async (span: Span) => {
        // Simular obtención de metadata
        await new Promise(resolve => setTimeout(resolve, 30));
        
        return {
          eventType,
          version: '1.0',
          schema: 'https://schemas.example.com/event-v1.json',
        };
      },
      parentSpan.spanId,
      parentSpan.traceId
    );
  }
}

/**
 * EJEMPLO DE USO EN UN CONTROLADOR
 */

import { Controller, Post, Body, Headers, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('events')
export class EventsExampleController {
  constructor(
    private readonly eventService: ObservabilityExampleService,
    private readonly observability: ObservabilityService,
  ) {}

  @Post()
  async handleEvent(
    @Body() event: any,
    @Headers() headers: any,
    @Req() req: Request,
  ) {
    // Crear contexto de correlación desde el request
    const context = this.observability.createContext(req);

    // El contexto ya está disponible en el servicio
    const result = await this.eventService.processEvent(event);

    return result;
  }
}

/**
 * SALIDA DE EJEMPLO EN LOGS:
 * 
 * {
 *   "timestamp": "2025-12-15T10:30:00.123Z",
 *   "level": "info",
 *   "message": "HTTP Request recibido",
 *   "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "requestId": "x9y8z7w6-v5u4-3210-zyxw-vut9876543210",
 *   "metadata": {
 *     "method": "POST",
 *     "url": "/events",
 *     "userAgent": "curl/7.64.1"
 *   }
 * }
 * 
 * {
 *   "timestamp": "2025-12-15T10:30:00.150Z",
 *   "level": "info",
 *   "message": "Iniciando procesamiento de evento",
 *   "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "requestId": "x9y8z7w6-v5u4-3210-zyxw-vut9876543210",
 *   "metadata": {
 *     "eventId": "evt_123",
 *     "eventType": "producto.creado"
 *   }
 * }
 * 
 * {
 *   "timestamp": "2025-12-15T10:30:00.345Z",
 *   "level": "info",
 *   "message": "Webhook enviado exitosamente",
 *   "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "requestId": "x9y8z7w6-v5u4-3210-zyxw-vut9876543210",
 *   "metadata": {
 *     "url": "https://webhook1.example.com/events",
 *     "statusCode": 200
 *   }
 * }
 */
