import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Servicio para generación y validación de firmas HMAC-SHA256
 * 
 * Proporciona funcionalidades para:
 * - Generar firmas HMAC-SHA256 para webhooks salientes
 * - Validar firmas HMAC-SHA256 de webhooks entrantes
 * - Protección contra timing attacks
 * - Soporte para múltiples versiones de firma
 */
@Injectable()
export class HmacSignatureService {
  private readonly logger = new Logger(HmacSignatureService.name);
  private readonly algorithm = 'sha256';
  
  // Clave secreta desde variables de entorno
  private readonly webhookSecret = process.env.WEBHOOK_SECRET || 'default-secret-key';
  
  // Tiempo máximo de validez de la firma (5 minutos)
  private readonly maxTimestampDrift = 5 * 60 * 1000;

  constructor() {
    if (this.webhookSecret === 'default-secret-key') {
      this.logger.warn(
        '⚠️  Usando clave secreta por defecto. Configure WEBHOOK_SECRET en producción'
      );
    }
  }

  /**
   * Genera una firma HMAC-SHA256 para un payload
   * 
   * @param payload - Datos a firmar (objeto o string)
   * @param timestamp - Timestamp opcional para incluir en la firma
   * @returns Firma en formato "sha256=hexstring"
   * 
   * @example
   * const signature = service.generateSignature({ event: 'test', data: {...} });
   * // Resultado: "sha256=a1b2c3d4e5f6..."
   */
  generateSignature(payload: any, timestamp?: number): string {
    try {
      // Convertir payload a string JSON canónico
      const payloadString = typeof payload === 'string' 
        ? payload 
        : JSON.stringify(payload);

      // Incluir timestamp si se proporciona para prevenir replay attacks
      const dataToSign = timestamp 
        ? `${timestamp}.${payloadString}`
        : payloadString;

      // Generar HMAC usando SHA-256
      const hmac = crypto.createHmac(this.algorithm, this.webhookSecret);
      hmac.update(dataToSign);
      const signature = hmac.digest('hex');

      this.logger.debug(`Firma generada para payload de ${payloadString.length} bytes`);

      // Retornar en formato estándar: "sha256=signature"
      return `${this.algorithm}=${signature}`;
    } catch (error) {
      this.logger.error('Error generando firma HMAC:', error);
      throw new Error('No se pudo generar la firma HMAC');
    }
  }

