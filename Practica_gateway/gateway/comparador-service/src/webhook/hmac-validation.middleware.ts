import { 
  Injectable, 
  NestMiddleware, 
  HttpException, 
  HttpStatus,
  Logger 
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HmacSignatureService } from './hmac-signature.service';

/**
 * Middleware para validación automática de firmas HMAC en webhooks
 * 
 * Se aplica a rutas de webhooks para garantizar que:
 * - Todas las solicitudes tengan firma válida
 * - Los timestamps estén dentro del rango aceptable
 * - Se prevenga replay attacks
 */
@Injectable()
export class HmacValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HmacValidationMiddleware.name);

  constructor(private readonly hmacService: HmacSignatureService) {}

  /**
   * Valida la firma HMAC antes de procesar el webhook
   */
  use(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Extraer headers de firma
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      const eventId = req.headers['x-event-id'] as string;

      // 2. Validar presencia de firma
      if (!signature) {
        this.logger.warn('Webhook sin firma rechazado');
        throw new HttpException(
          {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: 'Firma de webhook requerida',
            error: 'Missing X-Webhook-Signature header',
          },
          HttpStatus.UNAUTHORIZED
        );
      }

      // 3. Obtener el body (payload)
      const payload = req.body;

      // 4. Validar firma
      const timestampNum = timestamp ? parseInt(timestamp, 10) : undefined;
      const isValid = this.hmacService.validateSignature(
        payload,
        signature,
        timestampNum
      );

      if (!isValid) {
        this.logger.warn(`Firma inválida para evento: ${eventId || 'unknown'}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: 'Firma de webhook inválida',
            error: 'Invalid HMAC signature',
            event_id: eventId,
          },
          HttpStatus.UNAUTHORIZED
        );
      }

      // 5. Firma válida, continuar
      this.logger.debug(`Firma validada exitosamente para evento: ${eventId}`);
      next();

    } catch (error) {
      // Si ya es un HttpException, relanzar
      if (error instanceof HttpException) {
        throw error;
      }

      // Error inesperado
      this.logger.error('Error en validación HMAC:', error);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error validando firma de webhook',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

/**
 * Middleware opcional que solo valida si la firma está presente
 * Útil para entornos de desarrollo o transición
 */
@Injectable()
export class OptionalHmacValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(OptionalHmacValidationMiddleware.name);

  constructor(private readonly hmacService: HmacSignatureService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const signature = req.headers['x-webhook-signature'] as string;

    // Si no hay firma, permitir (modo desarrollo)
    if (!signature) {
      this.logger.warn('⚠️  Webhook sin firma (modo desarrollo)');
      return next();
    }

    // Si hay firma, validarla
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const timestampNum = timestamp ? parseInt(timestamp, 10) : undefined;
    const isValid = this.hmacService.validateSignature(
      req.body,
      signature,
      timestampNum
    );

    if (!isValid) {
      throw new HttpException(
        'Firma HMAC inválida',
        HttpStatus.UNAUTHORIZED
      );
    }

    next();
  }
}
