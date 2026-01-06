import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Mensaje fallido en la Dead Letter Queue
 */
interface DeadLetterMessage {
  id: string;
  eventId: string;
  eventType: string;
  payload: any;
  error: string;
  attempts: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  nextRetryAt?: Date;
  status: 'pending' | 'retrying' | 'exhausted' | 'recovered';
}

/**
 * Configuración de reintentos
 */
interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

/**
 * Dead Letter Queue Service
 * 
 * Gestiona webhooks/eventos que fallaron en su procesamiento:
 * - Almacena mensajes fallidos para análisis
 * - Implementa reintentos con backoff exponencial
 * - Permite recuperación manual de mensajes
 * - Genera alertas para fallos críticos
 * - Mantiene histórico de fallos
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  // Storage en memoria (en producción usar DB o Redis)
  private readonly dlq = new Map<string, DeadLetterMessage>();

  // Configuración por defecto
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 5,
    backoffMultiplier: 2,
    initialDelayMs: 5000,      // 5s
    maxDelayMs: 3600000,       // 1 hora
  };

  /**
   * Agrega un mensaje fallido a la DLQ
   * 
   * @param eventId - ID único del evento
   * @param eventType - Tipo de evento
   * @param payload - Payload original
   * @param error - Error que causó el fallo
   */
  async addToQueue(
    eventId: string,
    eventType: string,
    payload: any,
    error: Error | string
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;

    // Verificar si ya existe en la DLQ
    const existing = this.dlq.get(eventId);

    if (existing) {
      // Incrementar intentos
      existing.attempts++;
      existing.lastFailedAt = new Date();
      existing.error = errorMessage;
      existing.nextRetryAt = this.calculateNextRetry(existing.attempts);

      this.logger.warn(
        `⚠️  Evento ${eventId} falló nuevamente. ` +
        `Intentos: ${existing.attempts}/${this.defaultRetryConfig.maxAttempts}`
      );

      // Verificar si se agotaron los reintentos
      if (existing.attempts >= this.defaultRetryConfig.maxAttempts) {
        existing.status = 'exhausted';
        existing.nextRetryAt = undefined;

        this.logger.error(
          `❌ Evento ${eventId} AGOTADO después de ${existing.attempts} intentos. ` +
          `Requiere intervención manual.`
        );

        // Aquí enviar alerta (email, Slack, PagerDuty, etc.)
        await this.sendAlert(existing);
      }
    } else {
      // Nuevo mensaje en DLQ
      const message: DeadLetterMessage = {
        id: this.generateId(),
        eventId,
        eventType,
        payload,
        error: errorMessage,
        attempts: 1,
        firstFailedAt: new Date(),
        lastFailedAt: new Date(),
        nextRetryAt: this.calculateNextRetry(1),
        status: 'pending',
      };

      this.dlq.set(eventId, message);

      this.logger.warn(
        `📥 Nuevo mensaje en DLQ: ${eventId} (${eventType}). ` +
        `Próximo reintento: ${message.nextRetryAt?.toISOString()}`
      );
    }
  }

  /**
   * Calcula el tiempo del próximo reintento usando backoff exponencial
   */
  private calculateNextRetry(attempt: number): Date {
    const config = this.defaultRetryConfig;
    
    // Backoff exponencial: delay = initial * (multiplier ^ (attempt - 1))
    let delayMs = config.initialDelayMs * Math.pow(
      config.backoffMultiplier,
      attempt - 1
    );

    // Limitar al delay máximo
    delayMs = Math.min(delayMs, config.maxDelayMs);

    // Agregar jitter aleatorio (±20%) para evitar thundering herd
    const jitter = delayMs * 0.2 * (Math.random() * 2 - 1);
    delayMs += jitter;

    return new Date(Date.now() + delayMs);
  }

  /**
   * Procesa reintentos programados (ejecutado por cron)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processRetries(): Promise<void> {
    const now = new Date();
    const toRetry: DeadLetterMessage[] = [];

    // Buscar mensajes listos para reintentar
    for (const message of this.dlq.values()) {
      if (
        message.status === 'pending' &&
        message.nextRetryAt &&
        message.nextRetryAt <= now
      ) {
        toRetry.push(message);
      }
    }

    if (toRetry.length === 0) {
      return;
    }

    this.logger.log(`🔄 Procesando ${toRetry.length} reintento(s) de DLQ`);

    // Procesar cada reintento
    for (const message of toRetry) {
      await this.retryMessage(message);
    }
  }

  /**
   * Reintenta procesar un mensaje
   */
  private async retryMessage(message: DeadLetterMessage): Promise<void> {
    message.status = 'retrying';

    try {
      this.logger.log(
        `♻️  Reintentando evento ${message.eventId} ` +
        `(intento ${message.attempts + 1}/${this.defaultRetryConfig.maxAttempts})`
      );

      // Aquí llamar al procesador original del webhook
      // Por ejemplo: await this.webhookProcessor.process(message.payload);

      // Si llega aquí, fue exitoso
      message.status = 'recovered';
      this.dlq.delete(message.eventId);

      this.logger.log(
        `✅ Evento ${message.eventId} recuperado exitosamente después de ${message.attempts} intento(s)`
      );

    } catch (error) {
      // Falló de nuevo, volver a agregar a DLQ
      await this.addToQueue(
        message.eventId,
        message.eventType,
        message.payload,
        error
      );
    }
  }

  /**
   * Recupera manualmente un mensaje específico
   * Útil para intervención manual después de corregir el problema
   */
  async manualRetry(eventId: string): Promise<boolean> {
    const message = this.dlq.get(eventId);

    if (!message) {
      this.logger.warn(`Mensaje ${eventId} no encontrado en DLQ`);
      return false;
    }

    this.logger.log(`🔧 Reintento manual de evento ${eventId}`);

    await this.retryMessage(message);
    return true;
  }

  /**
   * Descarta permanentemente un mensaje
   * Útil cuando el mensaje es inválido y nunca se procesará correctamente
   */
  async discardMessage(eventId: string, reason: string): Promise<boolean> {
    const message = this.dlq.get(eventId);

    if (!message) {
      return false;
    }

    this.logger.warn(
      `🗑️  Descartando mensaje ${eventId}. Razón: ${reason}`
    );

    this.dlq.delete(eventId);
    
    // En producción, mover a tabla de archivo/histórico
    // await this.archiveMessage(message, reason);

    return true;
  }

  /**
   * Obtiene todos los mensajes en la DLQ
   */
  getAll(): DeadLetterMessage[] {
    return Array.from(this.dlq.values());
  }

  /**
   * Obtiene mensajes por estado
   */
  getByStatus(status: DeadLetterMessage['status']): DeadLetterMessage[] {
    return Array.from(this.dlq.values()).filter(m => m.status === status);
  }

  /**
   * Obtiene un mensaje específico
   */
  getMessage(eventId: string): DeadLetterMessage | undefined {
    return this.dlq.get(eventId);
  }

  /**
   * Obtiene estadísticas de la DLQ
   */
  getStats() {
    const messages = Array.from(this.dlq.values());

    return {
      total: messages.length,
      pending: messages.filter(m => m.status === 'pending').length,
      retrying: messages.filter(m => m.status === 'retrying').length,
      exhausted: messages.filter(m => m.status === 'exhausted').length,
      recovered: messages.filter(m => m.status === 'recovered').length,
      oldestMessage: messages.length > 0
        ? new Date(Math.min(...messages.map(m => m.firstFailedAt.getTime())))
        : null,
    };
  }

  /**
   * Limpia mensajes antiguos recuperados (ejecutado diariamente)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupRecovered(): Promise<void> {
    const recovered = this.getByStatus('recovered');
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 días

    let cleaned = 0;
    for (const message of recovered) {
      if (message.lastFailedAt < cutoff) {
        this.dlq.delete(message.eventId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`🧹 Limpiados ${cleaned} mensaje(s) recuperados antiguos`);
    }
  }

  /**
   * Envía alerta para mensajes agotados
   */
  private async sendAlert(message: DeadLetterMessage): Promise<void> {
    // Aquí implementar integración con sistema de alertas
    // Por ejemplo: Slack, email, PagerDuty, etc.

    this.logger.error(
      `🚨 ALERTA: Mensaje agotado requiere atención\n` +
      `Event ID: ${message.eventId}\n` +
      `Event Type: ${message.eventType}\n` +
      `Intentos: ${message.attempts}\n` +
      `Primer fallo: ${message.firstFailedAt.toISOString()}\n` +
      `Último error: ${message.error}`
    );

    // Ejemplo con webhook de Slack:
    // await fetch(process.env.SLACK_WEBHOOK_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     text: `🚨 DLQ Alert: Message exhausted`,
    //     attachments: [{
    //       color: 'danger',
    //       fields: [
    //         { title: 'Event ID', value: message.eventId, short: true },
    //         { title: 'Type', value: message.eventType, short: true },
    //         { title: 'Attempts', value: message.attempts, short: true },
    //         { title: 'Error', value: message.error, short: false },
    //       ]
    //     }]
    //   })
    // });
  }

  /**
   * Genera un ID único
   */
  private generateId(): string {
    return `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
