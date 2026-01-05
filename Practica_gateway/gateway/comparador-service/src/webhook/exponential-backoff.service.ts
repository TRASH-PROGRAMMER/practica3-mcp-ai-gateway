import { Injectable, Logger } from '@nestjs/common';

/**
 * Configuración de Exponential Backoff
 */
export interface BackoffConfig {
  /**
   * Delay base en milisegundos (default: 1000ms = 1s)
   */
  baseDelay: number;

  /**
   * Multiplicador exponencial (default: 2 para duplicar cada vez)
   */
  multiplier: number;

  /**
   * Delay máximo en milisegundos (default: 60000ms = 1min)
   */
  maxDelay: number;

  /**
   * Número máximo de intentos (default: 5)
   */
  maxAttempts: number;

  /**
   * Activar jitter aleatorio para evitar thundering herd (default: true)
   */
  enableJitter: boolean;

  /**
   * Factor de jitter (0-1, default: 0.1 = ±10%)
   */
  jitterFactor: number;
}

/**
 * Resultado de un intento de operación
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  delays: number[];
}

/**
 * Servicio de Exponential Backoff
 * 
 * Implementa estrategia de reintentos con backoff exponencial:
 * 
 * Formula: delay = min(baseDelay * (multiplier ^ attempt), maxDelay)
 * Con jitter: delay = delay * (1 ± jitterFactor * random())
 * 
 * Ejemplos de secuencias:
 * - Base 1s, multiplier 2: 1s, 2s, 4s, 8s, 16s...
 * - Base 500ms, multiplier 3: 0.5s, 1.5s, 4.5s, 13.5s...
 * - Base 2s, multiplier 2, max 30s: 2s, 4s, 8s, 16s, 30s, 30s...
 * 
 * Características:
 * - ✅ Exponential backoff verdadero
 * - ✅ Límite de delay máximo
 * - ✅ Jitter aleatorio para evitar thundering herd
 * - ✅ Configurable y reutilizable
 * - ✅ Type-safe con generics
 * - ✅ Logs estructurados
 */
@Injectable()
export class ExponentialBackoffService {
  private readonly logger = new Logger(ExponentialBackoffService.name);

  private readonly defaultConfig: BackoffConfig = {
    baseDelay: 1000,        // 1 segundo
    multiplier: 2,          // Duplicar cada vez
    maxDelay: 60000,        // 1 minuto máximo
    maxAttempts: 5,         // 5 intentos
    enableJitter: true,     // Activar jitter
    jitterFactor: 0.1,      // ±10%
  };

  /**
   * Ejecuta una operación con reintentos y exponential backoff
   * 
   * @param operation - Función async a ejecutar
   * @param config - Configuración de backoff (opcional)
   * @param context - Contexto para logs (opcional)
   * @returns Resultado de la operación
   * 
   * @example
   * ```typescript
   * const result = await backoff.executeWithRetry(
   *   async () => await httpClient.post(url, data),
   *   { baseDelay: 1000, maxAttempts: 3 },
   *   { operation: 'sendWebhook', url }
   * );
   * ```
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<BackoffConfig>,
    context?: Record<string, any>,
  ): Promise<RetryResult<T>> {
    const fullConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();
    const delays: number[] = [];
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
      try {
        // Log de intento
        if (attempt > 1) {
          this.logger.log(`Intento ${attempt}/${fullConfig.maxAttempts}`, context);
        }

        // Ejecutar operación
        const data = await operation();

        // Éxito
        const totalDuration = Date.now() - startTime;
        this.logger.log(`Operación exitosa en intento ${attempt}`, {
          ...context,
          attempts: attempt,
          totalDuration,
        });

        return {
          success: true,
          data,
          attempts: attempt,
          totalDuration,
          delays,
        };
      } catch (error) {
        lastError = error as Error;

        // Si es el último intento, no esperar
        if (attempt >= fullConfig.maxAttempts) {
          this.logger.error(
            `Operación fallida después de ${attempt} intentos`,
            error as Error,
            context,
          );
          break;
        }

        // Calcular delay con exponential backoff
        const delay = this.calculateDelay(attempt, fullConfig);
        delays.push(delay);

        this.logger.warn(`Intento ${attempt} fallido, reintentando en ${delay}ms`, {
          ...context,
          error: (error as Error).message,
          nextDelay: delay,
        });

        // Esperar antes del siguiente intento
        await this.sleep(delay);
      }
    }

    // Todos los intentos fallaron
    const totalDuration = Date.now() - startTime;
    return {
      success: false,
      error: lastError,
      attempts: fullConfig.maxAttempts,
      totalDuration,
      delays,
    };
  }

  /**
   * Calcula el delay para un intento específico usando exponential backoff
   * 
   * Formula: delay = min(baseDelay * (multiplier ^ (attempt - 1)), maxDelay)
   * Con jitter: delay = delay * (1 + jitterFactor * (random() * 2 - 1))
   * 
   * @param attempt - Número de intento (1-indexed)
   * @param config - Configuración de backoff
   * @returns Delay en milisegundos
   */
  calculateDelay(attempt: number, config: BackoffConfig): number {
    // Calcular delay exponencial
    // attempt 1: baseDelay * multiplier^0 = baseDelay
    // attempt 2: baseDelay * multiplier^1 = baseDelay * multiplier
    // attempt 3: baseDelay * multiplier^2 = baseDelay * multiplier^2
    const exponentialDelay = config.baseDelay * Math.pow(config.multiplier, attempt - 1);

    // Aplicar límite máximo
    let delay = Math.min(exponentialDelay, config.maxDelay);

    // Aplicar jitter si está habilitado
    if (config.enableJitter) {
      // random() * 2 - 1 = valor entre -1 y 1
      // jitterFactor * (random() * 2 - 1) = valor entre -jitterFactor y +jitterFactor
      // Ejemplo: jitterFactor 0.1 → entre -0.1 y 0.1 → entre 90% y 110% del delay
      const jitter = 1 + config.jitterFactor * (Math.random() * 2 - 1);
      delay = Math.floor(delay * jitter);
    }

    return delay;
  }

