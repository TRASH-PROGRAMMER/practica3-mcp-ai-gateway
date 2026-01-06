import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookSenderService, WebhookSubscription, WebhookDeliveryResult } from './webhook-sender.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService } from './distributed-tracing.service';
import { StandardWebhookDto } from './standard-webhook.dto';
import { SupabaseService } from './supabase.service';

/**
 * Registro de entrega de webhook
 */
export interface DeliveryRecord {
  id: string;
  subscriptionId: number;
  eventId: string;
  eventType: string;
  success: boolean;
  attempt: number;
  responseTime: number;
  statusCode?: number;
  error?: string;
  deliveredAt: Date;
}

/**
 * Estadísticas de entrega
 */
export interface DeliveryStats {
  total: number;
  successful: number;
  failed: number;
  avgResponseTime: number;
  successRate: number;
  bySubscription: Record<number, {
    total: number;
    successful: number;
    failed: number;
  }>;
}

/**
 * Servicio orquestador de entrega de webhooks
 * 
 * Responsabilidades:
 * - ✅ Gestión de suscripciones de webhook
 * - ✅ Orquestación de envío a múltiples URLs
 * - ✅ Registro de entregas en base de datos
 * - ✅ Integración con DLQ para fallos
 * - ✅ Métricas y estadísticas de entrega
 * - ✅ Distributed tracing
 * - ✅ Reintentos automáticos desde DLQ
 */
