import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  StandardWebhookDto,
  WebhookEventType,
  WebhookMetadata,
  WebhookHeaders,
  WebhookPayload,
  EventTransformationResultDto,
  TransformationConfig,
  ProductoPayload,
  PrescripcionPayload,
  ComparacionPayload,
} from './standard-webhook.dto';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService } from './distributed-tracing.service';
import { HmacSignatureService } from './hmac-signature.service';

/**
 * Event Transformer Service
 * 
 * Responsabilidades:
 * 1. Transformar eventos internos de RabbitMQ a formato estándar de webhook
 * 2. Aplicar validaciones y enriquecimiento de datos
 * 3. Generar headers HTTP estándar
 * 4. Mantener trazabilidad y observabilidad
 * 5. Aplicar reglas de transformación configurables
 * 6. Firmar payloads con HMAC-SHA256
 */
@Injectable()
export class EventTransformerService {
  private readonly logger = new Logger(EventTransformerService.name);
  private readonly TRANSFORMER_VERSION = '1.0.0';
  private readonly WEBHOOK_VERSION = '1.0.0';
  private readonly transformationConfigs: Map<string, TransformationConfig> = new Map();

  constructor(
    private readonly observability: ObservabilityService,
    private readonly tracing: DistributedTracingService,
    private readonly hmacService: HmacSignatureService,
  ) {
    this.initializeDefaultConfigs();
  }

  /**
   * Inicializar configuraciones por defecto
   */
  private initializeDefaultConfigs() {
    // Configuración para producto.creado
    this.transformationConfigs.set(WebhookEventType.PRODUCTO_CREADO, {
      eventType: WebhookEventType.PRODUCTO_CREADO,
      requiredFields: ['id', 'nombre'],
      enrichment: {
        addTimestamp: true,
        addSource: true,
        addVersion: true,
      },
    });

    // Configuración para producto.actualizado
    this.transformationConfigs.set(WebhookEventType.PRODUCTO_ACTUALIZADO, {
      eventType: WebhookEventType.PRODUCTO_ACTUALIZADO,
      requiredFields: ['id'],
      enrichment: {
        addTimestamp: true,
        addSource: true,
        addVersion: true,
      },
    });

    // Configuración para comparacion.completada
    this.transformationConfigs.set(WebhookEventType.COMPARACION_COMPLETADA, {
      eventType: WebhookEventType.COMPARACION_COMPLETADA,
      requiredFields: ['id', 'resultado'],
      enrichment: {
        addTimestamp: true,
        addSource: true,
        addVersion: true,
      },
    });
  }

  /**
   * Transformar evento de RabbitMQ a formato estándar de webhook
   * 
   * @param event Evento original de RabbitMQ
   * @param options Opciones adicionales de transformación
   * @returns Webhook en formato estándar
   */
  async transformToStandardWebhook(
    event: any,
    options?: {
      includeOriginalEvent?: boolean;
      customHeaders?: Record<string, string>;
      context?: any;
    },
  ): Promise<EventTransformationResultDto> {
    const startTime = Date.now();

    return await this.tracing.traceOperation(
      'event.transform',
      async (span) => {
        try {
          // Tags del span
          this.tracing.setSpanTags(span.spanId, {
            eventId: event.eventId,
            eventType: event.eventType,
            hasOriginalEvent: options?.includeOriginalEvent || false,
          });

          // Log inicio de transformación
          this.observability.info('Transformando evento a formato estándar', {
            eventId: event.eventId,
            eventType: event.eventType,
          });

          // Extraer metadata
          const metadata = this.extractMetadata(event);

          // Transformar payload según tipo de evento
          const payload = this.transformPayload(event);

          // Construir webhook estándar (sin headers aún)
          const webhookData = {
            metadata,
            payload,
            context: options?.context,
            links: this.generateLinks(event),
          };

          // Generar firma HMAC del payload completo
          const timestamp = Date.parse(metadata.timestamp);
          const signature = this.hmacService.generateSignature(webhookData, timestamp);

          // Generar headers estándar con la firma HMAC
          const headers = this.generateStandardHeaders(
            event, 
            metadata, 
            signature,
            options?.customHeaders
          );

          // Webhook completo con headers y firma
          const webhook: StandardWebhookDto = {
            ...webhookData,
            headers,
          };

          // Validar webhook
          const validated = this.validateWebhook(webhook);

          const transformationDuration = Date.now() - startTime;

          // Log completado
          this.observability.info('Evento transformado exitosamente', {
            eventId: event.eventId,
            eventType: event.eventType,
            duration: transformationDuration,
            validated,
          });

          // Retornar resultado
          return {
            webhook,
            originalEvent: options?.includeOriginalEvent ? event : undefined,
            transformationInfo: {
              transformedAt: new Date().toISOString(),
              transformationDuration,
              transformerVersion: this.TRANSFORMER_VERSION,
              validated,
              appliedRules: this.getAppliedRules(event.eventType),
            },
          };
        } catch (error) {
          this.observability.error('Error transformando evento', error, {
            eventId: event.eventId,
            eventType: event.eventType,
          });
          throw error;
        }
      },
    );
  }