  /**
   * Calcula todos los delays para una secuencia de reintentos
   * Útil para planificación y visualización
   * 
   * @param config - Configuración de backoff
   * @returns Array de delays en milisegundos
   * 
   * @example
   * ```typescript
   * const delays = backoff.calculateDelaySequence({
   *   baseDelay: 1000,
   *   multiplier: 2,
   *   maxAttempts: 5
   * });
   * // [1000, 2000, 4000, 8000, 16000]
   * ```
   */
  calculateDelaySequence(config: Partial<BackoffConfig>): number[] {
    const fullConfig = { ...this.defaultConfig, ...config };
    const delays: number[] = [];

    for (let attempt = 1; attempt < fullConfig.maxAttempts; attempt++) {
      // Sin jitter para secuencia predecible
      const exponentialDelay = fullConfig.baseDelay * Math.pow(fullConfig.multiplier, attempt - 1);
      const delay = Math.min(exponentialDelay, fullConfig.maxDelay);
      delays.push(delay);
    }

    return delays;
  }

  /**
   * Formatea un delay en formato legible
   * 
   * @param ms - Milisegundos
   * @returns String formateado (e.g., "1s", "2.5s", "1m 30s")
   */
  formatDelay(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
  }

  /**
   * Genera un resumen de la estrategia de backoff
   * Útil para documentación y debugging
   * 
   * @param config - Configuración de backoff
   * @returns Resumen legible
   */
  getBackoffSummary(config: Partial<BackoffConfig>): string {
    const fullConfig = { ...this.defaultConfig, ...config };
    const delays = this.calculateDelaySequence(fullConfig);
    const totalTime = delays.reduce((sum, d) => sum + d, 0);

    return [
      `Estrategia de Exponential Backoff:`,
      `- Base delay: ${this.formatDelay(fullConfig.baseDelay)}`,
      `- Multiplicador: ${fullConfig.multiplier}x`,
      `- Max delay: ${this.formatDelay(fullConfig.maxDelay)}`,
      `- Max intentos: ${fullConfig.maxAttempts}`,
      `- Jitter: ${fullConfig.enableJitter ? `±${fullConfig.jitterFactor * 100}%` : 'desactivado'}`,
      ``,
      `Secuencia de delays:`,
      ...delays.map((d, i) => `  Intento ${i + 2}: ${this.formatDelay(d)}`),
      ``,
      `Tiempo total máximo: ${this.formatDelay(totalTime)}`,
    ].join('\n');
  }

  /**
   * Valida una configuración de backoff
   * 
   * @param config - Configuración a validar
   * @throws Error si la configuración es inválida
   */
  validateConfig(config: Partial<BackoffConfig>): void {
    if (config.baseDelay !== undefined && config.baseDelay <= 0) {
      throw new Error('baseDelay debe ser mayor a 0');
    }

    if (config.multiplier !== undefined && config.multiplier <= 1) {
      throw new Error('multiplier debe ser mayor a 1');
    }

    if (config.maxDelay !== undefined && config.maxDelay <= 0) {
      throw new Error('maxDelay debe ser mayor a 0');
    }

    if (config.maxAttempts !== undefined && config.maxAttempts <= 0) {
      throw new Error('maxAttempts debe ser mayor a 0');
    }

    if (config.jitterFactor !== undefined && (config.jitterFactor < 0 || config.jitterFactor > 1)) {
      throw new Error('jitterFactor debe estar entre 0 y 1');
    }

    if (
      config.baseDelay !== undefined &&
      config.maxDelay !== undefined &&
      config.baseDelay > config.maxDelay
    ) {
      throw new Error('baseDelay no puede ser mayor que maxDelay');
    }
  }

  /**
   * Helper: Sleep async
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtiene estadísticas de una ejecución de retry
   * 
   * @param result - Resultado de executeWithRetry
   * @returns Estadísticas formateadas
   */
  getRetryStats(result: RetryResult<any>): Record<string, any> {
    return {
      success: result.success,
      attempts: result.attempts,
      totalDuration: this.formatDelay(result.totalDuration),
      delays: result.delays.map(d => this.formatDelay(d)),
      avgDelay: result.delays.length > 0
        ? this.formatDelay(result.delays.reduce((sum, d) => sum + d, 0) / result.delays.length)
        : '0ms',
    };
  }
}
