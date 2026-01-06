import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Representa un span en una traza distribuida
 */
export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: SpanLog[];
  status: 'success' | 'error';
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Log asociado a un span
 */
export interface SpanLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

/**
 * Contexto de traza para propagación
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

/**
 * Distributed Tracing Service
 * 
 * Implementa trazabilidad distribuida para:
 * - Seguir requests a través de múltiples servicios
 * - Identificar cuellos de botella de rendimiento
 * - Diagnosticar errores en sistemas distribuidos
 * - Visualizar dependencias entre servicios
 * 
 * Compatible con OpenTelemetry y Jaeger
 */
@Injectable()
export class DistributedTracingService {
  private readonly logger = new Logger(DistributedTracingService.name);

  // Storage de spans activos
  private readonly activeSpans = new Map<string, Span>();

  // Storage de spans completados (últimas 1000 trazas)
  private readonly completedSpans: Span[] = [];
  private readonly maxCompletedSpans = 1000;

  // Nombre del servicio actual
  private readonly serviceName = process.env.SERVICE_NAME || 'comparador-service';

  /**
   * Inicia un nuevo span
   */
  startSpan(
    operationName: string,
    parentSpanId?: string,
    traceId?: string,
    tags?: Record<string, any>
  ): Span {
    const span: Span = {
      spanId: uuidv4(),
      traceId: traceId || uuidv4(),
      parentSpanId,
      operationName,
      serviceName: this.serviceName,
      startTime: Date.now(),
      tags: tags || {},
      logs: [],
      status: 'success',
    };

    this.activeSpans.set(span.spanId, span);

    this.logger.debug(
      `📊 Span iniciado: ${operationName} [${span.spanId.substr(0, 8)}] trace: ${span.traceId.substr(0, 8)}`
    );

    return span;
  }

  /**
   * Finaliza un span
   */
  finishSpan(spanId: string, error?: Error): void {
    const span = this.activeSpans.get(spanId);

    if (!span) {
      this.logger.warn(`Span ${spanId} no encontrado`);
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    if (error) {
      span.status = 'error';
      span.error = {
        message: error.message,
        stack: error.stack,
      };
      span.tags['error'] = true;
      span.tags['error.type'] = error.constructor.name;
    }

    // Mover a completados
    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);

    // Limitar tamaño
    if (this.completedSpans.length > this.maxCompletedSpans) {
      this.completedSpans.shift();
    }

    const statusEmoji = span.status === 'success' ? '✅' : '❌';
    this.logger.debug(
      `${statusEmoji} Span finalizado: ${span.operationName} [${span.spanId.substr(0, 8)}] ${span.duration}ms`
    );

    // En producción, enviar a Jaeger/OpenTelemetry
    this.exportSpan(span);
  }

