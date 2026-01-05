import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Configuración de idempotencia
 */
export interface IdempotencyConfig {
  ttlDays: number; // TTL en días (default: 7)
  keyPrefix: string; // Prefijo para claves (default: 'idempotency')
}

/**
 * Clave de idempotencia generada
 */
export interface IdempotencyKey {
  key: string;
  hash: string;
  components: {
    eventType: string;
    entityId: string;
    action: string;
  };
  expiresAt: Date;
}

/**
 * Resultado de verificación de idempotencia
 */
export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingKey?: {
    key: string;
    processedAt: Date;
    result?: any;
    expiresAt: Date;
  };
  message: string;
}

/**
 * Idempotency Service
 * 
 * Implementa patrón Idempotent Consumer para garantizar procesamiento
 * exactly-once de mensajes RabbitMQ (que tiene at-least-once delivery).
 * 
 * Estrategia:
 * - Genera claves únicas basadas en event_type + entity_id + action
 * - Almacena claves procesadas en PostgreSQL/Supabase
 * - Verifica duplicados antes de procesar
 * - TTL de 7 días para limpieza automática
 * 
 * Uso:
 * ```typescript
 * const key = await idempotency.generateKey('producto.creado', '123', 'create');
 * const check = await idempotency.checkAndMark(key);
 * if (check.isDuplicate) {
 *   logger.warn('Mensaje duplicado, omitiendo');
 *   return check.existingKey.result;
 * }
 * // Procesar mensaje...
 * await idempotency.markProcessed(key, result);
 * ```
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  
  // Store in-memory para pruebas (en producción usar PostgreSQL)
  private readonly processedKeys = new Map<string, {
    processedAt: Date;
    result?: any;
    expiresAt: Date;
  }>();

  private readonly config: IdempotencyConfig = {
    ttlDays: 7,
    keyPrefix: 'idempotency',
  };

  constructor() {
    // Iniciar limpieza periódica cada 1 hora
    setInterval(() => this.cleanupExpiredKeys(), 60 * 60 * 1000);
  }

  /**
   * Genera clave de idempotencia
   * 
   * @param eventType - Tipo de evento (producto.creado, prescripcion.registrada, etc.)
   * @param entityId - ID de la entidad afectada (producto_id, prescripcion_id, etc.)
   * @param action - Acción realizada (create, update, delete, process, etc.)
   * @param additionalContext - Contexto adicional opcional para mayor unicidad
   * @returns Clave de idempotencia con hash
   */
  async generateKey(
    eventType: string,
    entityId: string | number,
    action: string,
    additionalContext?: Record<string, any>,
  ): Promise<IdempotencyKey> {
    const components = {
      eventType,
      entityId: String(entityId),
      action,
    };

    // Construir clave base
    let keyString = `${this.config.keyPrefix}:${eventType}:${entityId}:${action}`;

    // Agregar contexto adicional si existe
    if (additionalContext) {
      const contextHash = createHash('sha256')
        .update(JSON.stringify(additionalContext))
        .digest('hex')
        .substring(0, 8);
      keyString += `:${contextHash}`;
    }

    // Generar hash SHA-256 para almacenamiento compacto
    const hash = createHash('sha256')
      .update(keyString)
      .digest('hex');

    // Calcular fecha de expiración
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.ttlDays);

    return {
      key: keyString,
      hash,
      components,
      expiresAt,
    };
  }

  /**
   * Verifica si una clave ya fue procesada
   * 
   * @param key - Clave de idempotencia
   * @returns Resultado de verificación
   */
  async isDuplicate(key: IdempotencyKey): Promise<IdempotencyCheckResult> {
    // Verificar en store in-memory
    const existing = this.processedKeys.get(key.hash);

    if (existing) {
      // Verificar si expiró
      if (existing.expiresAt < new Date()) {
        // Clave expirada, eliminar y permitir reproceso
        this.processedKeys.delete(key.hash);
        
        this.logger.debug('Clave expirada eliminada', {
          key: key.key,
          hash: key.hash,
          expiredAt: existing.expiresAt,
        });

        return {
          isDuplicate: false,
          message: 'Clave expirada, permitiendo reproceso',
        };
      }

      // Duplicado detectado
      this.logger.warn('Mensaje duplicado detectado', {
        key: key.key,
        hash: key.hash,
        originalProcessedAt: existing.processedAt,
        timeSinceProcessing: Date.now() - existing.processedAt.getTime(),
      });

      return {
        isDuplicate: true,
        existingKey: {
          key: key.key,
          processedAt: existing.processedAt,
          result: existing.result,
          expiresAt: existing.expiresAt,
        },
        message: 'Mensaje ya procesado previamente',
      };
    }

    // No es duplicado
    return {
      isDuplicate: false,
      message: 'Mensaje no procesado, proceder',
    };
  }

  /**
   * Marca una clave como procesada
   * 
   * @param key - Clave de idempotencia
   * @param result - Resultado del procesamiento (opcional)
   */
  async markProcessed(
    key: IdempotencyKey,
    result?: any,
  ): Promise<void> {
    this.processedKeys.set(key.hash, {
      processedAt: new Date(),
      result,
      expiresAt: key.expiresAt,
    });

    this.logger.debug('Clave marcada como procesada', {
      key: key.key,
      hash: key.hash,
      expiresAt: key.expiresAt,
      hasResult: !!result,
    });
  }

  /**
   * Verifica y marca en una sola operación (atomicidad simulada)
   * 
   * @param key - Clave de idempotencia
   * @returns Resultado de verificación
   */
  async checkAndMark(key: IdempotencyKey): Promise<IdempotencyCheckResult> {
    const check = await this.isDuplicate(key);
    
    if (!check.isDuplicate) {
      // Marcar como procesando (sin resultado aún)
      await this.markProcessed(key);
    }

    return check;
  }

  /**
   * Obtiene información de una clave procesada
   * 
   * @param key - Clave de idempotencia
   * @returns Información de la clave o null si no existe
   */
  async getProcessedKey(key: IdempotencyKey): Promise<{
    processedAt: Date;
    result?: any;
    expiresAt: Date;
  } | null> {
    return this.processedKeys.get(key.hash) || null;
  }

  /**
   * Elimina claves expiradas (limpieza automática)
   * 
   * @returns Número de claves eliminadas
   */
  async cleanupExpiredKeys(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;

    for (const [hash, data] of this.processedKeys.entries()) {
      if (data.expiresAt < now) {
        this.processedKeys.delete(hash);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.log('Limpieza de claves expiradas completada', {
        deletedCount,
        remainingKeys: this.processedKeys.size,
      });
    }

    return deletedCount;
  }

  /**
   * Obtiene estadísticas del servicio
   * 
   * @returns Estadísticas de uso
   */
  getStats(): {
    totalKeys: number;
    expiredKeys: number;
    activeKeys: number;
    oldestKey: Date | null;
    newestKey: Date | null;
  } {
    const now = new Date();
    let expiredCount = 0;
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;

    for (const data of this.processedKeys.values()) {
      if (data.expiresAt < now) {
        expiredCount++;
      }

      if (!oldestDate || data.processedAt < oldestDate) {
        oldestDate = data.processedAt;
      }

      if (!newestDate || data.processedAt > newestDate) {
        newestDate = data.processedAt;
      }
    }

    return {
      totalKeys: this.processedKeys.size,
      expiredKeys: expiredCount,
      activeKeys: this.processedKeys.size - expiredCount,
      oldestKey: oldestDate,
      newestKey: newestDate,
    };
  }

  /**
   * Elimina una clave específica (para testing/debug)
   * 
   * @param key - Clave de idempotencia
   * @returns true si se eliminó, false si no existía
   */
  async deleteKey(key: IdempotencyKey): Promise<boolean> {
    return this.processedKeys.delete(key.hash);
  }

  /**
   * Elimina todas las claves (para testing)
   */
  async reset(): Promise<void> {
    this.processedKeys.clear();
    this.logger.warn('Store de idempotencia reseteado');
  }
}
