import { Injectable, Logger } from '@nestjs/common';
import { DistributedTracingService } from './distributed-tracing.service';
import { ObservabilityService } from './observability.service';

/**
 * Información de diagnóstico de un fallo
 */
export interface FailureDiagnosis {
  failureId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'service' | 'data' | 'timeout' | 'unknown';
  
  summary: string;
  rootCause?: string;
  affectedServices: string[];
  errorChain: ErrorDetail[];
  
  recommendations: string[];
  relatedTraces: string[];
  metrics: {
    errorCount: number;
    affectedRequests: number;
    timeframe: string;
  };
}

/**
 * Detalle de un error en la cadena
 */
export interface ErrorDetail {
  service: string;
  operation: string;
  error: string;
  stack?: string;
  timestamp: Date;
  duration?: number;
}

/**
 * Patrón de error detectado
 */
export interface ErrorPattern {
  pattern: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedOperations: string[];
  examples: string[];
}

/**
 * Failure Diagnosis Service
 * 
 * Diagnostica y analiza fallos en sistemas distribuidos:
 * - Identifica root cause de errores
 * - Detecta patrones de fallos recurrentes
 * - Analiza cadenas de errores distribuidos
 * - Proporciona recomendaciones de solución
 * - Correlaciona errores relacionados
 */
@Injectable()
export class FailureDiagnosisService {
  private readonly logger = new Logger(FailureDiagnosisService.name);

  // Caché de diagnósticos recientes
  private readonly recentDiagnoses: FailureDiagnosis[] = [];
  private readonly maxDiagnoses = 500;

  // Patrones de error conocidos
  private readonly errorPatterns = new Map<string, ErrorPattern>();

  constructor(
    private readonly tracing: DistributedTracingService,
    private readonly observability: ObservabilityService,
  ) {
    // Inicializar patrones conocidos
    this.initializeKnownPatterns();
  }

  /**
   * Diagnostica un fallo específico por traceId
   */
  async diagnoseFailure(traceId: string): Promise<FailureDiagnosis> {
    const spans = this.tracing.getTrace(traceId);

    if (spans.length === 0) {
      throw new Error(`No se encontró traza para ${traceId}`);
    }

    const failedSpans = spans.filter(s => s.status === 'error');

    if (failedSpans.length === 0) {
      throw new Error(`La traza ${traceId} no contiene errores`);
    }

    // Construir cadena de errores
    const errorChain: ErrorDetail[] = failedSpans.map(span => ({
      service: span.serviceName,
      operation: span.operationName,
      error: span.error?.message || 'Unknown error',
      stack: span.error?.stack,
      timestamp: new Date(span.startTime),
      duration: span.duration,
    }));

    // Identificar root cause (primer error en la cadena)
    const rootError = this.findRootCause(errorChain, spans);

    // Categorizar el error
    const category = this.categorizeError(rootError);

    // Determinar severidad
    const severity = this.determineSeverity(failedSpans, spans);

    // Obtener servicios afectados
    const affectedServices = [...new Set(failedSpans.map(s => s.serviceName))];

    // Buscar trazas relacionadas
    const relatedTraces = this.findRelatedFailures(rootError.error);

    // Generar recomendaciones
    const recommendations = this.generateRecommendations(
      category,
      rootError,
      errorChain
    );

    // Detectar patrón
    this.detectErrorPattern(rootError.error, rootError.operation);

    const diagnosis: FailureDiagnosis = {
      failureId: `diag-${Date.now()}`,
      timestamp: new Date(),
      severity,
      category,
      summary: this.generateSummary(rootError, errorChain, affectedServices),
      rootCause: rootError.error,
      affectedServices,
      errorChain,
      recommendations,
      relatedTraces,
      metrics: {
        errorCount: failedSpans.length,
        affectedRequests: spans.length,
        timeframe: this.calculateTimeframe(spans),
      },
    };

    // Guardar diagnóstico
    this.recentDiagnoses.push(diagnosis);
    if (this.recentDiagnoses.length > this.maxDiagnoses) {
      this.recentDiagnoses.shift();
    }

    this.logger.warn(
      `🔍 Diagnóstico completado: ${diagnosis.summary}`
    );

    return diagnosis;
  }

