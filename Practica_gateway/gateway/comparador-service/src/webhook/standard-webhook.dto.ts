/**
 * DTO para el formato estándar de webhook
 * Compatible con CloudEvents Specification y webhooks REST estándar
 */

/**
 * Tipo de evento para webhooks
 */
export enum WebhookEventType {
  // Eventos de productos
  PRODUCTO_CREADO = 'producto.creado',
  PRODUCTO_ACTUALIZADO = 'producto.actualizado',
  PRODUCTO_ELIMINADO = 'producto.eliminado',
  
  // Eventos de prescripciones
  PRESCRIPCION_CREADA = 'prescripcion.creada',
  PRESCRIPCION_ACTUALIZADA = 'prescripcion.actualizada',
  PRESCRIPCION_VALIDADA = 'prescripcion.validada',
  
  // Eventos de comparación
  COMPARACION_INICIADA = 'comparacion.iniciada',
  COMPARACION_COMPLETADA = 'comparacion.completada',
  COMPARACION_FALLIDA = 'comparacion.fallida',
  
  // Eventos del sistema
  SISTEMA_NOTIFICACION = 'sistema.notificacion',
  SISTEMA_ALERTA = 'sistema.alerta',
  SISTEMA_ERROR = 'sistema.error',
}

/**
 * Metadata estándar del webhook
 */
export interface WebhookMetadata {
  /**
   * ID único del evento
   * @example "evt_a1b2c3d4e5f67890"
   */
  eventId: string;

  /**
   * Tipo de evento
   * @example "producto.creado"
   */
  eventType: WebhookEventType | string;

  /**
   * Timestamp del evento en formato ISO 8601
   * @example "2025-12-15T10:30:00.000Z"
   */
  timestamp: string;

  /**
   * Versión del formato de webhook
   * @example "1.0.0"
   */
  version: string;

  /**
   * Servicio que originó el evento
   * @example "comparador-service"
   */
  source: string;

  /**
   * ID de correlación para trazabilidad
   * @example "corr_x9y8z7w6v5u4t3s2"
   */
  correlationId: string;

  /**
   * ID de traza para distributed tracing
   * @example "trace_123abc456def"
   */
  traceId?: string;

  /**
   * Environment del servicio
   * @example "production"
   */
  environment?: string;

  /**
   * Información adicional del evento
   */
  [key: string]: any;
}

/**
 * Payload del producto
 */
export interface ProductoPayload {
  id: string;
  nombre: string;
  descripcion?: string;
  precio?: number;
  stock?: number;
  categoria?: string;
  codigoBarras?: string;
  proveedor?: string;
  [key: string]: any;
}

/**
 * Payload de prescripción
 */
export interface PrescripcionPayload {
  id: string;
  paciente?: string;
  medico?: string;
  medicamentos?: Array<{
    nombre: string;
    dosis: string;
    frecuencia: string;
  }>;
  fechaEmision?: string;
  estado?: string;
  [key: string]: any;
}

/**
 * Payload de comparación
 */
export interface ComparacionPayload {
  id: string;
  prescripcionId?: string;
  productoId?: string;
  resultado?: 'compatible' | 'incompatible' | 'revision_requerida';
  score?: number;
  detalles?: any;
  [key: string]: any;
}

/**
 * Payload genérico del webhook
 */
export type WebhookPayload = 
  | ProductoPayload 
  | PrescripcionPayload 
  | ComparacionPayload 
  | Record<string, any>;

/**
 * Headers HTTP estándar para webhooks
 */
export interface WebhookHeaders {
  /**
   * Content-Type del payload
   * @example "application/json"
   */
  'Content-Type': string;

  /**
   * User-Agent del servicio
   * @example "Comparador-Service/1.0"
   */
  'User-Agent': string;

  /**
   * ID del evento para idempotencia
   * @example "evt_a1b2c3d4e5f67890"
   */
  'X-Event-ID': string;

  /**
   * Tipo de evento
   * @example "producto.creado"
   */
  'X-Event-Type': string;

  /**
   * Timestamp del evento
   * @example "2025-12-15T10:30:00.000Z"
   */
  'X-Event-Time': string;

  /**
   * ID de correlación
   * @example "corr_x9y8z7w6v5u4t3s2"
   */
  'X-Correlation-ID': string;

  /**
   * ID de traza
   * @example "trace_123abc456def"
   */
  'X-Trace-ID'?: string;

  /**
   * Firma HMAC para seguridad
   * Generada automáticamente con HMAC-SHA256
   * @example "sha256=a1b2c3d4..."
   */
  'X-Webhook-Signature': string;

  /**
   * Versión del formato
   * @example "1.0.0"
   */
  'X-Webhook-Version': string;

  /**
   * Servicio origen
   * @example "comparador-service"
   */
  'X-Source-Service': string;

  /**
   * W3C Trace Context
   * @example "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
   */
  traceparent?: string;

  /**
   * Headers adicionales
   */
  [key: string]: string | undefined;
}

/**
 * Formato estándar de webhook
 * Compatible con CloudEvents y REST webhooks estándar
 */
export class StandardWebhookDto {
  /**
   * Metadata del evento
   */
  metadata: WebhookMetadata;

  /**
   * Payload del evento (datos específicos)
   */
  payload: WebhookPayload;

  /**
   * Headers HTTP recomendados para el envío
   */
  headers: WebhookHeaders;

  /**
   * Contexto adicional (opcional)
   */
  context?: {
    /**
     * Usuario que generó el evento
     */
    user?: string;

    /**
     * Tenant ID (multi-tenancy)
     */
    tenantId?: string;

    /**
     * IP origen
     */
    sourceIp?: string;

    /**
     * Información adicional
     */
    [key: string]: any;
  };

  /**
   * Links relacionados (HATEOAS)
   */
  links?: {
    /**
     * URL del recurso
     */
    self?: string;

    /**
     * URL del recurso relacionado
     */
    related?: string[];

    /**
     * Documentación del evento
     */
    documentation?: string;
  };
}

/**
 * Respuesta de transformación
 */
export class EventTransformationResultDto {
  /**
   * Webhook en formato estándar
   */
  webhook: StandardWebhookDto;

  /**
   * Evento original de RabbitMQ
   */
  originalEvent: any;

  /**
   * Información de la transformación
   */
  transformationInfo: {
    /**
     * Timestamp de transformación
     */
    transformedAt: string;

    /**
     * Duración de la transformación (ms)
     */
    transformationDuration: number;

    /**
     * Versión del transformador
     */
    transformerVersion: string;

    /**
     * Validación exitosa
     */
    validated: boolean;

    /**
     * Reglas aplicadas
     */
    appliedRules?: string[];
  };
}

/**
 * Configuración de transformación por tipo de evento
 */
export interface TransformationConfig {
  /**
   * Tipo de evento
   */
  eventType: string;

  /**
   * Mapeo de campos
   */
  fieldMapping?: Record<string, string>;

  /**
   * Campos requeridos
   */
  requiredFields?: string[];

  /**
   * Campos a omitir
   */
  omitFields?: string[];

  /**
   * Headers adicionales personalizados
   */
  customHeaders?: Record<string, string>;

  /**
   * Enriquecimiento del payload
   */
  enrichment?: {
    addTimestamp?: boolean;
    addSource?: boolean;
    addVersion?: boolean;
  };

  /**
   * Validaciones personalizadas
   */
  validations?: Array<{
    field: string;
    rule: string;
    message: string;
  }>;
}
