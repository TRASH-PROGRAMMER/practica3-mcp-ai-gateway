import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { EventTransformerService } from './event-transformer.service';
import type {
  StandardWebhookDto,
  EventTransformationResultDto,
  TransformationConfig,
} from './standard-webhook.dto';
import { WebhookEventType } from './standard-webhook.dto';
import { ObservabilityService } from './observability.service';

/**
 * Event Transformer Controller
 * 
 * API REST para transformación y consulta de eventos en formato estándar
 * 
 * Endpoints:
 * - POST /events/transform - Transformar evento único
 * - POST /events/transform/batch - Transformar múltiples eventos
 * - GET /events/transform/config - Ver configuraciones
 * - POST /events/transform/config - Registrar configuración
 * - GET /events/transform/stats - Estadísticas de transformación
 * - GET /events/transform/example/:eventType - Ejemplo de formato
 */
@Controller('events/transform')
export class EventTransformerController {
  constructor(
    private readonly transformer: EventTransformerService,
    private readonly observability: ObservabilityService,
  ) {}

  /**
   * Transformar un evento único a formato estándar
   * 
   * @example
   * POST /events/transform
   * {
   *   "eventId": "evt_123",
   *   "eventType": "producto.creado",
   *   "timestamp": "2025-12-15T10:30:00.000Z",
   *   "payload": {
   *     "id": "prod_123",
   *     "nombre": "Aspirina 500mg",
   *     "precio": 15.50
   *   },
   *   "metadata": {
   *     "correlationId": "corr_abc123",
   *     "source": "productos-service"
   *   }
   * }
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async transformEvent(
    @Body() event: any,
    @Query('includeOriginal') includeOriginal?: string,
    @Query('addContext') addContext?: string,
  ): Promise<EventTransformationResultDto> {
    const context = this.observability.createContext();

    this.observability.info('Solicitud de transformación de evento', {
      eventId: event.eventId,
      eventType: event.eventType,
    });

    const result = await this.transformer.transformToStandardWebhook(event, {
      includeOriginalEvent: includeOriginal === 'true',
      context: addContext === 'true' ? { requestedAt: new Date().toISOString() } : undefined,
    });

    this.observability.info('Evento transformado exitosamente', {
      eventId: event.eventId,
      validated: result.transformationInfo.validated,
    });

    return result;
  }

  /**
   * Transformar múltiples eventos en batch
   * 
   * @example
   * POST /events/transform/batch
   * {
   *   "events": [
   *     { "eventId": "evt_1", "eventType": "producto.creado", ... },
   *     { "eventId": "evt_2", "eventType": "producto.actualizado", ... }
   *   ],
   *   "options": {
   *     "includeOriginalEvent": false
   *   }
   * }
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async transformBatch(
    @Body() body: { events: any[]; options?: any },
  ): Promise<{
    results: EventTransformationResultDto[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      avgTransformationTime: number;
    };
  }> {
    this.observability.info('Solicitud de transformación batch', {
      count: body.events.length,
    });

    const results = await this.transformer.transformBatch(body.events, body.options);

    const successful = results.filter((r) => r.transformationInfo.validated).length;
    const failed = results.length - successful;
    const avgTime =
      results.reduce((sum, r) => sum + r.transformationInfo.transformationDuration, 0) /
      results.length;

    this.observability.info('Batch transformado', {
      total: results.length,
      successful,
      failed,
    });

    return {
      results,
      summary: {
        total: results.length,
        successful,
        failed,
        avgTransformationTime: Math.round(avgTime * 100) / 100,
      },
    };
  }

  /**
   * Obtener configuraciones de transformación
   * 
   * @example
   * GET /events/transform/config
   * GET /events/transform/config?eventType=producto.creado
   */
  @Get('config')
  async getConfig(@Query('eventType') eventType?: string): Promise<any> {
    if (eventType) {
      const config = this.transformer.getTransformationConfig(eventType);
      if (!config) {
        return {
          message: 'Configuración no encontrada',
          eventType,
          availableTypes: this.transformer.listConfiguredEventTypes(),
        };
      }
      return { eventType, config };
    }

    const configuredTypes = this.transformer.listConfiguredEventTypes();
    const configs = {};
    configuredTypes.forEach((type) => {
      configs[type] = this.transformer.getTransformationConfig(type);
    });

    return {
      totalConfigs: configuredTypes.length,
      eventTypes: configuredTypes,
      configs,
    };
  }