  /**
   * Agrega un log a un span
   */
  logToSpan(
    spanId: string,
    level: SpanLog['level'],
    message: string,
    fields?: Record<string, any>
  ): void {
    const span = this.activeSpans.get(spanId);

    if (!span) {
      return;
    }

    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields,
    });
  }

  /**
   * Agrega tags a un span
   */
  setSpanTags(spanId: string, tags: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);

    if (!span) {
      return;
    }

    Object.assign(span.tags, tags);
  }

  /**
   * Ejecuta una operación con tracing automático
   */
  async traceOperation<T>(
    operationName: string,
    fn: (span: Span) => Promise<T>,
    parentSpanId?: string,
    traceId?: string,
    tags?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(operationName, parentSpanId, traceId, tags);

    try {
      const result = await fn(span);
      this.finishSpan(span.spanId);
      return result;
    } catch (error) {
      this.finishSpan(span.spanId, error as Error);
      throw error;
    }
  }

  /**
   * Extrae contexto de traza de headers HTTP
   */
  extractTraceContext(headers: Record<string, any>): TraceContext | null {
    // Soporta múltiples formatos de headers

    // Formato W3C Trace Context
    const traceparent = headers['traceparent'];
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 4) {
        return {
          traceId: parts[1],
          spanId: parts[2],
          baggage: this.parseBaggage(headers['baggage']),
        };
      }
    }

    // Formato personalizado
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'] || headers['x-parent-span-id'];

    if (traceId) {
      return {
        traceId,
        spanId,
        parentSpanId: headers['x-parent-span-id'],
        baggage: this.parseBaggage(headers['x-baggage']),
      };
    }

    return null;
  }

  /**
   * Inyecta contexto de traza en headers HTTP
   */
  injectTraceContext(span: Span): Record<string, string> {
    // W3C Trace Context format
    const traceparent = `00-${span.traceId}-${span.spanId}-01`;

    return {
      'traceparent': traceparent,
      'x-trace-id': span.traceId,
      'x-span-id': span.spanId,
      ...(span.parentSpanId && { 'x-parent-span-id': span.parentSpanId }),
    };
  }

  /**
   * Obtiene una traza completa por traceId
   */
  getTrace(traceId: string): Span[] {
    return this.completedSpans.filter(span => span.traceId === traceId);
  }

  /**
   * Obtiene trazas con errores
   */
  getFailedTraces(limit: number = 100): Span[] {
    return this.completedSpans
      .filter(span => span.status === 'error')
      .slice(-limit);
  }

  /**
   * Obtiene estadísticas de trazas
   */
  getTraceStats(): {
    totalSpans: number;
    activeSpans: number;
    errorRate: number;
    avgDuration: number;
    slowestOperations: Array<{
      operation: string;
      avgDuration: number;
      count: number;
    }>;
  } {
    const totalSpans = this.completedSpans.length;
    const errorSpans = this.completedSpans.filter(s => s.status === 'error').length;
    const avgDuration = 
      this.completedSpans.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSpans || 0;

    // Agrupar por operación
    const byOperation = new Map<string, { totalDuration: number; count: number }>();
    
    for (const span of this.completedSpans) {
      if (!span.duration) continue;

      const key = span.operationName;
      const existing = byOperation.get(key) || { totalDuration: 0, count: 0 };
      
      byOperation.set(key, {
        totalDuration: existing.totalDuration + span.duration,
        count: existing.count + 1,
      });
    }

    const slowestOperations = Array.from(byOperation.entries())
      .map(([operation, stats]) => ({
        operation,
        avgDuration: stats.totalDuration / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    return {
      totalSpans,
      activeSpans: this.activeSpans.size,
      errorRate: (errorSpans / totalSpans) * 100 || 0,
      avgDuration,
      slowestOperations,
    };
  }

  /**
   * Visualiza una traza en formato árbol
   */
  visualizeTrace(traceId: string): string {
    const spans = this.getTrace(traceId);

    if (spans.length === 0) {
      return `No se encontraron spans para trace ${traceId}`;
    }

    // Construir árbol
    const rootSpans = spans.filter(s => !s.parentSpanId);
    let output = `📊 Traza: ${traceId}\n`;
    output += `Total spans: ${spans.length}\n\n`;

    for (const root of rootSpans) {
      output += this.buildSpanTree(root, spans, 0);
    }

    return output;
  }

  /**
   * Construye árbol de spans recursivamente
   */
  private buildSpanTree(span: Span, allSpans: Span[], level: number): string {
    const indent = '  '.repeat(level);
    const statusEmoji = span.status === 'success' ? '✅' : '❌';
    const duration = span.duration ? `${span.duration}ms` : 'in progress';
    
    let output = `${indent}${statusEmoji} ${span.operationName} (${duration})\n`;

    if (span.error) {
      output += `${indent}  ⚠️ ${span.error.message}\n`;
    }

    // Encontrar hijos
    const children = allSpans.filter(s => s.parentSpanId === span.spanId);
    
    for (const child of children) {
      output += this.buildSpanTree(child, allSpans, level + 1);
    }

    return output;
  }

  /**
   * Exporta span a sistema de tracing
   */
  private exportSpan(span: Span): void {
    // En producción, enviar a:
    // - Jaeger
    // - Zipkin
    // - OpenTelemetry Collector
    // - Datadog APM
    // - AWS X-Ray

    if (process.env.JAEGER_ENDPOINT) {
      // Implementar envío a Jaeger
    }

    // Por ahora, solo log en desarrollo
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`Span exportado: ${JSON.stringify(span, null, 2)}`);
    }
  }

  /**
   * Parse baggage header
   */
  private parseBaggage(baggageHeader?: string): Record<string, string> {
    if (!baggageHeader) return {};

    const baggage: Record<string, string> = {};
    const items = baggageHeader.split(',');

    for (const item of items) {
      const [key, value] = item.trim().split('=');
      if (key && value) {
        baggage[key] = decodeURIComponent(value);
      }
    }

    return baggage;
  }

  /**
   * Limpia spans completados antiguos
   */
  cleanup(): void {
    const cutoffTime = Date.now() - 3600000; // 1 hora

    // Limpiar spans completados antiguos
    const toKeep = this.completedSpans.filter(
      span => (span.endTime || 0) > cutoffTime
    );

    this.completedSpans.length = 0;
    this.completedSpans.push(...toKeep);

    // Limpiar spans activos que nunca finalizaron
    for (const [spanId, span] of this.activeSpans.entries()) {
      if (span.startTime < cutoffTime) {
        this.logger.warn(`Span ${spanId} nunca finalizó, eliminando`);
        this.activeSpans.delete(spanId);
      }
    }

    this.logger.debug(`Cleanup completado: ${this.completedSpans.length} spans restantes`);
  }
}