  /**
   * Analiza múltiples fallos para encontrar patrones
   */
  analyzeFailurePatterns(limit: number = 100): {
    patterns: ErrorPattern[];
    insights: string[];
  } {
    const failedSpans = this.tracing.getFailedTraces(limit);

    // Actualizar patrones
    for (const span of failedSpans) {
      const error = span.error?.message || 'Unknown';
      this.detectErrorPattern(error, span.operationName);
    }

    // Obtener patrones más frecuentes
    const patterns = Array.from(this.errorPatterns.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    // Generar insights
    const insights = this.generateInsights(patterns, failedSpans);

    return { patterns, insights };
  }

  /**
   * Obtiene todos los diagnósticos recientes
   */
  getRecentDiagnoses(limit: number = 50): FailureDiagnosis[] {
    return this.recentDiagnoses.slice(-limit);
  }

  /**
   * Obtiene diagnósticos por severidad
   */
  getDiagnosesBySeverity(severity: FailureDiagnosis['severity']): FailureDiagnosis[] {
    return this.recentDiagnoses.filter(d => d.severity === severity);
  }

  /**
   * Obtiene estadísticas de diagnósticos
   */
  getDiagnosisStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    topErrors: Array<{ error: string; count: number }>;
  } {
    const bySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byCategory = {
      network: 0,
      service: 0,
      data: 0,
      timeout: 0,
      unknown: 0,
    };

    const errorCounts = new Map<string, number>();

    for (const diagnosis of this.recentDiagnoses) {
      bySeverity[diagnosis.severity]++;
      byCategory[diagnosis.category]++;

      if (diagnosis.rootCause) {
        const count = errorCounts.get(diagnosis.rootCause) || 0;
        errorCounts.set(diagnosis.rootCause, count + 1);
      }
    }

    const topErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: this.recentDiagnoses.length,
      bySeverity,
      byCategory,
      topErrors,
    };
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  /**
   * Encuentra el root cause en la cadena de errores
   */
  private findRootCause(errorChain: ErrorDetail[], allSpans: any[]): ErrorDetail {
    // El root cause es típicamente el primer error (sin parent fallido)
    const sortedErrors = errorChain.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Buscar el error más temprano sin dependencia fallida
    for (const error of sortedErrors) {
      const span = allSpans.find(
        s => s.operationName === error.operation && s.error?.message === error.error
      );

      if (span && !span.parentSpanId) {
        return error;
      }
    }

    // Si no se encuentra, retornar el primer error
    return sortedErrors[0];
  }

  /**
   * Categoriza un error según su tipo
   */
  private categorizeError(error: ErrorDetail): FailureDiagnosis['category'] {
    const errorMsg = error.error.toLowerCase();

    if (
      errorMsg.includes('timeout') ||
      errorMsg.includes('timed out') ||
      errorMsg.includes('deadline exceeded')
    ) {
      return 'timeout';
    }

    if (
      errorMsg.includes('connection') ||
      errorMsg.includes('econnrefused') ||
      errorMsg.includes('network') ||
      errorMsg.includes('socket')
    ) {
      return 'network';
    }

    if (
      errorMsg.includes('validation') ||
      errorMsg.includes('invalid') ||
      errorMsg.includes('parse') ||
      errorMsg.includes('format')
    ) {
      return 'data';
    }

    if (
      errorMsg.includes('unavailable') ||
      errorMsg.includes('circuit breaker') ||
      errorMsg.includes('service')
    ) {
      return 'service';
    }

    return 'unknown';
  }

  /**
   * Determina la severidad del fallo
   */
  private determineSeverity(
    failedSpans: any[],
    allSpans: any[]
  ): FailureDiagnosis['severity'] {
    const errorRate = (failedSpans.length / allSpans.length) * 100;

    if (errorRate === 100) return 'critical'; // Toda la traza falló
    if (errorRate >= 50) return 'high';
    if (errorRate >= 20) return 'medium';
    return 'low';
  }

  /**
   * Busca trazas relacionadas con el mismo error
   */
  private findRelatedFailures(error: string): string[] {
    const failedSpans = this.tracing.getFailedTraces(100);
    const related = failedSpans
      .filter(span => span.error?.message === error)
      .map(span => span.traceId);

    return [...new Set(related)].slice(0, 10);
  }

  /**
   * Genera recomendaciones basadas en el diagnóstico
   */
  private generateRecommendations(
    category: FailureDiagnosis['category'],
    rootError: ErrorDetail,
    errorChain: ErrorDetail[]
  ): string[] {
    const recommendations: string[] = [];

    switch (category) {
      case 'timeout':
        recommendations.push(
          'Aumentar el timeout configurado para la operación',
          'Revisar la carga del servicio downstream',
          'Considerar implementar caching para reducir latencia',
          'Verificar conexiones de red y ancho de banda'
        );
        break;

      case 'network':
        recommendations.push(
          'Verificar conectividad de red entre servicios',
          'Revisar configuración de DNS y service discovery',
          'Implementar reintentos con backoff exponencial',
          'Verificar firewalls y reglas de seguridad'
        );
        break;

      case 'data':
        recommendations.push(
          'Validar el esquema de datos en el cliente',
          'Implementar validación de entrada más estricta',
          'Revisar documentación de la API',
          'Agregar tests de contrato entre servicios'
        );
        break;

      case 'service':
        recommendations.push(
          'Verificar el health status del servicio',
          'Revisar logs del servicio downstream',
          'Escalar instancias si hay problemas de capacidad',
          'Verificar configuración de circuit breakers'
        );
        break;

      default:
        recommendations.push(
          'Revisar logs detallados de la operación',
          'Verificar configuración del servicio',
          'Contactar al equipo propietario del servicio'
        );
    }

    // Recomendaciones específicas basadas en la cadena de errores
    if (errorChain.length > 3) {
      recommendations.push(
        'La cadena de errores es larga, considerar simplificar la arquitectura',
        'Implementar fallbacks más cercanos al origen de la petición'
      );
    }

    return recommendations;
  }

