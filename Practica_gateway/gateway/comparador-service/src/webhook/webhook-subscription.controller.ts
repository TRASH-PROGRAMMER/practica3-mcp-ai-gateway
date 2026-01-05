import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  ParseIntPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { WebhookDeliveryService } from './webhook-delivery.service';
import type { WebhookSubscription } from './webhook-sender.service';
import { RetryConfig } from './webhook-sender.service';
import { StandardWebhookDto } from './standard-webhook.dto';

/**
 * DTO para crear suscripción
 */
export class CreateSubscriptionDto {
  name: string;
  endpointUrl: string;
  secret: string;
  events: string[];
  retryConfig?: RetryConfig;
}

/**
 * DTO para actualizar suscripción
 */
export class UpdateSubscriptionDto {
  name?: string;
  endpointUrl?: string;
  secret?: string;
  events?: string[];
  active?: boolean;
  retryConfig?: RetryConfig;
}

/**
 * DTO para enviar webhook manual
 */
export class SendWebhookDto extends StandardWebhookDto {}

/**
 * Controlador de gestión de suscripciones de webhook
 * 
 * Endpoints para:
 * - ✅ Registrar URLs de webhook
 * - ✅ Listar suscripciones
 * - ✅ Actualizar/eliminar suscripciones
 * - ✅ Activar/desactivar suscripciones
 * - ✅ Ver estadísticas de entrega
 * - ✅ Enviar webhooks manuales
 * - ✅ Ver historial de entregas
 */
@Controller('webhook/subscriptions')
export class WebhookSubscriptionController {
  constructor(private readonly deliveryService: WebhookDeliveryService) {}

  // ============================================
  // GESTIÓN DE SUSCRIPCIONES
  // ============================================

  /**
   * Lista todas las suscripciones
   * GET /webhook/subscriptions
   */
  @Get()
  getAllSubscriptions(): WebhookSubscription[] {
    return this.deliveryService.getAllSubscriptions();
  }

  /**
   * Obtiene una suscripción específica
   * GET /webhook/subscriptions/:id
   */
  @Get(':id')
  getSubscription(@Param('id', ParseIntPipe) id: number): WebhookSubscription {
    const subscription = this.deliveryService.getSubscription(id);

    if (!subscription) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    return subscription;
  }

