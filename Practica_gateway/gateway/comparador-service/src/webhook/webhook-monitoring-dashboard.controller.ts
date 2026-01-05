import { Controller, Get, Query, Param, Render } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService } from './distributed-tracing.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { IdempotencyService } from './idempotency.service';

/**
 * Dashboard de Monitoreo de Webhooks
 * 
 * Proporciona visualización en tiempo real de:
 * - Métricas de entrega de webhooks
 * - Trazas distribuidas
 * - Estado de circuit breakers
 * - Análisis de fallos
 * - Health checks
 */
@Controller('webhook/dashboard')
export class WebhookMonitoringDashboardController {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly tracing: DistributedTracingService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly dlq: DeadLetterQueueService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Dashboard principal con métricas consolidadas
   * GET /webhook/dashboard
   */
  @Get()
  getMainDashboard(): Record<string, any> {
    const now = new Date();
    const traceStats = this.tracing.getTraceStats();
    const perfMetrics = this.observability.getMetrics();
    const circuits = this.circuitBreaker.getAllMetrics();
    const dlqStats = this.dlq.getStats();
    const idempotencyStats = this.idempotency.getStats();

    // Calcular health score
    const healthScore = this.calculateHealthScore({
      errorRate: traceStats.errorRate,
      dlqSize: dlqStats.total,
      openCircuits: Array.from(circuits.values()).filter(c => c.state === 'OPEN').length,
    });

    return {
      timestamp: now.toISOString(),
      healthScore,
      status: this.getSystemStatus(healthScore),
      
      overview: {
        totalRequests: traceStats.totalSpans,
        activeRequests: traceStats.activeSpans,
        successRate: (100 - traceStats.errorRate).toFixed(2) + '%',
        avgResponseTime: traceStats.avgDuration.toFixed(2) + 'ms',
      },

      webhookDelivery: {
        total: perfMetrics.find(m => m.operation === 'webhook.send')?.totalCalls || 0,
        successRate: perfMetrics.find(m => m.operation === 'webhook.send')?.successRate || 100,
        avgDeliveryTime: perfMetrics.find(m => m.operation === 'webhook.send')?.avgDuration || 0,
        p95DeliveryTime: perfMetrics.find(m => m.operation === 'webhook.send')?.p95Duration || 0,
      },

      deadLetterQueue: {
        total: dlqStats.total,
        pending: dlqStats.pending,
        retrying: dlqStats.retrying,
        exhausted: dlqStats.exhausted,
        oldestMessage: dlqStats.oldestMessage ? {
          age: this.getAgeInMinutes(dlqStats.oldestMessage as Date),
        } : null,
      },

      circuitBreakers: {
        total: circuits.size,
        open: Array.from(circuits.values()).filter(c => c.state === 'OPEN').length,
        halfOpen: Array.from(circuits.values()).filter(c => c.state === 'HALF_OPEN').length,
        closed: Array.from(circuits.values()).filter(c => c.state === 'CLOSED').length,
        circuits: Array.from(circuits.entries()).map(([name, metrics]) => ({
          name,
          state: metrics.state,
          failures: metrics.failures,
          errorRate: ((metrics.totalFailures / metrics.totalRequests) * 100).toFixed(2) + '%',
        })),
      },

      idempotency: {
        totalEvents: idempotencyStats.totalKeys,
        processing: idempotencyStats.processing,
        completed: idempotencyStats.completed,
        failed: idempotencyStats.failed,
      },

      slowestOperations: traceStats.slowestOperations.slice(0, 5).map(op => ({
        operation: op.operation,
        avgDuration: op.avgDuration.toFixed(2) + 'ms',
        count: op.count,
      })),

      recentErrors: this.tracing.getFailedTraces(10).map(span => ({
        traceId: span.traceId,
        operation: span.operationName,
        error: span.error?.message,
        timestamp: new Date(span.startTime).toISOString(),
        duration: span.duration + 'ms',
      })),
    };
  }

  /**
   * Métricas de rendimiento detalladas
   * GET /webhook/dashboard/metrics
   */
  @Get('metrics')
  getDetailedMetrics(): Record<string, any> {
    const perfMetrics = this.observability.getMetrics();
    const traceStats = this.tracing.getTraceStats();

    return {
      timestamp: new Date().toISOString(),
      performance: perfMetrics.map(metric => ({
        operation: metric.operation,
        totalCalls: metric.totalCalls,
        successRate: metric.successRate.toFixed(2) + '%',
        avgDuration: metric.avgDuration.toFixed(2) + 'ms',
        p50Duration: metric.p50Duration.toFixed(2) + 'ms',
        p95Duration: metric.p95Duration.toFixed(2) + 'ms',
        p99Duration: metric.p99Duration.toFixed(2) + 'ms',
      })),
      tracing: {
        totalSpans: traceStats.totalSpans,
        activeSpans: traceStats.activeSpans,
        errorRate: traceStats.errorRate.toFixed(2) + '%',
        avgDuration: traceStats.avgDuration.toFixed(2) + 'ms',
      },
    };
  }

