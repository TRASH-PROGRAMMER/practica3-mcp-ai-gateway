import { Controller, Get } from '@nestjs/common';
import { GatewayRabbitMQListenerService } from './rabbitmq-listener.service';

/**
 * Controlador de Estadísticas de RabbitMQ para Gateway
 */
@Controller('events/rabbitmq')
export class GatewayRabbitMQStatsController {
  constructor(
    private readonly listenerService: GatewayRabbitMQListenerService,
  ) {}

  /**
   * Obtiene estadísticas de listeners
   * GET /events/rabbitmq/stats
   */
  @Get('stats')
  getStats() {
    return this.listenerService.getStats();
  }

  /**
   * Health check
   * GET /events/rabbitmq/health
   */
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'gateway-rabbitmq-listener',
    };
  }
}