  /**
   * Extraer metadata del evento
   */
  private extractMetadata(event: any): WebhookMetadata {
    return {
      eventId: event.eventId || `evt_${uuidv4()}`,
      eventType: event.eventType,
      timestamp: event.timestamp || new Date().toISOString(),
      version: this.WEBHOOK_VERSION,
      source: event.metadata?.source || 'comparador-service',
      correlationId: event.metadata?.correlationId || `corr_${uuidv4()}`,
      traceId: event.metadata?.traceId,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Transformar payload según tipo de evento
   */
  private transformPayload(event: any): WebhookPayload {
    const eventType = event.eventType;
    const config = this.transformationConfigs.get(eventType);

    let payload = { ...event.payload };

    // Aplicar enriquecimiento si está configurado
    if (config?.enrichment) {
      if (config.enrichment.addTimestamp) {
        payload.transformedAt = new Date().toISOString();
      }
      if (config.enrichment.addSource) {
        payload.sourceService = event.metadata?.source || 'comparador-service';
      }
      if (config.enrichment.addVersion) {
        payload.dataVersion = '1.0';
      }
    }

    // Omitir campos si está configurado
    if (config?.omitFields) {
      config.omitFields.forEach((field) => {
        delete payload[field];
      });
    }

    // Aplicar mapeo de campos si está configurado
    if (config?.fieldMapping) {
      Object.entries(config.fieldMapping).forEach(([oldKey, newKey]) => {
        if (payload[oldKey] !== undefined) {
          payload[newKey] = payload[oldKey];
          delete payload[oldKey];
        }
      });
    }

    // Transformaciones específicas por tipo
    switch (eventType) {
      case WebhookEventType.PRODUCTO_CREADO:
      case WebhookEventType.PRODUCTO_ACTUALIZADO:
        return this.transformProductoPayload(payload);

      case WebhookEventType.PRESCRIPCION_CREADA:
      case WebhookEventType.PRESCRIPCION_ACTUALIZADA:
        return this.transformPrescripcionPayload(payload);

      case WebhookEventType.COMPARACION_COMPLETADA:
        return this.transformComparacionPayload(payload);

      default:
        return payload;
    }
  }

  /**
   * Transformar payload de producto
   */
  private transformProductoPayload(payload: any): ProductoPayload {
    return {
      id: payload.id,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      precio: payload.precio,
      stock: payload.stock,
      categoria: payload.categoria,
      codigoBarras: payload.codigoBarras,
      proveedor: payload.proveedor,
      ...payload,
    };
  }

  /**
   * Transformar payload de prescripción
   */
  private transformPrescripcionPayload(payload: any): PrescripcionPayload {
    return {
      id: payload.id,
      paciente: payload.paciente,
      medico: payload.medico,
      medicamentos: payload.medicamentos,
      fechaEmision: payload.fechaEmision,
      estado: payload.estado,
      ...payload,
    };
  }

  /**
   * Transformar payload de comparación
   */
  private transformComparacionPayload(payload: any): ComparacionPayload {
    return {
      id: payload.id,
      prescripcionId: payload.prescripcionId,
      productoId: payload.productoId,
      resultado: payload.resultado,
      score: payload.score,
      detalles: payload.detalles,
      ...payload,
    };
  }

  /**
   * Generar headers HTTP estándar con firma HMAC
   */
  private generateStandardHeaders(
    event: any,
    metadata: WebhookMetadata,
    signature: string,
    customHeaders?: Record<string, string>,
  ): WebhookHeaders {
    const headers: WebhookHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `Comparador-Service/${this.WEBHOOK_VERSION}`,
      'X-Event-ID': metadata.eventId,
      'X-Event-Type': metadata.eventType,
      'X-Event-Time': metadata.timestamp,
      'X-Correlation-ID': metadata.correlationId,
      'X-Webhook-Version': this.WEBHOOK_VERSION,
      'X-Source-Service': metadata.source,
      'X-Webhook-Signature': signature,
    };

    // Agregar traceId si existe
    if (metadata.traceId) {
      headers['X-Trace-ID'] = metadata.traceId;
    }

    // Generar W3C Trace Context
    if (metadata.traceId && metadata.correlationId) {
      headers['traceparent'] = this.generateTraceParent(
        metadata.traceId,
        metadata.correlationId,
      );
    }

    // Agregar headers personalizados
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    return headers;
  }

  /**
   * Generar W3C Trace Context (traceparent)
   * Formato: version-trace-id-parent-id-trace-flags
   */
  private generateTraceParent(traceId: string, spanId: string): string {
    // Convertir IDs a formato hexadecimal de 32 y 16 caracteres
    const traceIdHex = this.toHex32(traceId);
    const spanIdHex = this.toHex16(spanId);
    return `00-${traceIdHex}-${spanIdHex}-01`;
  }

  /**
   * Convertir string a hexadecimal de 32 caracteres
   */
  private toHex32(str: string): string {
    const hash = require('crypto').createHash('md5').update(str).digest('hex');
    return hash.padStart(32, '0');
  }

  /**
   * Convertir string a hexadecimal de 16 caracteres
   */
  private toHex16(str: string): string {
    const hash = require('crypto').createHash('md5').update(str).digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Generar links relacionados (HATEOAS)
   */
  private generateLinks(event: any): StandardWebhookDto['links'] {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

    const links: StandardWebhookDto['links'] = {
      documentation: `${baseUrl}/docs/webhooks/${event.eventType}`,
    };

    // Agregar link al recurso específico si es posible
    if (event.payload?.id) {
      const resourceType = this.getResourceType(event.eventType);
      if (resourceType) {
        links.self = `${baseUrl}/${resourceType}/${event.payload.id}`;
      }
    }

    return links;
  }

  /**
   * Obtener tipo de recurso desde tipo de evento
   */
  private getResourceType(eventType: string): string | null {
    if (eventType.startsWith('producto.')) return 'productos';
    if (eventType.startsWith('prescripcion.')) return 'prescripciones';
    if (eventType.startsWith('comparacion.')) return 'comparaciones';
    return null;
  }

  /**
   * Validar webhook generado
   */
  private validateWebhook(webhook: StandardWebhookDto): boolean {
    try {
      // Validar metadata requerida
      if (!webhook.metadata?.eventId) return false;
      if (!webhook.metadata?.eventType) return false;
      if (!webhook.metadata?.timestamp) return false;
      if (!webhook.metadata?.correlationId) return false;

      // Validar payload no vacío
      if (!webhook.payload || Object.keys(webhook.payload).length === 0) {
        return false;
      }

      // Validar headers requeridos
      if (!webhook.headers?.['X-Event-ID']) return false;
      if (!webhook.headers?.['X-Correlation-ID']) return false;

      // Validar configuración específica del tipo de evento
      const config = this.transformationConfigs.get(webhook.metadata.eventType);
      if (config?.requiredFields) {
        for (const field of config.requiredFields) {
          if (webhook.payload[field] === undefined) {
            this.observability.warn('Campo requerido faltante', {
              field,
              eventType: webhook.metadata.eventType,
            });
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.observability.error('Error validando webhook', error);
      return false;
    }
  }

  /**
   * Obtener reglas aplicadas para un tipo de evento
   */
  private getAppliedRules(eventType: string): string[] {
    const config = this.transformationConfigs.get(eventType);
    const rules: string[] = [
      'standard_format', 
      'metadata_extraction', 
      'headers_generation',
      'hmac_signature',
    ];

    if (config?.enrichment) {
      if (config.enrichment.addTimestamp) rules.push('timestamp_enrichment');
      if (config.enrichment.addSource) rules.push('source_enrichment');
      if (config.enrichment.addVersion) rules.push('version_enrichment');
    }

    if (config?.fieldMapping) rules.push('field_mapping');
    if (config?.omitFields) rules.push('field_omission');
    if (config?.requiredFields) rules.push('field_validation');

    return rules;
  }

  /**
   * Registrar configuración personalizada para un tipo de evento
   */
  registerTransformationConfig(config: TransformationConfig): void {
    this.transformationConfigs.set(config.eventType, config);
    this.observability.info('Configuración de transformación registrada', {
      eventType: config.eventType,
    });
  }

  /**
   * Obtener configuración para un tipo de evento
   */
  getTransformationConfig(eventType: string): TransformationConfig | undefined {
    return this.transformationConfigs.get(eventType);
  }

  /**
   * Listar todos los tipos de eventos configurados
   */
  listConfiguredEventTypes(): string[] {
    return Array.from(this.transformationConfigs.keys());
  }

  /**
   * Transformar múltiples eventos en batch
   */
  async transformBatch(
    events: any[],
    options?: {
      includeOriginalEvent?: boolean;
      customHeaders?: Record<string, string>;
      context?: any;
    },
  ): Promise<EventTransformationResultDto[]> {
    return await this.tracing.traceOperation(
      'event.transform.batch',
      async (span) => {
        this.tracing.setSpanTags(span.spanId, {
          batchSize: events.length,
        });

        this.observability.info('Transformando batch de eventos', {
          count: events.length,
        });

        const results = await Promise.all(
          events.map((event) => this.transformToStandardWebhook(event, options)),
        );

        this.observability.info('Batch transformado exitosamente', {
          total: results.length,
          successful: results.filter((r) => r.transformationInfo.validated).length,
        });

        return results;
      },
    );
  }

  /**
   * Obtener estadísticas de transformación
   */
  getTransformationStats(): {
    totalConfigs: number;
    configuredEventTypes: string[];
    transformerVersion: string;
    webhookVersion: string;
  } {
    return {
      totalConfigs: this.transformationConfigs.size,
      configuredEventTypes: this.listConfiguredEventTypes(),
      transformerVersion: this.TRANSFORMER_VERSION,
      webhookVersion: this.WEBHOOK_VERSION,
    };
  }

  /**
   * Validar firma HMAC de un webhook recibido
   * 
   * @param webhook Webhook a validar
   * @param receivedSignature Firma recibida en el header X-Webhook-Signature
   * @returns true si la firma es válida
   */
  validateWebhookSignature(webhook: StandardWebhookDto, receivedSignature?: string): boolean {
    try {
      // Extraer firma del header si no se proporciona
      const signature = receivedSignature || webhook.headers?.['X-Webhook-Signature'];

      if (!signature) {
        this.observability.warn('Firma HMAC no encontrada en webhook');
        return false;
      }

      // Reconstruir datos para validación (sin headers)
      const dataToValidate = {
        metadata: webhook.metadata,
        payload: webhook.payload,
        context: webhook.context,
        links: webhook.links,
      };

      // Validar firma usando timestamp del evento
      const timestamp = Date.parse(webhook.metadata.timestamp);
      const isValid = this.hmacService.validateSignature(
        dataToValidate,
        signature,
        timestamp,
      );

      if (isValid) {
        this.observability.info('Firma HMAC validada exitosamente', {
          eventId: webhook.metadata.eventId,
        });
      } else {
        this.observability.warn('Firma HMAC inválida', {
          eventId: webhook.metadata.eventId,
        });
      }

      return isValid;
    } catch (error) {
      this.observability.error('Error validando firma HMAC', error, {
        eventId: webhook.metadata?.eventId,
      });
      return false;
    }
  }

  /**
   * Re-firmar un webhook (útil para reenvíos)
   * 
   * @param webhook Webhook a re-firmar
   * @returns Webhook con nueva firma
   */
  resignWebhook(webhook: StandardWebhookDto): StandardWebhookDto {
    try {
      // Datos a firmar (sin headers)
      const dataToSign = {
        metadata: webhook.metadata,
        payload: webhook.payload,
        context: webhook.context,
        links: webhook.links,
      };

      // Generar nueva firma
      const timestamp = Date.parse(webhook.metadata.timestamp);
      const newSignature = this.hmacService.generateSignature(dataToSign, timestamp);

      // Actualizar header de firma
      const updatedHeaders = {
        ...webhook.headers,
        'X-Webhook-Signature': newSignature,
      };

      this.observability.info('Webhook re-firmado', {
        eventId: webhook.metadata.eventId,
      });

      return {
        ...webhook,
        headers: updatedHeaders,
      };
    } catch (error) {
      this.observability.error('Error re-firmando webhook', error, {
        eventId: webhook.metadata?.eventId,
      });
      throw error;
    }
  }
}