  /**
   * Valida una firma HMAC-SHA256 contra un payload
   * 
   * @param payload - Datos originales (objeto o string)
   * @param receivedSignature - Firma recibida en formato "sha256=hexstring"
   * @param timestamp - Timestamp opcional para validar
   * @returns true si la firma es válida, false en caso contrario
   * 
   * @example
   * const isValid = service.validateSignature(
   *   payload, 
   *   'sha256=a1b2c3d4...',
   *   Date.now()
   * );
   */
  validateSignature(
    payload: any, 
    receivedSignature: string, 
    timestamp?: number
  ): boolean {
    try {
      // 1. Validar formato de la firma recibida
      if (!receivedSignature || !receivedSignature.includes('=')) {
        this.logger.warn('Firma recibida tiene formato inválido');
        return false;
      }

      // 2. Extraer algoritmo y firma
      const [algorithm, signature] = receivedSignature.split('=');
      
      if (algorithm !== this.algorithm) {
        this.logger.warn(`Algoritmo no soportado: ${algorithm}`);
        return false;
      }

      // 3. Validar timestamp si se proporciona (prevenir replay attacks)
      if (timestamp) {
        const now = Date.now();
        const drift = Math.abs(now - timestamp);
        
        if (drift > this.maxTimestampDrift) {
          this.logger.warn(
            `Timestamp fuera de rango válido: ${drift}ms (max: ${this.maxTimestampDrift}ms)`
          );
          return false;
        }
      }

      // 4. Generar firma esperada
      const expectedSignature = this.generateSignature(payload, timestamp);
      const [, expectedHash] = expectedSignature.split('=');

      // 5. Comparación segura contra timing attacks
      const isValid = this.timingSafeEqual(signature, expectedHash);

      if (!isValid) {
        this.logger.warn('Firma HMAC inválida');
      } else {
        this.logger.debug('Firma HMAC validada exitosamente');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error validando firma HMAC:', error);
      return false;
    }
  }

  /**
   * Valida firma usando header HTTP estándar
   * 
   * @param payload - Datos originales
   * @param signatureHeader - Header "X-Webhook-Signature"
   * @param timestampHeader - Header "X-Webhook-Timestamp" opcional
   * @returns true si la firma es válida
   * 
   * @example
   * const isValid = service.validateSignatureFromHeaders(
   *   req.body,
   *   req.headers['x-webhook-signature'],
   *   req.headers['x-webhook-timestamp']
   * );
   */
  validateSignatureFromHeaders(
    payload: any,
    signatureHeader: string,
    timestampHeader?: string
  ): boolean {
    const timestamp = timestampHeader ? parseInt(timestampHeader, 10) : undefined;
    return this.validateSignature(payload, signatureHeader, timestamp);
  }

  /**
   * Genera headers HTTP completos para un webhook
   * 
   * @param payload - Datos del webhook
   * @returns Objeto con headers necesarios
   * 
   * @example
   * const headers = service.generateWebhookHeaders(webhookPayload);
   * // {
   * //   'X-Webhook-Signature': 'sha256=abc123...',
   * //   'X-Webhook-Timestamp': '1734234567890',
   * //   'X-Webhook-Version': '1.0.0',
   * //   'Content-Type': 'application/json'
   * // }
   */
  generateWebhookHeaders(payload: any): Record<string, string> {
    const timestamp = Date.now();
    const signature = this.generateSignature(payload, timestamp);

    return {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp.toString(),
      'X-Webhook-Version': '1.0.0',
    };
  }

  /**
   * Comparación de strings segura contra timing attacks
   * Usa comparación de tiempo constante
   */
  private timingSafeEqual(a: string, b: string): boolean {
    try {
      // Normalizar longitudes para evitar timing attacks
      const bufferA = Buffer.from(a, 'utf-8');
      const bufferB = Buffer.from(b, 'utf-8');

      // Si las longitudes difieren, crear buffers del mismo tamaño
      if (bufferA.length !== bufferB.length) {
        // Crear buffer dummy para mantener comparación de tiempo constante
        const dummyBuffer = Buffer.alloc(bufferA.length);
        crypto.timingSafeEqual(bufferA, dummyBuffer);
        return false;
      }

      // Comparación segura de tiempo constante
      return crypto.timingSafeEqual(bufferA, bufferB);
    } catch (error) {
      this.logger.error('Error en comparación timing-safe:', error);
      return false;
    }
  }

  /**
   * Rota la clave secreta de forma segura
   * Permite validar con clave anterior durante período de transición
   * 
   * @param oldSecret - Clave anterior
   * @param newSecret - Clave nueva
   * @param payload - Payload a validar
   * @param signature - Firma a validar
   * @returns true si valida con cualquiera de las dos claves
   */
  validateWithKeyRotation(
    oldSecret: string,
    newSecret: string,
    payload: any,
    signature: string
  ): boolean {
    // Intentar validar con clave nueva
    const tempService = new HmacSignatureService();
    (tempService as any).webhookSecret = newSecret;
    
    if (tempService.validateSignature(payload, signature)) {
      this.logger.debug('Firma validada con clave nueva');
      return true;
    }

    // Intentar validar con clave anterior (fallback)
    (tempService as any).webhookSecret = oldSecret;
    
    if (tempService.validateSignature(payload, signature)) {
      this.logger.warn('Firma validada con clave antigua - considerar actualizar cliente');
      return true;
    }

    return false;
  }

  /**
   * Utilidad para verificar la configuración del servicio
   */
  healthCheck(): { status: string; algorithm: string; secretConfigured: boolean } {
    return {
      status: 'ok',
      algorithm: this.algorithm,
      secretConfigured: this.webhookSecret !== 'default-secret-key',
    };
  }
}