  /**
   * Vista de trazas distribuidas
   * GET /webhook/dashboard/traces
   */
  @Get('traces')
  getTraces(
    @Query('limit') limit?: string,
    @Query('status') status?: 'success' | 'error'
  ): Record<string, any> {
    const limitNum = parseInt(limit || '50', 10);
    let traces = this.tracing['completedSpans'] as any[];

    if (status === 'error') {
      traces = traces.filter(t => t.status === 'error');
    } else if (status === 'success') {
      traces = traces.filter(t => t.status === 'success');
    }

    traces = traces.slice(-limitNum);

    return {
      timestamp: new Date().toISOString(),
      total: traces.length,
      traces: traces.map(span => ({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        operation: span.operationName,
        service: span.serviceName,
        status: span.status,
        duration: span.duration + 'ms',
        startTime: new Date(span.startTime).toISOString(),
        tags: span.tags,
        error: span.error,
      })),
    };
  }

  /**
   * Detalle de una traza específica
   * GET /webhook/dashboard/traces/:traceId
   */
  @Get('traces/:traceId')
  getTraceDetail(@Param('traceId') traceId: string): Record<string, any> {
    const spans = this.tracing.getTrace(traceId);

    if (spans.length === 0) {
      return {
        error: 'Traza no encontrada',
        traceId,
      };
    }

    // Visualización en árbol
    const treeVisualization = this.tracing.visualizeTrace(traceId);

    // Calcular duración total
    const rootSpans = spans.filter(s => !s.parentSpanId);
    const totalDuration = rootSpans.reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      traceId,
      totalSpans: spans.length,
      totalDuration: totalDuration + 'ms',
      status: spans.some(s => s.status === 'error') ? 'error' : 'success',
      startTime: new Date(Math.min(...spans.map(s => s.startTime))).toISOString(),
      endTime: new Date(Math.max(...spans.map(s => s.endTime || s.startTime))).toISOString(),
      visualization: treeVisualization,
      spans: spans.map(span => ({
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        operation: span.operationName,
        service: span.serviceName,
        status: span.status,
        duration: span.duration + 'ms',
        tags: span.tags,
        logs: span.logs,
        error: span.error,
      })),
    };
  }

  /**
   * Análisis de fallos
   * GET /webhook/dashboard/failures
   */
  @Get('failures')
  getFailureAnalysis(@Query('limit') limit?: string): Record<string, any> {
    const limitNum = parseInt(limit || '50', 10);
    const failedSpans = this.tracing.getFailedTraces(limitNum);

    // Agrupar por tipo de error
    const errorGroups = new Map<string, any[]>();
    
    for (const span of failedSpans) {
      const errorType = span.error?.message || 'Unknown error';
      if (!errorGroups.has(errorType)) {
        errorGroups.set(errorType, []);
      }
      errorGroups.get(errorType)!.push(span);
    }

    // Agrupar por operación
    const operationGroups = new Map<string, any[]>();
    
    for (const span of failedSpans) {
      if (!operationGroups.has(span.operationName)) {
        operationGroups.set(span.operationName, []);
      }
      operationGroups.get(span.operationName)!.push(span);
    }

    return {
      timestamp: new Date().toISOString(),
      totalFailures: failedSpans.length,
      
      byErrorType: Array.from(errorGroups.entries()).map(([error, spans]) => ({
        error,
        count: spans.length,
        percentage: ((spans.length / failedSpans.length) * 100).toFixed(2) + '%',
        operations: [...new Set(spans.map(s => s.operationName))],
        recentOccurrence: new Date(Math.max(...spans.map(s => s.startTime))).toISOString(),
      })).sort((a, b) => b.count - a.count),

      byOperation: Array.from(operationGroups.entries()).map(([operation, spans]) => ({
        operation,
        count: spans.length,
        percentage: ((spans.length / failedSpans.length) * 100).toFixed(2) + '%',
        errors: [...new Set(spans.map(s => s.error?.message).filter(Boolean))],
      })).sort((a, b) => b.count - a.count),

      recentFailures: failedSpans.slice(-10).map(span => ({
        traceId: span.traceId,
        operation: span.operationName,
        error: span.error?.message,
        timestamp: new Date(span.startTime).toISOString(),
        duration: span.duration + 'ms',
        tags: span.tags,
      })),
    };
  }

  /**
   * Health check detallado
   * GET /webhook/dashboard/health
   */
  @Get('health')
  getHealthCheck(): Record<string, any> {
    const traceStats = this.tracing.getTraceStats();
    const circuits = this.circuitBreaker.getAllMetrics();
    const dlqStats = this.dlq.getStats();

    const checks = {
      database: this.checkDatabase(),
      circuitBreakers: this.checkCircuitBreakers(circuits),
      deadLetterQueue: this.checkDLQ(dlqStats),
      errorRate: this.checkErrorRate(traceStats.errorRate),
      responseTime: this.checkResponseTime(traceStats.avgDuration),
    };

    const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
    const anyDegraded = Object.values(checks).some(c => c.status === 'degraded');

    return {
      timestamp: new Date().toISOString(),
      status: allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy',
      checks,
    };
  }

  /**
   * Endpoint para alertas (compatible con Prometheus AlertManager)
   * GET /webhook/dashboard/alerts
   */
  @Get('alerts')
  getActiveAlerts(): Record<string, any> {
    const alerts: any[] = [];
    const traceStats = this.tracing.getTraceStats();
    const circuits = this.circuitBreaker.getAllMetrics();
    const dlqStats = this.dlq.getStats();

    // Alert: Alta tasa de errores
    if (traceStats.errorRate > 10) {
      alerts.push({
        severity: traceStats.errorRate > 25 ? 'critical' : 'warning',
        name: 'HighErrorRate',
        message: `Tasa de errores alta: ${traceStats.errorRate.toFixed(2)}%`,
        value: traceStats.errorRate,
        threshold: 10,
      });
    }

    // Alert: Circuit breakers abiertos
    const openCircuits = Array.from(circuits.values()).filter(c => c.state === 'OPEN');
    if (openCircuits.length > 0) {
      alerts.push({
        severity: 'warning',
        name: 'OpenCircuitBreakers',
        message: `${openCircuits.length} circuit breaker(s) abiertos`,
        value: openCircuits.length,
        details: openCircuits.map(c => c.state),
      });
    }

    // Alert: DLQ creciendo
    if (dlqStats.total > 100) {
      alerts.push({
        severity: dlqStats.total > 500 ? 'critical' : 'warning',
        name: 'DLQGrowing',
        message: `Dead Letter Queue tiene ${dlqStats.total} mensajes`,
        value: dlqStats.total,
        threshold: 100,
      });
    }

    // Alert: Tiempo de respuesta lento
    if (traceStats.avgDuration > 1000) {
      alerts.push({
        severity: traceStats.avgDuration > 3000 ? 'critical' : 'warning',
        name: 'SlowResponseTime',
        message: `Tiempo de respuesta promedio: ${traceStats.avgDuration.toFixed(2)}ms`,
        value: traceStats.avgDuration,
        threshold: 1000,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      totalAlerts: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warnings: alerts.filter(a => a.severity === 'warning').length,
      alerts,
    };
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  private calculateHealthScore(params: {
    errorRate: number;
    dlqSize: number;
    openCircuits: number;
  }): number {
    let score = 100;

    // Penalizar por errores
    score -= params.errorRate;

    // Penalizar por DLQ grande
    if (params.dlqSize > 100) {
      score -= Math.min(20, params.dlqSize / 50);
    }

    // Penalizar por circuitos abiertos
    score -= params.openCircuits * 10;

    return Math.max(0, Math.min(100, score));
  }

  private getSystemStatus(healthScore: number): string {
    if (healthScore >= 90) return '🟢 Excellent';
    if (healthScore >= 70) return '🟡 Good';
    if (healthScore >= 50) return '🟠 Degraded';
    return '🔴 Critical';
  }

  private getAgeInMinutes(timestamp: Date): string {
    const ageMs = Date.now() - timestamp.getTime();
    const minutes = Math.floor(ageMs / 60000);
    
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  private checkDatabase(): { status: string; message: string } {
    // Implementar check real de base de datos
    return {
      status: 'healthy',
      message: 'Database connection OK',
    };
  }

  private checkCircuitBreakers(circuits: Map<string, any>): { status: string; message: string } {
    const openCircuits = Array.from(circuits.values()).filter(c => c.state === 'OPEN');
    
    if (openCircuits.length === 0) {
      return { status: 'healthy', message: 'All circuits closed' };
    }
    
    return {
      status: 'degraded',
      message: `${openCircuits.length} circuit(s) open`,
    };
  }

  private checkDLQ(stats: any): { status: string; message: string } {
    if (stats.total === 0) {
      return { status: 'healthy', message: 'DLQ empty' };
    }
    
    if (stats.total < 100) {
      return { status: 'healthy', message: `${stats.total} messages in DLQ` };
    }
    
    return {
      status: 'degraded',
      message: `${stats.total} messages in DLQ (>100)`,
    };
  }

  private checkErrorRate(errorRate: number): { status: string; message: string } {
    if (errorRate < 5) {
      return { status: 'healthy', message: `Error rate: ${errorRate.toFixed(2)}%` };
    }
    
    if (errorRate < 15) {
      return { status: 'degraded', message: `Error rate: ${errorRate.toFixed(2)}%` };
    }
    
    return {
      status: 'unhealthy',
      message: `Error rate: ${errorRate.toFixed(2)}% (>15%)`,
    };
  }

  private checkResponseTime(avgDuration: number): { status: string; message: string } {
    if (avgDuration < 500) {
      return { status: 'healthy', message: `Avg response: ${avgDuration.toFixed(2)}ms` };
    }
    
    if (avgDuration < 2000) {
      return { status: 'degraded', message: `Avg response: ${avgDuration.toFixed(2)}ms` };
    }
    
    return {
      status: 'unhealthy',
      message: `Avg response: ${avgDuration.toFixed(2)}ms (>2s)`,
    };
  }
}
