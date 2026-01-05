import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Contexto de correlación para trazabilidad
 */
export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  sessionId?: string;
  parentSpanId?: string;
  traceId?: string;
}

/**
 * Log estructurado
 */
export interface StructuredLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  correlationId: string;
  requestId: string;
  context?: string;
  metadata?: Record<string, any>;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Métrica de rendimiento
 */
interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  correlationId: string;
  metadata?: Record<string, any>;
}

/**
 * Observability Service
 * 
 * Proporciona sistema completo de observabilidad:
 * - Correlation IDs para trazabilidad distribuida
 * - Logs estructurados en formato JSON
 * - Métricas de rendimiento
 * - Trazas de operaciones
 * - Context propagation entre servicios
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  // Storage local de contextos (AsyncLocalStorage en producción)
  private readonly contexts = new Map<string, CorrelationContext>();

  // Métricas en memoria
  private readonly metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 10000;

  /**
   * Crea un nuevo contexto de correlación
   */
  createContext(
    req?: Request,
    parentContext?: Partial<CorrelationContext>
  ): CorrelationContext {
    const correlationId = 
      req?.headers['x-correlation-id'] as string ||
      parentContext?.correlationId ||
      uuidv4();

    const requestId = 
      req?.headers['x-request-id'] as string ||
      uuidv4();

    const context: CorrelationContext = {
      correlationId,
      requestId,
      userId: req?.headers['x-user-id'] as string || parentContext?.userId,
      sessionId: req?.headers['x-session-id'] as string || parentContext?.sessionId,
      traceId: req?.headers['x-trace-id'] as string || parentContext?.traceId || correlationId,
      parentSpanId: parentContext?.requestId,
    };

    this.contexts.set(correlationId, context);
    
    return context;
  }

  /**
   * Obtiene el contexto actual
   */
  getCurrentContext(): CorrelationContext | null {
    // En producción, usar AsyncLocalStorage para obtener contexto del scope actual
    // Por ahora, retornar el último creado (simplificado)
    const contexts = Array.from(this.contexts.values());
    return contexts[contexts.length - 1] || null;
  }

  /**
   * Log estructurado con contexto
   */
  log(
    level: StructuredLog['level'],
    message: string,
    metadata?: Record<string, any>,
    context?: CorrelationContext
  ): void {
    const ctx = context || this.getCurrentContext();

    const structuredLog: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: ctx?.correlationId || 'no-correlation-id',
      requestId: ctx?.requestId || 'no-request-id',
      metadata,
    };

    // En producción, enviar a sistema de logs centralizado
    // (ELK, Datadog, CloudWatch, etc.)
    this.outputStructuredLog(structuredLog);
  }

  /**
   * Log de debug
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log de info
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log de warning
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log de error
   */
  error(
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ): void {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    const ctx = this.getCurrentContext();

    const structuredLog: StructuredLog = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      correlationId: ctx?.correlationId || 'no-correlation-id',
      requestId: ctx?.requestId || 'no-request-id',
      metadata,
      error: errorData,
    };

    this.outputStructuredLog(structuredLog);
  }

  /**
   * Mide el tiempo de una operación
   */
  async measureOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const ctx = this.getCurrentContext();
    const startTime = Date.now();

    this.info(`Iniciando operación: ${operationName}`, {
      operation: operationName,
      ...metadata,
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      // Registrar métrica
      this.recordMetric({
        operation: operationName,
        duration,
        success: true,
        timestamp: new Date(),
        correlationId: ctx?.correlationId || 'no-correlation-id',
        metadata,
      });

      this.info(`Operación completada: ${operationName}`, {
        operation: operationName,
        duration,
        success: true,
        ...metadata,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Registrar métrica de fallo
      this.recordMetric({
        operation: operationName,
        duration,
        success: false,
        timestamp: new Date(),
        correlationId: ctx?.correlationId || 'no-correlation-id',
        metadata: {
          ...metadata,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      this.error(`Operación fallida: ${operationName}`, error as Error, {
        operation: operationName,
        duration,
        ...metadata,
      });

      throw error;
    }
  }

  /**
   * Registra una métrica
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Limitar tamaño del array
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // En producción, enviar a sistema de métricas
    // (Prometheus, Datadog, CloudWatch, etc.)
  }

  /**
   * Obtiene métricas agregadas
   */
  getMetrics(operationName?: string): {
    operation: string;
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  }[] {
    const grouped = new Map<string, PerformanceMetric[]>();

    // Agrupar por operación
    for (const metric of this.metrics) {
      if (operationName && metric.operation !== operationName) {
        continue;
      }

      if (!grouped.has(metric.operation)) {
        grouped.set(metric.operation, []);
      }
      grouped.get(metric.operation)!.push(metric);
    }

    // Calcular estadísticas
    const results: Array<{
      operation: string;
      totalCalls: number;
      successRate: number;
      avgDuration: number;
      p50Duration: number;
      p95Duration: number;
      p99Duration: number;
    }> = [];
    for (const [operation, metrics] of grouped.entries()) {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const successCount = metrics.filter(m => m.success).length;

      results.push({
        operation,
        totalCalls: metrics.length,
        successRate: (successCount / metrics.length) * 100,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50Duration: durations[Math.floor(durations.length * 0.5)],
        p95Duration: durations[Math.floor(durations.length * 0.95)],
        p99Duration: durations[Math.floor(durations.length * 0.99)],
      });
    }

    return results;
  }

  /**
   * Genera headers de propagación para llamadas downstream
   */
  getPropagatetionHeaders(context?: CorrelationContext): Record<string, string> {
    const ctx = context || this.getCurrentContext();

    if (!ctx) {
      return {};
    }

    return {
      'X-Correlation-ID': ctx.correlationId,
      'X-Request-ID': uuidv4(), // Nuevo request ID para la llamada downstream
      'X-Trace-ID': ctx.traceId || ctx.correlationId,
      'X-Parent-Span-ID': ctx.requestId,
      ...(ctx.userId && { 'X-User-ID': ctx.userId }),
      ...(ctx.sessionId && { 'X-Session-ID': ctx.sessionId }),
    };
  }

  /**
   * Output del log estructurado
   */
  private outputStructuredLog(log: StructuredLog): void {
    // En desarrollo: output legible
    if (process.env.NODE_ENV === 'development') {
      const emoji = {
        debug: '🔍',
        info: 'ℹ️ ',
        warn: '⚠️ ',
        error: '❌',
      }[log.level];

      const correlationIdShort = log.correlationId ? log.correlationId.substr(0, 8) : 'unknown';
      
      // Usar el método correcto del logger según el nivel
      switch (log.level) {
        case 'debug':
          this.logger.debug(`${emoji} [${correlationIdShort}] ${log.message}`, log.metadata);
          break;
        case 'info':
          this.logger.log(`${emoji} [${correlationIdShort}] ${log.message}`, log.metadata);
          break;
        case 'warn':
          this.logger.warn(`${emoji} [${correlationIdShort}] ${log.message}`, log.metadata);
          break;
        case 'error':
          this.logger.error(`${emoji} [${correlationIdShort}] ${log.message}`, log.metadata);
          break;
        default:
          this.logger.log(`${emoji} [${correlationIdShort}] ${log.message}`, log.metadata);
      }
    } else {
      // En producción: JSON estructurado
      console.log(JSON.stringify(log));
    }
  }

  /**
   * Limpia contextos antiguos
   */
  cleanup(): void {
    const cutoff = Date.now() - 3600000; // 1 hora
    
    for (const [id, ctx] of this.contexts.entries()) {
      // Si el contexto tiene más de 1 hora, eliminarlo
      // (necesitaría timestamp en el contexto para implementar correctamente)
      if (this.contexts.size > 1000) {
        this.contexts.delete(id);
      }
    }
  }
}

/**
 * Middleware para inyectar correlation IDs
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly observability: ObservabilityService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Crear contexto de correlación
    const context = this.observability.createContext(req);

    // Agregar headers de correlación a la respuesta
    res.setHeader('X-Correlation-ID', context.correlationId);
    res.setHeader('X-Request-ID', context.requestId);

    // Guardar contexto en request para uso posterior
    (req as any).correlationContext = context;

    // Log de inicio de request
    this.observability.info('HTTP Request recibido', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });

    // Medir tiempo de respuesta
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      this.observability.info('HTTP Request completado', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
      });
    });

    next();
  }
}