  /**
   * Crea una nueva suscripción
   * POST /webhook/subscriptions
   * 
   * Body:
   * {
   *   "name": "Sistema de Notificaciones",
   *   "endpointUrl": "https://api.example.com/webhooks",
   *   "secret": "secret-key-123",
   *   "events": ["producto.*", "prescripcion.creada"],
   *   "retryConfig": {
   *     "maxAttempts": 3,
   *     "delays": [5000, 15000, 60000]
   *   }
   * }
   */
  @Post()
  createSubscription(@Body() dto: CreateSubscriptionDto): WebhookSubscription {
    // Validaciones
    if (!dto.name || dto.name.trim() === '') {
      throw new HttpException('El nombre es requerido', HttpStatus.BAD_REQUEST);
    }

    if (!dto.endpointUrl || !this.isValidUrl(dto.endpointUrl)) {
      throw new HttpException('URL inválida', HttpStatus.BAD_REQUEST);
    }

    if (!dto.secret || dto.secret.length < 16) {
      throw new HttpException(
        'El secret debe tener al menos 16 caracteres',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!dto.events || dto.events.length === 0) {
      throw new HttpException(
        'Debe especificar al menos un tipo de evento',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Crear suscripción
    const subscriptionData = {
      ...dto,
      retryConfig: dto.retryConfig || {
        maxAttempts: 3,
        delays: [5000, 15000, 60000],
      },
    };
    return this.deliveryService.addSubscription(subscriptionData);
  }

  /**
   * Actualiza una suscripción existente
   * PUT /webhook/subscriptions/:id
   */
  @Put(':id')
  updateSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
  ): WebhookSubscription {
    // Validaciones
    if (dto.endpointUrl && !this.isValidUrl(dto.endpointUrl)) {
      throw new HttpException('URL inválida', HttpStatus.BAD_REQUEST);
    }

    if (dto.secret && dto.secret.length < 16) {
      throw new HttpException(
        'El secret debe tener al menos 16 caracteres',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.events && dto.events.length === 0) {
      throw new HttpException(
        'Debe especificar al menos un tipo de evento',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = this.deliveryService.updateSubscription(id, dto);

    if (!updated) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    return updated;
  }

  /**
   * Elimina una suscripción
   * DELETE /webhook/subscriptions/:id
   */
  @Delete(':id')
  deleteSubscription(@Param('id', ParseIntPipe) id: number): { message: string } {
    const deleted = this.deliveryService.deleteSubscription(id);

    if (!deleted) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    return { message: 'Suscripción eliminada exitosamente' };
  }

  /**
   * Activa una suscripción
   * POST /webhook/subscriptions/:id/activate
   */
  @Post(':id/activate')
  activateSubscription(@Param('id', ParseIntPipe) id: number): WebhookSubscription {
    const updated = this.deliveryService.toggleSubscription(id, true);

    if (!updated) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    return updated;
  }

  /**
   * Desactiva una suscripción
   * POST /webhook/subscriptions/:id/deactivate
   */
  @Post(':id/deactivate')
  deactivateSubscription(@Param('id', ParseIntPipe) id: number): WebhookSubscription {
    const updated = this.deliveryService.toggleSubscription(id, false);

    if (!updated) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    return updated;
  }

  // ============================================
  // ESTADÍSTICAS Y ENTREGAS
  // ============================================

  /**
   * Obtiene estadísticas globales de entrega
   * GET /webhook/subscriptions/stats
   */
  @Get('stats/global')
  async getGlobalStats() {
    return await this.deliveryService.getDeliveryStats();
  }

  /**
   * Obtiene estadísticas de una suscripción específica
   * GET /webhook/subscriptions/:id/stats
   */
  @Get(':id/stats')
  async getSubscriptionStats(@Param('id', ParseIntPipe) id: number) {
    const subscription = this.deliveryService.getSubscription(id);

    if (!subscription) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    const deliveries = await this.deliveryService.getDeliveriesBySubscription(id);
    const stats = await this.deliveryService.getDeliveryStats();

    return {
      subscription: {
        id: subscription.id,
        name: subscription.name,
        active: subscription.active,
      },
      stats: stats.bySubscription[id] || { total: 0, successful: 0, failed: 0 },
      recentDeliveries: deliveries.slice(0, 10),
    };
  }

  /**
   * Obtiene entregas recientes
   * GET /webhook/subscriptions/deliveries/recent
   */
  @Get('deliveries/recent')
  async getRecentDeliveries() {
    return await this.deliveryService.getRecentDeliveries(50);
  }

  /**
   * Obtiene entregas por evento
   * GET /webhook/subscriptions/deliveries/event/:eventId
   */
  @Get('deliveries/event/:eventId')
  async getDeliveriesByEvent(@Param('eventId') eventId: string) {
    return await this.deliveryService.getDeliveriesByEvent(eventId);
  }

  /**
   * Obtiene entregas de una suscripción
   * GET /webhook/subscriptions/:id/deliveries
   */
  @Get(':id/deliveries')
  getSubscriptionDeliveries(@Param('id', ParseIntPipe) id: number) {
    const subscription = this.deliveryService.getSubscription(id);

    if (!subscription) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    return this.deliveryService.getDeliveriesBySubscription(id);
  }

  // ============================================
  // ENVÍO MANUAL
  // ============================================

  /**
   * Envía un webhook manualmente
   * POST /webhook/subscriptions/send
   * 
   * Body: StandardWebhookDto
   */
  @Post('send/manual')
  async sendManualWebhook(@Body() dto: SendWebhookDto) {
    try {
      const deliveries = await this.deliveryService.deliverWebhook(dto);

      return {
        message: 'Webhook enviado',
        deliveries,
        summary: {
          total: deliveries.length,
          successful: deliveries.filter((d) => d.success).length,
          failed: deliveries.filter((d) => !d.success).length,
        },
      };
    } catch (error) {
      throw new HttpException(
        'Error al enviar webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Envía un webhook a una suscripción específica
   * POST /webhook/subscriptions/:id/send
   */
  @Post(':id/send')
  async sendToSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendWebhookDto,
  ) {
    const subscription = this.deliveryService.getSubscription(id);

    if (!subscription) {
      throw new HttpException('Suscripción no encontrada', HttpStatus.NOT_FOUND);
    }

    try {
      // Temporalmente forzar envío a esta suscripción
      const originalActive = subscription.active;
      const originalEvents = subscription.events;

      subscription.active = true;
      subscription.events = ['*']; // Temporal: aceptar cualquier evento

      const deliveries = await this.deliveryService.deliverWebhook(dto);

      // Restaurar configuración original
      subscription.active = originalActive;
      subscription.events = originalEvents;

      const delivery = deliveries.find((d) => d.subscriptionId === id);

      if (!delivery) {
        throw new HttpException(
          'No se pudo enviar a la suscripción',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        message: delivery.success ? 'Webhook enviado exitosamente' : 'Webhook falló',
        delivery,
      };
    } catch (error) {
      throw new HttpException(
        'Error al enviar webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // HEALTH
  // ============================================

  /**
   * Health check del servicio de entrega
   * GET /webhook/subscriptions/health
   */
  @Get('health/status')
  async getHealth() {
    return await this.deliveryService.getHealth();
  }

  // ============================================
  // HELPERS
  // ============================================

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
