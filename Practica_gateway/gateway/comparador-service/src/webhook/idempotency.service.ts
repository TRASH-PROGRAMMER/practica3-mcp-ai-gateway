import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Entidad para almacenar claves de idempotencia
 */
export class IdempotencyKey {
  id: number;
  key: string;
  payload: any;
  response: any;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Servicio de Idempotencia
 * 
 * Previene el procesamiento duplicado de eventos/webhooks usando:
 * - Claves de idempotencia únicas por evento
 * - Almacenamiento de respuestas previas
 * - Expiración automática de claves antiguas
 * - Detección de procesamiento concurrente
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  
  // Cache en memoria para acceso rápido
  private readonly cache = new Map<string, {
    status: string;
    response: any;
    timestamp: number;
  }>();

  // TTL para claves de idempotencia (24 horas)
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    // @InjectRepository(IdempotencyKey)
    // private idempotencyRepo: Repository<IdempotencyKey>,
  ) {
    // Limpiar cache cada hora
    setInterval(() => this.cleanupExpiredKeys(), 60 * 60 * 1000);
  }

  /**
   * Verifica si un evento ya fue procesado
   * 
   * @param idempotencyKey - Clave única del evento (ej: event_id)
   * @returns true si ya fue procesado, false si es nuevo
   */
  async isProcessed(idempotencyKey: string): Promise<boolean> {
    // 1. Verificar cache en memoria
    const cached = this.cache.get(idempotencyKey);
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > this.TTL_MS;
      if (!isExpired) {
        this.logger.debug(`Clave encontrada en cache: ${idempotencyKey}`);
        return cached.status === 'completed';
      }
      // Eliminar si expiró
      this.cache.delete(idempotencyKey);
    }

    // 2. Verificar en base de datos (simulado con Map por ahora)
    // En producción, usar:
    // const record = await this.idempotencyRepo.findOne({ 
    //   where: { key: idempotencyKey } 
    // });
    // return record?.status === 'completed';

    return false;
  }

  /**
   * Obtiene la respuesta de un evento previamente procesado
   * 
   * @param idempotencyKey - Clave del evento
   * @returns Respuesta almacenada o null si no existe
   */
  async getStoredResponse(idempotencyKey: string): Promise<any | null> {
    const cached = this.cache.get(idempotencyKey);
    if (cached && cached.status === 'completed') {
      this.logger.log(`Retornando respuesta cacheada para: ${idempotencyKey}`);
      return cached.response;
    }

    // En producción:
    // const record = await this.idempotencyRepo.findOne({
    //   where: { key: idempotencyKey, status: 'completed' }
    // });
    // return record?.response || null;

    return null;
  }

  /**
   * Marca un evento como en procesamiento
   * Previene procesamiento concurrente
   * 
   * @param idempotencyKey - Clave del evento
   * @param payload - Payload del evento
   * @returns true si se marcó exitosamente, false si ya está en proceso
   */
  async markAsProcessing(
    idempotencyKey: string,
    payload: any
  ): Promise<boolean> {
    // Verificar si ya está siendo procesado
    const existing = this.cache.get(idempotencyKey);
    if (existing && existing.status === 'processing') {
      this.logger.warn(
        `Evento ya en procesamiento (concurrencia detectada): ${idempotencyKey}`
      );
      return false;
    }

    // Marcar como procesando
    this.cache.set(idempotencyKey, {
      status: 'processing',
      response: null,
      timestamp: Date.now(),
    });

    // En producción:
    // try {
    //   await this.idempotencyRepo.save({
    //     key: idempotencyKey,
    //     payload,
    //     status: 'processing',
    //     createdAt: new Date(),
    //     expiresAt: new Date(Date.now() + this.TTL_MS),
    //   });
    //   return true;
    // } catch (error) {
    //   // Posible violación de constraint único (concurrencia)
    //   return false;
    // }

    this.logger.debug(`Evento marcado como procesando: ${idempotencyKey}`);
    return true;
  }

  /**
   * Marca un evento como completado y almacena la respuesta
   * 
   * @param idempotencyKey - Clave del evento
   * @param response - Respuesta a almacenar
   */
  async markAsCompleted(
    idempotencyKey: string,
    response: any
  ): Promise<void> {
    this.cache.set(idempotencyKey, {
      status: 'completed',
      response,
      timestamp: Date.now(),
    });

    // En producción:
    // await this.idempotencyRepo.update(
    //   { key: idempotencyKey },
    //   { status: 'completed', response }
    // );

    this.logger.log(`Evento completado: ${idempotencyKey}`);
  }

  /**
   * Marca un evento como fallido
   * 
   * @param idempotencyKey - Clave del evento
   * @param error - Información del error
   */
  async markAsFailed(
    idempotencyKey: string,
    error: any
  ): Promise<void> {
    this.cache.set(idempotencyKey, {
      status: 'failed',
      response: { error: error.message || error },
      timestamp: Date.now(),
    });

    // En producción:
    // await this.idempotencyRepo.update(
    //   { key: idempotencyKey },
    //   { status: 'failed', response: { error } }
    // );

    this.logger.error(`Evento fallido: ${idempotencyKey}`);
  }

  /**
   * Limpia claves expiradas del cache
   */
  private cleanupExpiredKeys(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL_MS) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Limpiadas ${cleaned} claves expiradas del cache`);
    }
  }

  /**
   * Obtiene estadísticas del cache de idempotencia
   */
  getStats() {
    const stats = {
      totalKeys: this.cache.size,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const value of this.cache.values()) {
      if (value.status === 'processing') stats.processing++;
      else if (value.status === 'completed') stats.completed++;
      else if (value.status === 'failed') stats.failed++;
    }

    return stats;
  }
}
