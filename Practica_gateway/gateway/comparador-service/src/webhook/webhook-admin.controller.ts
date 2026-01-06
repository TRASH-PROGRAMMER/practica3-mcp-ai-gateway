import { Controller, Get, Post, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CircuitBreakerService, CircuitMetrics } from './circuit-breaker.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { IdempotencyService } from './idempotency.service';
import { ObservabilityService } from './observability.service';

/**
 * Controlador de Administración de Webhooks
 * 
 * Endpoints para gestionar y monitorear el sistema de webhooks:
 * - Dead Letter Queue
 * - Circuit Breakers
 * - Métricas de idempotencia
 * - Observabilidad
 */
@Controller('webhook/admin')
export class WebhookAdminController {
  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly dlq: DeadLetterQueueService,
    private readonly idempotency: IdempotencyService,
    private readonly observability: ObservabilityService,
  ) {}

  // ============================================
  // DEAD LETTER QUEUE
  // ============================================

  /**
   * Lista todos los mensajes en la DLQ
   * GET /webhook/admin/dlq
   */
  @Get('dlq')
  getDLQMessages(): any {
    return {
      messages: this.dlq.getAll(),
      stats: this.dlq.getStats(),
    };
  }

  /**
   * Obtiene mensajes de la DLQ por estado
   * GET /webhook/admin/dlq/status/:status
   */
  @Get('dlq/status/:status')
  getDLQMessagesByStatus(@Param('status') status: string): any {
    const validStatuses = ['pending', 'retrying', 'exhausted', 'recovered'];
    
    if (!validStatuses.includes(status)) {
      throw new HttpException(
        `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    return this.dlq.getByStatus(status as any);
  }

  /**
   * Obtiene un mensaje específico de la DLQ
   * GET /webhook/admin/dlq/:eventId
   */
  @Get('dlq/:eventId')
  getDLQMessage(@Param('eventId') eventId: string): any {
    const message = this.dlq.getMessage(eventId);
    
    if (!message) {
      throw new HttpException(
        `Mensaje ${eventId} no encontrado en DLQ`,
        HttpStatus.NOT_FOUND
      );
    }

    return message;
  }

  /**
   * Reintenta manualmente un mensaje de la DLQ
   * POST /webhook/admin/dlq/:eventId/retry
   */
  @Post('dlq/:eventId/retry')
  async retryDLQMessage(@Param('eventId') eventId: string) {
    const success = await this.dlq.manualRetry(eventId);
    
    if (!success) {
      throw new HttpException(
        `Mensaje ${eventId} no encontrado en DLQ`,
        HttpStatus.NOT_FOUND
      );
    }

    return {
      status: 'success',
      message: `Reintento iniciado para evento ${eventId}`,
      eventId,
    };
  }

  /**
   * Descarta permanentemente un mensaje de la DLQ
   * POST /webhook/admin/dlq/:eventId/discard
   */
  @Post('dlq/:eventId/discard')
  async discardDLQMessage(
    @Param('eventId') eventId: string,
    @Body('reason') reason: string
  ) {
    if (!reason) {
      throw new HttpException(
        'Se requiere una razón para descartar el mensaje',
        HttpStatus.BAD_REQUEST
      );
    }

    const success = await this.dlq.discardMessage(eventId, reason);
    
    if (!success) {
      throw new HttpException(
        `Mensaje ${eventId} no encontrado en DLQ`,
        HttpStatus.NOT_FOUND
      );
    }

    return {
      status: 'success',
      message: `Mensaje ${eventId} descartado`,
      reason,
    };
  }

  /**
   * Obtiene estadísticas de la DLQ
   * GET /webhook/admin/dlq/stats
   */
  @Get('dlq-stats')
  getDLQStats() {
    return this.dlq.getStats();
  }

  // ============================================
  // CIRCUIT BREAKERS
  // ============================================

  /**
   * Lista todos los circuit breakers y sus estados
   * GET /webhook/admin/circuit-breakers
   */
  @Get('circuit-breakers')
  getCircuitBreakers(): { circuits: Record<string, CircuitMetrics>; total: number } {
    const circuits = this.circuitBreaker.getAllMetrics();
    return {
      circuits: Object.fromEntries(circuits),
      total: circuits.size,
    };
  }

  /**
   * Obtiene métricas de un circuit breaker específico
   * GET /webhook/admin/circuit-breakers/:name
   */
  @Get('circuit-breakers/:name')
  getCircuitBreaker(@Param('name') name: string): CircuitMetrics | null {
    const metrics = this.circuitBreaker.getMetrics(name);
    
    if (!metrics) {
      throw new HttpException(
        `Circuit breaker '${name}' no encontrado`,
        HttpStatus.NOT_FOUND
      );
    }

    return metrics;
  }

  /**
   * Resetea un circuit breaker
   * POST /webhook/admin/circuit-breakers/:name/reset
   */
  @Post('circuit-breakers/:name/reset')
  resetCircuitBreaker(@Param('name') name: string) {
    this.circuitBreaker.resetCircuit(name);
    
    return {
      status: 'success',
      message: `Circuit breaker '${name}' reseteado`,
      name,
    };
  }

  /**
   * Fuerza el cierre de un circuit breaker
   * POST /webhook/admin/circuit-breakers/:name/close
   */
  @Post('circuit-breakers/:name/close')
  forceCloseCircuitBreaker(@Param('name') name: string) {
    this.circuitBreaker.forceClose(name);
    
    return {
      status: 'success',
      message: `Circuit breaker '${name}' forzado a CLOSED`,
      name,
    };
  }

  /**
   * Fuerza la apertura de un circuit breaker
   * POST /webhook/admin/circuit-breakers/:name/open
   */
  @Post('circuit-breakers/:name/open')
  forceOpenCircuitBreaker(@Param('name') name: string) {
    this.circuitBreaker.forceOpen(name);
    
    return {
      status: 'success',
      message: `Circuit breaker '${name}' forzado a OPEN`,
      name,
    };
  }

  // ============================================
  // MÉTRICAS Y OBSERVABILIDAD
  // ============================================

  /**
   * Obtiene estadísticas de idempotencia
   * GET /webhook/admin/idempotency/stats
   */
  @Get('idempotency/stats')
  getIdempotencyStats() {
    return this.idempotency.getStats();
  }

  /**
   * Obtiene métricas de rendimiento
   * GET /webhook/admin/metrics
   */
  @Get('metrics')
  getMetrics() {
    return {
      operations: this.observability.getMetrics(),
    };
  }

  /**
   * Obtiene métricas de una operación específica
   * GET /webhook/admin/metrics/:operation
   */
  @Get('metrics/:operation')
  getOperationMetrics(@Param('operation') operation: string) {
    const metrics = this.observability.getMetrics(operation);
    
    if (metrics.length === 0) {
      throw new HttpException(
        `No hay métricas para la operación '${operation}'`,
        HttpStatus.NOT_FOUND
      );
    }

    return metrics[0];
  }

  /**
   * Dashboard consolidado
   * GET /webhook/admin/dashboard
   */
  @Get('dashboard')
  getDashboard(): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      deadLetterQueue: this.dlq.getStats(),
      circuitBreakers: Object.fromEntries(this.circuitBreaker.getAllMetrics()),
      idempotency: this.idempotency.getStats(),
      metrics: this.observability.getMetrics(),
    };
  }
}
