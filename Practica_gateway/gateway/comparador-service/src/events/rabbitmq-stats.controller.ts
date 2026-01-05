import { Controller, Get } from '@nestjs/common';
import { RabbitMQEventListenerService } from './rabbitmq-event-listener.service';

/**
 * Controlador de Estadísticas de RabbitMQ Listeners
 * 
 * Proporciona endpoints para monitorear el procesamiento de eventos
 */
@Controller('events/rabbitmq')
export class RabbitMQStatsController {
  constructor(
    private readonly listenerService: RabbitMQEventListenerService,
  ) {}

  /**
   * Obtiene estadísticas de procesamiento de eventos
   * GET /events/rabbitmq/stats
   */
  @Get('stats')
  getStats() {
    return this.listenerService.getStats();
  }

  /**
   * Health check del listener
   * GET /events/rabbitmq/health
   */
  @Get('health')
  getHealth() {
    const stats = this.listenerService.getStats();

    return {
      status: stats.successRate > 95 ? 'healthy' : stats.successRate > 80 ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        totalEventsProcessed: stats.totalEventsProcessed,
        successRate: stats.successRate.toFixed(2) + '%',
        avgProcessingTime: stats.avgProcessingTime.toFixed(2) + 'ms',
      },
    };
  }
}
