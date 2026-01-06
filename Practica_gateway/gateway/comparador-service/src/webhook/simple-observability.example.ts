/**
 * EJEMPLO FUNCIONAL SIMPLIFICADO
 * Sistema de Observabilidad - Uso Básico
 */

import { Injectable } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService } from './distributed-tracing.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class SimpleObservabilityExample {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly tracing: DistributedTracingService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Ejemplo 1: Operación simple con logging estructurado
   */
  async basicLogging() {
    // Log simple
    this.observability.info('Operación iniciada');

    // Log con metadata
    this.observability.info('Procesando evento', {
      eventId: 'evt_123',
      eventType: 'producto.creado',
    });

    // Log de error
    try {
      throw new Error('Ejemplo de error');
    } catch (error) {
      this.observability.error('Error en operación', error as Error, {
        eventId: 'evt_123',
      });
    }
  }

  /**
   * Ejemplo 2: Medir tiempo de operación
   */
  async measurePerformance() {
    await this.observability.measureOperation(
      'database.query',
      async () => {
        // Simular operación
        await new Promise(resolve => setTimeout(resolve, 100));
        return { rows: 10 };
      },
      { query: 'SELECT * FROM productos' }
    );
  }

  /**
   * Ejemplo 3: Tracing distribuido
   */
  async distributedTracingExample() {
    // Crear contexto actual
    const context = this.observability.getCurrentContext();

    // Operación con tracing
    return await this.tracing.traceOperation(
      'webhook.send',
      async (span) => {
        // Agregar tags
        this.tracing.setSpanTags(span.spanId, {
          endpoint: 'https://api.example.com',
          method: 'POST',
        });

        // Log en el span
        this.tracing.logToSpan(span.spanId, 'info', 'Iniciando envío');

        // Simular operación
        await new Promise(resolve => setTimeout(resolve, 200));

        this.tracing.logToSpan(span.spanId, 'info', 'Envío completado');

        return { success: true };
      },
      context?.requestId,
      context?.traceId
    );
  }

  /**
   * Ejemplo 4: Circuit breaker
   */
  async useCircuitBreaker() {
    return await this.circuitBreaker.execute(
      'external-api',
      async () => {
        // Llamada a API externa
        const response = await fetch('https://api.example.com/data');
        return response.json();
      },
      {
        failureThreshold: 5,
        timeout: 30000,
      }
    );
  }

  /**
   * Ejemplo 5: Todo integrado
   */
  async fullExample() {
    const context = this.observability.getCurrentContext();

    return await this.tracing.traceOperation(
      'full.operation',
      async (span) => {
        // 1. Log inicial
        this.observability.info('Operación completa iniciada', {
          operationId: 'op_123',
        });

        // 2. Medir sub-operación
        const data = await this.observability.measureOperation(
          'data.fetch',
          async () => {
            return await this.circuitBreaker.execute(
              'data-service',
              async () => {
                // Headers con propagación de contexto
                const headers = {
                  ...this.observability.getPropagatetionHeaders(context || undefined),
                  ...this.tracing.injectTraceContext(span),
                };

                // Llamada externa
                const response = await fetch('https://api.example.com/data', {
                  headers,
                });

                return response.json();
              }
            );
          }
        );

        // 3. Log de éxito
        this.observability.info('Operación completada', {
          operationId: 'op_123',
          recordsProcessed: data.length,
        });

        return data;
      },
      context?.requestId,
      context?.traceId
    );
  }

  /**
   * Ejemplo 6: Manejo de errores con diagnóstico
   */
  async errorHandlingExample() {
    const context = this.observability.getCurrentContext();

    try {
      await this.tracing.traceOperation(
        'risky.operation',
        async (span) => {
          // Operación que puede fallar
          throw new Error('Simulación de error');
        },
        context?.requestId,
        context?.traceId
      );
    } catch (error) {
      // Log estructurado del error
      this.observability.error(
        'Error en operación riesgosa',
        error as Error,
        {
          operationId: 'op_456',
          severity: 'high',
        }
      );

      // Re-lanzar o manejar
      throw error;
    }
  }

  /**
   * Ejemplo 7: Obtener métricas
   */
  getMetrics() {
    // Métricas de rendimiento
    const perfMetrics = this.observability.getMetrics();

    // Estadísticas de tracing
    const traceStats = this.tracing.getTraceStats();

    // Circuit breakers
    const circuits = this.circuitBreaker.getAllMetrics();

    return {
      performance: perfMetrics,
      tracing: traceStats,
      circuitBreakers: Array.from(circuits.entries()),
    };
  }
}

/**
 * Ejemplo de uso en un controlador
 */

import { Controller, Post, Body, Get, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('example')
export class ObservabilityExampleController {
  constructor(
    private readonly example: SimpleObservabilityExample,
    private readonly observability: ObservabilityService,
  ) {}

  @Post('event')
  async handleEvent(@Body() event: any, @Req() req: Request) {
    // Crear contexto de correlación
    this.observability.createContext(req);

    // Procesar con observabilidad completa
    return await this.example.fullExample();
  }

  @Get('metrics')
  getMetrics() {
    return this.example.getMetrics();
  }
}

/**
 * SALIDAS DE EJEMPLO:
 * 
 * 1. Log estructurado (Producción):
 * {
 *   "timestamp": "2025-12-15T10:30:00.123Z",
 *   "level": "info",
 *   "message": "Procesando evento",
 *   "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "requestId": "x9y8z7w6-v5u4-3210-zyxw-vut9876543210",
 *   "metadata": {
 *     "eventId": "evt_123",
 *     "eventType": "producto.creado"
 *   }
 * }
 * 
 * 2. Métricas:
 * {
 *   "operation": "webhook.send",
 *   "totalCalls": 856,
 *   "successRate": 97.8,
 *   "avgDuration": 234.5,
 *   "p95Duration": 450.2
 * }
 * 
 * 3. Traza visualizada:
 * 📊 Traza: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 * ✅ full.operation (350ms)
 *   ✅ data.fetch (200ms)
 *     ✅ circuit-breaker (180ms)
 */