  /**
   * Detecta y registra patrones de error
   */
  private detectErrorPattern(error: string, operation: string): void {
    // Normalizar el error (remover IDs, timestamps, etc.)
    const normalizedError = this.normalizeError(error);

    let pattern = this.errorPatterns.get(normalizedError);

    if (!pattern) {
      pattern = {
        pattern: normalizedError,
        occurrences: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        affectedOperations: [],
        examples: [],
      };
      this.errorPatterns.set(normalizedError, pattern);
    }

    pattern.occurrences++;
    pattern.lastSeen = new Date();

    if (!pattern.affectedOperations.includes(operation)) {
      pattern.affectedOperations.push(operation);
    }

    if (pattern.examples.length < 5 && !pattern.examples.includes(error)) {
      pattern.examples.push(error);
    }
  }

  /**
   * Normaliza un mensaje de error removiendo valores dinámicos
   */
  private normalizeError(error: string): string {
    return error
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
      .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, '<TIMESTAMP>')
      .replace(/\b\d+\b/g, '<NUMBER>')
      .replace(/\bhttps?:\/\/[^\s]+/g, '<URL>');
  }

  /**
   * Genera insights basados en patrones detectados
   */
  private generateInsights(patterns: ErrorPattern[], failedSpans: any[]): string[] {
    const insights: string[] = [];

    // Insight 1: Errores más frecuentes
    if (patterns.length > 0) {
      const topPattern = patterns[0];
      insights.push(
        `El error más común es "${topPattern.pattern}" con ${topPattern.occurrences} ocurrencias`
      );
    }

    // Insight 2: Patrones recurrentes
    const recurringPatterns = patterns.filter(p => p.occurrences > 5);
    if (recurringPatterns.length > 0) {
      insights.push(
        `Se detectaron ${recurringPatterns.length} patrones de error recurrentes que requieren atención`
      );
    }

    // Insight 3: Nuevos errores
    const recentPatterns = patterns.filter(p => {
      const ageMs = Date.now() - p.firstSeen.getTime();
      return ageMs < 3600000; // Últimas hora
    });
    if (recentPatterns.length > 0) {
      insights.push(
        `Se detectaron ${recentPatterns.length} nuevos tipos de error en la última hora`
      );
    }

    // Insight 4: Operaciones problemáticas
    const operationErrors = new Map<string, number>();
    for (const span of failedSpans) {
      const count = operationErrors.get(span.operationName) || 0;
      operationErrors.set(span.operationName, count + 1);
    }
    const topOperation = Array.from(operationErrors.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topOperation) {
      insights.push(
        `La operación "${topOperation[0]}" tiene la mayor cantidad de fallos (${topOperation[1]})`
      );
    }

    return insights;
  }

  /**
   * Genera un resumen legible del diagnóstico
   */
  private generateSummary(
    rootError: ErrorDetail,
    errorChain: ErrorDetail[],
    affectedServices: string[]
  ): string {
    const serviceList = affectedServices.join(', ');
    const chainLength = errorChain.length;

    return `${rootError.error} en ${rootError.operation}. ` +
           `${chainLength} error(es) en cadena afectando ${affectedServices.length} servicio(s): ${serviceList}`;
  }

  /**
   * Calcula el timeframe de una traza
   */
  private calculateTimeframe(spans: any[]): string {
    if (spans.length === 0) return '0ms';

    const startTimes = spans.map(s => s.startTime);
    const endTimes = spans.map(s => s.endTime || s.startTime);

    const start = Math.min(...startTimes);
    const end = Math.max(...endTimes);

    return `${end - start}ms`;
  }

  /**
   * Inicializa patrones de error conocidos
   */
  private initializeKnownPatterns(): void {
    // Pueden cargarse desde configuración o base de datos
    const knownPatterns = [
      'Connection timeout',
      'Service unavailable',
      'Circuit breaker is OPEN',
      'Invalid signature',
      'Duplicate event',
    ];

    for (const pattern of knownPatterns) {
      this.errorPatterns.set(pattern, {
        pattern,
        occurrences: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        affectedOperations: [],
        examples: [],
      });
    }
  }

  /**
   * Limpia datos antiguos
   */
  cleanup(): void {
    const cutoffTime = Date.now() - 86400000; // 24 horas

    // Limpiar diagnósticos antiguos
    const toKeep = this.recentDiagnoses.filter(
      d => d.timestamp.getTime() > cutoffTime
    );

    this.recentDiagnoses.length = 0;
    this.recentDiagnoses.push(...toKeep);

    // Limpiar patrones sin actividad reciente
    for (const [key, pattern] of this.errorPatterns.entries()) {
      if (pattern.lastSeen.getTime() < cutoffTime) {
        this.errorPatterns.delete(key);
      }
    }

    this.logger.debug(`Cleanup completado: ${this.recentDiagnoses.length} diagnósticos restantes`);
  }
}