@Injectable()
export class WebhookDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  
  // Simulación de base de datos en memoria
  // En producción, conectar a Supabase
  private subscriptions: Map<number, WebhookSubscription> = new Map();
  private deliveryRecords: DeliveryRecord[] = [];
  private nextSubscriptionId = 1;

  constructor(
    private readonly senderService: WebhookSenderService,
    private readonly dlq: DeadLetterQueueService,
    private readonly observability: ObservabilityService,
    private readonly tracing: DistributedTracingService,
    private readonly supabase: SupabaseService,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 WebhookDeliveryService inicializado');
    this.loadSubscriptionsFromDatabase();
  }

  /**
   * Carga suscripciones desde la base de datos
   * TODO: Conectar a Supabase webhook_subscriptions
   */
  private loadSubscriptionsFromDatabase() {
    // Suscripciones de ejemplo
    this.addSubscription({
      name: 'Sistema de Notificaciones',
      endpointUrl: 'https://api.example.com/webhooks/notifications',
      secret: 'secret-notifications-123',
      events: ['prescripcion.*', 'producto.creado'],
      retryConfig: {
        maxAttempts: 3,
        baseDelay: 1000,    // 1s
        multiplier: 2,      // 2x
        maxDelay: 30000,    // 30s max
      },
    });

    this.addSubscription({
      name: 'Sistema de Analytics',
      endpointUrl: 'https://analytics.example.com/webhooks',
      secret: 'secret-analytics-456',
      events: ['*'], // Todos los eventos
      retryConfig: {
        maxAttempts: 5,
        baseDelay: 2000,    // 2s
        multiplier: 3,      // 3x (más agresivo)
        maxDelay: 60000,    // 1min max
        enableJitter: true,
      },
    });

    this.logger.log(`✅ Cargadas ${this.subscriptions.size} suscripciones`);
  }

  /**
   * Entrega un webhook a todas las suscripciones aplicables
   */
  async deliverWebhook(webhook: StandardWebhookDto): Promise<DeliveryRecord[]> {
    const eventType = webhook.metadata.eventType;
    const eventId = webhook.metadata.eventId;

    this.observability.info('Iniciando entrega de webhook', {
      eventId,
      eventType,
      totalSubscriptions: this.subscriptions.size,
    });

    // Crear span de tracing
    const span = this.tracing.startSpan('webhook-delivery', `${eventId}-${eventType}`);

    try {
      // Filtrar suscripciones aplicables
      const applicableSubscriptions = Array.from(this.subscriptions.values()).filter(
        (sub) => this.senderService.shouldSendToSubscription(eventType, sub),
      );

      this.observability.info('Suscripciones aplicables encontradas', {
        eventId,
        eventType,
        applicableCount: applicableSubscriptions.length,
        subscriptions: applicableSubscriptions.map(s => ({ id: s.id, name: s.name })),
      });

      if (applicableSubscriptions.length === 0) {
        this.observability.info('No hay suscripciones para este evento', { eventId, eventType });
        this.tracing.finishSpan(span.spanId);
        return [];
      }

      // Enviar a todas las suscripciones en paralelo
      const deliveryPromises = applicableSubscriptions.map(async (subscription) => {
        const childSpan = this.tracing.startSpan(
          'webhook-send',
          `sub-${subscription.id}`,
        );

        try {
          const result = await this.senderService.sendWebhook(webhook, subscription);
          
          // Registrar entrega en memoria Y base de datos
          const record = await this.recordDelivery(subscription.id, eventId, eventType, result, webhook);

          // Si falló, agregar a DLQ
          if (!result.success) {
            await this.dlq.addToQueue(
              eventId,
              eventType,
              webhook,
              result.error || 'Unknown error',
            );
          }

          this.tracing.finishSpan(childSpan.spanId);
          return record;
        } catch (error) {
          this.observability.error('Error al entregar webhook', error as Error, {
            subscriptionId: subscription.id,
            eventId,
          });
          
          this.tracing.finishSpan(childSpan.spanId);
          
          return await this.recordDelivery(subscription.id, eventId, eventType, {
            success: false,
            responseTime: 0,
            attempt: 1,
            error: error instanceof Error ? error.message : 'Unknown error',
          }, webhook);
        }
      });

      const records = await Promise.all(deliveryPromises);

      // Resumen de entregas
      const successful = records.filter((r) => r.success).length;
      const failed = records.filter((r) => !r.success).length;

      this.observability.info('Entrega de webhook completada', {
        eventId,
        eventType,
        totalSent: records.length,
        successful,
        failed,
      });

      this.tracing.finishSpan(span.spanId);
      return records;
    } catch (error) {
      this.observability.error('Error al entregar webhook', error as Error, { eventId, eventType });
      this.tracing.finishSpan(span.spanId);
      throw error;
    }
  }

  /**
   * Registra una entrega en memoria Y en base de datos Supabase
   */
  private async recordDelivery(
    subscriptionId: number,
    eventId: string,
    eventType: string,
    result: WebhookDeliveryResult,
    webhook: StandardWebhookDto,
  ): Promise<DeliveryRecord> {
    const record: DeliveryRecord = {
      id: `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subscriptionId,
      eventId,
      eventType,
      success: result.success,
      attempt: result.attempt,
      responseTime: result.responseTime,
      statusCode: result.statusCode,
      error: result.error,
      deliveredAt: new Date(),
    };

    // Registrar en memoria para consultas rápidas
    this.deliveryRecords.push(record);

    // Mantener solo las últimas 1000 entregas en memoria
    if (this.deliveryRecords.length > 1000) {
      this.deliveryRecords = this.deliveryRecords.slice(-1000);
    }

    // Registrar en base de datos Supabase
    if (this.supabase.isConfigured()) {
      try {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
          await this.supabase.insertDelivery({
            subscription_id: subscriptionId,
            event_id: eventId,
            event_type: eventType,
            endpoint_url: subscription.endpointUrl,
            http_status: result.statusCode,
            success: result.success,
            attempt_number: result.attempt,
            response_time_ms: result.responseTime,
            error_message: result.error,
            request_payload: webhook,
            response_body: result.responseBody,
          });

          this.observability.info('Delivery registrado en Supabase', {
            subscriptionId,
            eventId,
            attempt: result.attempt,
          });
        }
      } catch (error) {
        this.observability.error('Error al registrar delivery en Supabase', error as Error, {
          subscriptionId,
          eventId,
        });
      }
    }

    return record;
  }

  /**
   * Reintenta entregas fallidas desde la DLQ
   * Se ejecuta cada 5 minutos
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedDeliveries() {
    this.logger.log('🔄 Reintentando entregas fallidas desde DLQ...');

    const allMessages = this.dlq.getAll();
    const pendingMessages = allMessages.filter(m => m.status === 'pending');

    if (pendingMessages.length === 0) {
      this.logger.log('✅ No hay mensajes pendientes en DLQ');
      return;
    }

    this.logger.log(`📤 Reintentando ${pendingMessages.length} mensajes...`);

    for (const message of pendingMessages) {
      try {
        const webhook = message.payload as StandardWebhookDto;
        
        // En un escenario real, necesitaríamos guardar el subscriptionId en el payload
        // Por ahora, reintentamos enviando a todas las suscripciones aplicables
        const deliveries = await this.deliverWebhook(webhook);
        
        if (deliveries.some(d => d.success)) {
          // Al menos una entrega exitosa, marcar como recuperado
          this.logger.log(`✅ Mensaje recuperado exitosamente: ${message.eventId}`);
          // El DLQ ya maneja la limpieza automática en su cron job
        } else {
          this.logger.warn(`❌ Fallo al reintentar mensaje: ${message.eventId}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error al reintentar mensaje: ${message.eventId}`, error);
      }
    }

    this.logger.log('✅ Reintentos completados');
  }

  // ============================================
  // GESTIÓN DE SUSCRIPCIONES
  // ============================================

  /**
   * Agrega una nueva suscripción
   */
  addSubscription(data: Omit<WebhookSubscription, 'id' | 'active'>): WebhookSubscription {
    const subscription: WebhookSubscription = {
      id: this.nextSubscriptionId++,
      ...data,
      active: true,
    };

    this.subscriptions.set(subscription.id, subscription);

    this.observability.info('Suscripción creada', {
      subscriptionId: subscription.id,
      name: subscription.name,
      url: subscription.endpointUrl,
    });

    return subscription;
  }

  /**
   * Actualiza una suscripción existente
   */
  updateSubscription(id: number, data: Partial<WebhookSubscription>): WebhookSubscription | null {
    const subscription = this.subscriptions.get(id);

    if (!subscription) {
      return null;
    }

    const updated = { ...subscription, ...data, id };
    this.subscriptions.set(id, updated);

    this.observability.info('Suscripción actualizada', {
      subscriptionId: id,
      changes: Object.keys(data),
    });

    return updated;
  }

  /**
   * Elimina una suscripción
   */
  deleteSubscription(id: number): boolean {
    const deleted = this.subscriptions.delete(id);

    if (deleted) {
      this.observability.info('Suscripción eliminada', { subscriptionId: id });
    }

    return deleted;
  }

  /**
   * Obtiene todas las suscripciones
   */
  getAllSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Obtiene una suscripción por ID
   */
  getSubscription(id: number): WebhookSubscription | null {
    return this.subscriptions.get(id) || null;
  }

  /**
   * Activa o desactiva una suscripción
   */
  toggleSubscription(id: number, active: boolean): WebhookSubscription | null {
    return this.updateSubscription(id, { active });
  }

  // ============================================
  // ESTADÍSTICAS Y MÉTRICAS
  // ============================================

  /**
   * Obtiene estadísticas de entrega (desde Supabase si está disponible)
   */
  async getDeliveryStats(): Promise<DeliveryStats> {
    // Si Supabase está configurado, obtener estadísticas desde DB
    if (this.supabase.isConfigured()) {
      try {
        const globalStats = await this.supabase.getGlobalDeliveryStats();
        
        // Obtener stats por suscripción
        const bySubscription: Record<number, { total: number; successful: number; failed: number }> = {};
        for (const [id] of this.subscriptions) {
          const stats = await this.supabase.getDeliveryStatsBySubscription(id);
          bySubscription[id] = {
            total: stats.totalDeliveries,
            successful: stats.successfulDeliveries,
            failed: stats.failedDeliveries,
          };
        }

        return {
          total: globalStats.totalDeliveries,
          successful: globalStats.successfulDeliveries,
          failed: globalStats.failedDeliveries,
          avgResponseTime: globalStats.avgResponseTime,
          successRate: globalStats.successRate * 100,
          bySubscription,
        };
      } catch (error) {
        this.observability.error('Error al obtener stats desde Supabase, usando memoria', error as Error);
      }
    }

    // Fallback: calcular desde memoria
    const total = this.deliveryRecords.length;
    const successful = this.deliveryRecords.filter((r) => r.success).length;
    const failed = total - successful;

    const avgResponseTime =
      total > 0
        ? this.deliveryRecords.reduce((sum, r) => sum + r.responseTime, 0) / total
        : 0;

    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Estadísticas por suscripción
    const bySubscription: Record<number, { total: number; successful: number; failed: number }> = {};

    for (const record of this.deliveryRecords) {
      if (!bySubscription[record.subscriptionId]) {
        bySubscription[record.subscriptionId] = { total: 0, successful: 0, failed: 0 };
      }

      bySubscription[record.subscriptionId].total++;
      if (record.success) {
        bySubscription[record.subscriptionId].successful++;
      } else {
        bySubscription[record.subscriptionId].failed++;
      }
    }

    return {
      total,
      successful,
      failed,
      avgResponseTime,
      successRate,
      bySubscription,
    };
  }

  /**
   * Obtiene entregas recientes (desde Supabase si está disponible)
   */
  async getRecentDeliveries(limit = 100): Promise<DeliveryRecord[]> {
    // Si Supabase está configurado, consultar desde DB
    if (this.supabase.isConfigured()) {
      try {
        const deliveries = await this.supabase.getRecentDeliveries(limit);
        return deliveries.map(d => ({
          id: d.id.toString(),
          subscriptionId: d.subscription_id,
          eventId: d.event_id,
          eventType: d.event_type,
          success: d.success,
          attempt: d.attempt_number || 1,
          responseTime: d.response_time_ms,
          statusCode: d.http_status,
          error: d.error_message,
          deliveredAt: new Date(d.created_at),
        }));
      } catch (error) {
        this.observability.error('Error al obtener deliveries desde Supabase, usando memoria', error as Error);
      }
    }

    // Fallback a memoria
    return this.deliveryRecords.slice(-limit).reverse();
  }

  /**
   * Obtiene entregas por evento (desde Supabase si está disponible)
   */
  async getDeliveriesByEvent(eventId: string): Promise<DeliveryRecord[]> {
    // Si Supabase está configurado, consultar desde DB
    if (this.supabase.isConfigured()) {
      try {
        const deliveries = await this.supabase.getDeliveriesByEvent(eventId);
        return deliveries.map(d => ({
          id: d.id.toString(),
          subscriptionId: d.subscription_id,
          eventId: d.event_id,
          eventType: d.event_type,
          success: d.success,
          attempt: d.attempt_number || 1,
          responseTime: d.response_time_ms,
          statusCode: d.http_status,
          error: d.error_message,
          deliveredAt: new Date(d.created_at),
        }));
      } catch (error) {
        this.observability.error('Error al obtener deliveries por evento desde Supabase, usando memoria', error as Error);
      }
    }

    // Fallback a memoria
    return this.deliveryRecords.filter((r) => r.eventId === eventId);
  }

  /**
   * Obtiene entregas por suscripción (desde Supabase si está disponible)
   */
  async getDeliveriesBySubscription(subscriptionId: number, limit = 100): Promise<DeliveryRecord[]> {
    // Si Supabase está configurado, consultar desde DB
    if (this.supabase.isConfigured()) {
      try {
        const deliveries = await this.supabase.getDeliveriesBySubscription(subscriptionId, limit);
        return deliveries.map(d => ({
          id: d.id.toString(),
          subscriptionId: d.subscription_id,
          eventId: d.event_id,
          eventType: d.event_type,
          success: d.success,
          attempt: d.attempt_number || 1,
          responseTime: d.response_time_ms,
          statusCode: d.http_status,
          error: d.error_message,
          deliveredAt: new Date(d.created_at),
        }));
      } catch (error) {
        this.observability.error('Error al obtener deliveries por suscripción desde Supabase, usando memoria', error as Error);
      }
    }

    // Fallback a memoria
    return this.deliveryRecords
      .filter((r) => r.subscriptionId === subscriptionId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Obtiene health status del servicio
   */
  async getHealth(): Promise<Record<string, any>> {
    const stats = await this.getDeliveryStats();

    return {
      status: 'ok',
      subscriptions: {
        total: this.subscriptions.size,
        active: Array.from(this.subscriptions.values()).filter((s) => s.active).length,
      },
      deliveries: {
        total: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        successRate: `${stats.successRate.toFixed(2)}%`,
        avgResponseTime: `${stats.avgResponseTime.toFixed(0)}ms`,
      },
      dlq: this.dlq.getStats(),
      supabase: {
        configured: this.supabase.isConfigured(),
      },
    };
  }
}
