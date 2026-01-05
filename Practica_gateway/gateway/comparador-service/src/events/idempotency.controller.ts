import { Controller, Get, Delete, Param, Post, Body } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

/**
 * Idempotency Controller
 * 
 * Endpoints para gestionar y monitorear el servicio de idempotencia
 */
@Controller('idempotency')
export class IdempotencyController {
  constructor(private readonly idempotency: IdempotencyService) {}

  /**
   * Obtener estadísticas del servicio de idempotencia
   * 
   * GET /idempotency/stats
   */
  @Get('stats')
  getStats() {
    return {
      status: 'active',
      timestamp: new Date().toISOString(),
      stats: this.idempotency.getStats(),
    };
  }

  /**
   * Verificar si una clave ya fue procesada
   * 
   * POST /idempotency/check
   * Body: { eventType, entityId, action, additionalContext? }
   */
  @Post('check')
  async checkKey(
    @Body() body: {
      eventType: string;
      entityId: string | number;
      action: string;
      additionalContext?: Record<string, any>;
    }
  ) {
    const key = await this.idempotency.generateKey(
      body.eventType,
      body.entityId,
      body.action,
      body.additionalContext,
    );

    const check = await this.idempotency.isDuplicate(key);

    return {
      key: key.key,
      hash: key.hash,
      check,
    };
  }

  /**
   * Limpiar claves expiradas manualmente
   * 
   * POST /idempotency/cleanup
   */
  @Post('cleanup')
  async cleanup() {
    const deletedCount = await this.idempotency.cleanupExpiredKeys();

    return {
      status: 'success',
      deletedCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resetear store de idempotencia (solo para testing)
   * 
   * DELETE /idempotency/reset
   */
  @Delete('reset')
  async reset() {
    await this.idempotency.reset();

    return {
      status: 'success',
      message: 'Idempotency store reset successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Eliminar una clave específica
   * 
   * DELETE /idempotency/key
   * Body: { eventType, entityId, action, additionalContext? }
   */
  @Delete('key')
  async deleteKey(
    @Body() body: {
      eventType: string;
      entityId: string | number;
      action: string;
      additionalContext?: Record<string, any>;
    }
  ) {
    const key = await this.idempotency.generateKey(
      body.eventType,
      body.entityId,
      body.action,
      body.additionalContext,
    );

    const deleted = await this.idempotency.deleteKey(key);

    return {
      status: deleted ? 'success' : 'not_found',
      key: key.key,
      hash: key.hash,
      deleted,
      timestamp: new Date().toISOString(),
    };
  }
}