  /**
   * Registrar una nueva configuración de transformación
   * 
   * @example
   * POST /events/transform/config
   * {
   *   "eventType": "producto.importado",
   *   "requiredFields": ["id", "nombre", "importadoDe"],
   *   "enrichment": {
   *     "addTimestamp": true,
   *     "addSource": true
   *   },
   *   "customHeaders": {
   *     "X-Import-Source": "external-api"
   *   }
   * }
   */
  @Post('config')
  @HttpCode(HttpStatus.CREATED)
  async registerConfig(@Body() config: TransformationConfig): Promise<{
    message: string;
    config: TransformationConfig;
  }> {
    this.observability.info('Registrando configuración de transformación', {
      eventType: config.eventType,
    });

    this.transformer.registerTransformationConfig(config);

    return {
      message: 'Configuración registrada exitosamente',
      config,
    };
  }

  /**
   * Obtener estadísticas de transformación
   * 
   * @example
   * GET /events/transform/stats
   */
  @Get('stats')
  async getStats(): Promise<any> {
    const stats = this.transformer.getTransformationStats();

    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      ...stats,
      availableEventTypes: Object.values(WebhookEventType),
    };
  }

  /**
   * Obtener ejemplo de formato estándar para un tipo de evento
   * 
   * @example
   * GET /events/transform/example/producto.creado
   * GET /events/transform/example/prescripcion.actualizada
   */
  @Get('example/:eventType')
  async getExample(@Param('eventType') eventType: string): Promise<{
    eventType: string;
    description: string;
    inputExample: any;
    outputExample: StandardWebhookDto;
  }> {
    const examples = {
      'producto.creado': {
        description: 'Evento emitido cuando se crea un nuevo producto',
        inputExample: {
          eventId: 'evt_a1b2c3d4',
          eventType: 'producto.creado',
          timestamp: '2025-12-15T10:30:00.000Z',
          payload: {
            id: 'prod_123',
            nombre: 'Aspirina 500mg',
            descripcion: 'Analgésico y antipirético',
            precio: 15.5,
            stock: 100,
            categoria: 'Medicamentos',
          },
          metadata: {
            correlationId: 'corr_x9y8z7w6',
            source: 'productos-service',
          },
        },
        outputExample: {
          metadata: {
            eventId: 'evt_a1b2c3d4',
            eventType: 'producto.creado',
            timestamp: '2025-12-15T10:30:00.000Z',
            version: '1.0.0',
            source: 'productos-service',
            correlationId: 'corr_x9y8z7w6',
            environment: 'production',
          },
          payload: {
            id: 'prod_123',
            nombre: 'Aspirina 500mg',
            descripcion: 'Analgésico y antipirético',
            precio: 15.5,
            stock: 100,
            categoria: 'Medicamentos',
            transformedAt: '2025-12-15T10:30:00.123Z',
            sourceService: 'productos-service',
            dataVersion: '1.0',
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Comparador-Service/1.0.0',
            'X-Event-ID': 'evt_a1b2c3d4',
            'X-Event-Type': 'producto.creado',
            'X-Event-Time': '2025-12-15T10:30:00.000Z',
            'X-Correlation-ID': 'corr_x9y8z7w6',
            'X-Webhook-Version': '1.0.0',
            'X-Source-Service': 'productos-service',
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
          links: {
            self: 'http://localhost:3001/productos/prod_123',
            documentation: 'http://localhost:3001/docs/webhooks/producto.creado',
          },
        },
      },
      'prescripcion.actualizada': {
        description: 'Evento emitido cuando se actualiza una prescripción',
        inputExample: {
          eventId: 'evt_b2c3d4e5',
          eventType: 'prescripcion.actualizada',
          timestamp: '2025-12-15T11:00:00.000Z',
          payload: {
            id: 'presc_456',
            paciente: 'Juan Pérez',
            estado: 'validada',
            medicamentos: [
              { nombre: 'Aspirina 500mg', dosis: '1 tableta', frecuencia: 'Cada 8 horas' },
            ],
          },
          metadata: {
            correlationId: 'corr_y8z7w6v5',
            source: 'prescripciones-service',
          },
        },
        outputExample: {
          metadata: {
            eventId: 'evt_b2c3d4e5',
            eventType: 'prescripcion.actualizada',
            timestamp: '2025-12-15T11:00:00.000Z',
            version: '1.0.0',
            source: 'prescripciones-service',
            correlationId: 'corr_y8z7w6v5',
            environment: 'production',
          },
          payload: {
            id: 'presc_456',
            paciente: 'Juan Pérez',
            estado: 'validada',
            medicamentos: [
              { nombre: 'Aspirina 500mg', dosis: '1 tableta', frecuencia: 'Cada 8 horas' },
            ],
            transformedAt: '2025-12-15T11:00:00.456Z',
            sourceService: 'prescripciones-service',
            dataVersion: '1.0',
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Comparador-Service/1.0.0',
            'X-Event-ID': 'evt_b2c3d4e5',
            'X-Event-Type': 'prescripcion.actualizada',
            'X-Event-Time': '2025-12-15T11:00:00.000Z',
            'X-Correlation-ID': 'corr_y8z7w6v5',
            'X-Webhook-Version': '1.0.0',
            'X-Source-Service': 'prescripciones-service',
            traceparent: '00-5cf92f3577b34da6a3ce929d0e0e5847-00f067aa0ba902b8-01',
          },
          links: {
            self: 'http://localhost:3001/prescripciones/presc_456',
            documentation: 'http://localhost:3001/docs/webhooks/prescripcion.actualizada',
          },
        },
      },
      'comparacion.completada': {
        description: 'Evento emitido cuando se completa una comparación',
        inputExample: {
          eventId: 'evt_c3d4e5f6',
          eventType: 'comparacion.completada',
          timestamp: '2025-12-15T12:00:00.000Z',
          payload: {
            id: 'comp_789',
            prescripcionId: 'presc_456',
            productoId: 'prod_123',
            resultado: 'compatible',
            score: 95.5,
            detalles: {
              coincidencias: ['principio_activo', 'dosis'],
              alertas: [],
            },
          },
          metadata: {
            correlationId: 'corr_z7w6v5u4',
            source: 'comparador-service',
          },
        },
        outputExample: {
          metadata: {
            eventId: 'evt_c3d4e5f6',
            eventType: 'comparacion.completada',
            timestamp: '2025-12-15T12:00:00.000Z',
            version: '1.0.0',
            source: 'comparador-service',
            correlationId: 'corr_z7w6v5u4',
            environment: 'production',
          },
          payload: {
            id: 'comp_789',
            prescripcionId: 'presc_456',
            productoId: 'prod_123',
            resultado: 'compatible',
            score: 95.5,
            detalles: {
              coincidencias: ['principio_activo', 'dosis'],
              alertas: [],
            },
            transformedAt: '2025-12-15T12:00:00.789Z',
            sourceService: 'comparador-service',
            dataVersion: '1.0',
          },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Comparador-Service/1.0.0',
            'X-Event-ID': 'evt_c3d4e5f6',
            'X-Event-Type': 'comparacion.completada',
            'X-Event-Time': '2025-12-15T12:00:00.000Z',
            'X-Correlation-ID': 'corr_z7w6v5u4',
            'X-Webhook-Version': '1.0.0',
            'X-Source-Service': 'comparador-service',
            traceparent: '00-6df92f3577b34da6a3ce929d0e0e6958-00f067aa0ba902b9-01',
          },
          links: {
            self: 'http://localhost:3001/comparaciones/comp_789',
            related: [
              'http://localhost:3001/prescripciones/presc_456',
              'http://localhost:3001/productos/prod_123',
            ],
            documentation: 'http://localhost:3001/docs/webhooks/comparacion.completada',
          },
        },
      },
    };

    const example = examples[eventType];

    if (!example) {
      return {
        eventType,
        description: 'Tipo de evento no reconocido',
        inputExample: null,
        outputExample: null as any,
      };
    }

    return {
      eventType,
      ...example,
    };
  }

  /**
   * Validar formato de un webhook
   * 
   * @example
   * POST /events/transform/validate
   * {
   *   "metadata": { ... },
   *   "payload": { ... },
   *   "headers": { ... }
   * }
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateWebhook(@Body() webhook: StandardWebhookDto): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    hmacValid?: boolean;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar metadata
    if (!webhook.metadata) {
      errors.push('metadata es requerida');
    } else {
      if (!webhook.metadata.eventId) errors.push('metadata.eventId es requerido');
      if (!webhook.metadata.eventType) errors.push('metadata.eventType es requerido');
      if (!webhook.metadata.timestamp) errors.push('metadata.timestamp es requerido');
      if (!webhook.metadata.correlationId) errors.push('metadata.correlationId es requerido');
    }

    // Validar payload
    if (!webhook.payload) {
      errors.push('payload es requerido');
    } else if (Object.keys(webhook.payload).length === 0) {
      warnings.push('payload está vacío');
    }

    // Validar headers
    if (!webhook.headers) {
      errors.push('headers son requeridos');
    } else {
      if (!webhook.headers['X-Event-ID']) errors.push('X-Event-ID header es requerido');
      if (!webhook.headers['X-Correlation-ID'])
        errors.push('X-Correlation-ID header es requerido');
      if (!webhook.headers['Content-Type']) warnings.push('Content-Type header es recomendado');
    }

    // Validar firma HMAC si está presente
    let hmacValid: boolean | undefined = undefined;
    if (webhook.headers?.['X-Webhook-Signature']) {
      hmacValid = this.transformer.validateWebhookSignature(webhook);
      if (!hmacValid) {
        warnings.push('Firma HMAC inválida');
      }
    } else {
      warnings.push('Firma HMAC no presente (X-Webhook-Signature header)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      hmacValid,
    };
  }

  /**
   * Validar firma HMAC de un webhook
   * 
   * @example
   * POST /events/transform/validate-signature
   * {
   *   "webhook": { ... },
   *   "signature": "sha256=a1b2c3d4..."
   * }
   */
  @Post('validate-signature')
  @HttpCode(HttpStatus.OK)
  async validateSignature(
    @Body() body: { webhook: StandardWebhookDto; signature?: string },
  ): Promise<{
    valid: boolean;
    message: string;
    eventId?: string;
  }> {
    this.observability.info('Validando firma HMAC', {
      eventId: body.webhook.metadata?.eventId,
    });

    const isValid = this.transformer.validateWebhookSignature(
      body.webhook,
      body.signature,
    );

    return {
      valid: isValid,
      message: isValid
        ? 'Firma HMAC válida'
        : 'Firma HMAC inválida o no encontrada',
      eventId: body.webhook.metadata?.eventId,
    };
  }

  /**
   * Re-firmar un webhook
   * 
   * @example
   * POST /events/transform/resign
   * {
   *   "metadata": { ... },
   *   "payload": { ... },
   *   "headers": { ... }
   * }
   */
  @Post('resign')
  @HttpCode(HttpStatus.OK)
  async resignWebhook(@Body() webhook: StandardWebhookDto): Promise<{
    webhook: StandardWebhookDto;
    message: string;
  }> {
    this.observability.info('Re-firmando webhook', {
      eventId: webhook.metadata?.eventId,
    });

    const resignedWebhook = this.transformer.resignWebhook(webhook);

    return {
      webhook: resignedWebhook,
      message: 'Webhook re-firmado exitosamente',
    };
  }
}
