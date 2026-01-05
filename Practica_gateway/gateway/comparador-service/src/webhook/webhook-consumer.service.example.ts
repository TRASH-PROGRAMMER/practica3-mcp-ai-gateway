import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Ejemplo de Consumidor de Webhook
 * 
 * Este servicio demuestra cómo consumir webhooks del sistema de eventos
 * implementando validación de firma, idempotencia y manejo de errores.
 */
@Injectable()
export class WebhookConsumerService {
  private readonly logger = new Logger(WebhookConsumerService.name);
  private readonly processedEvents = new Set<string>(); // Cache simple para idempotencia
  private readonly webhookSecret = process.env.WEBHOOK_SECRET || 'secret-key';

  /**
   * Valida la firma HMAC-SHA256 del webhook
   */
  validateSignature(payload: any, receivedSignature: string): boolean {
    try {
      const { signature, ...dataWithoutSignature } = payload;
      const payloadString = JSON.stringify(dataWithoutSignature);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      // Comparación segura contra timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(receivedSignature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Error validando firma:', error);
      return false;
    }
  }

  /**
   * Verifica si el evento ya fue procesado (idempotencia)
   */
  isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Marca un evento como procesado
   */
  markEventAsProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    
    // En producción, usar Redis o base de datos con TTL de 7 días
    // await redis.setex(`webhook:processed:${eventId}`, 604800, '1');
  }

  /**
   * Procesa webhook de prescripción registrada
   */
  async handlePrescripcionRegistrada(payload: any): Promise<void> {
    const { event_id, data } = payload;

    // 1. Verificar idempotencia
    if (this.isEventProcessed(event_id)) {
      this.logger.warn(`Evento duplicado ignorado: ${event_id}`);
      return;
    }

    try {
      this.logger.log(`Procesando prescripcion.registrada: ${event_id}`);

      // 2. Lógica de negocio específica
      
      // Ejemplo: Enviar notificación al paciente
      await this.sendNotificationToPaciente(
        data.nombre_paciente,
        data.nombre_medico,
        data.medicamentos.length
      );

      // Ejemplo: Reservar stock en inventario
      for (const med of data.medicamentos) {
        await this.reserveStock(
          med.id_producto,
          this.calculateQuantity(med.dosis, med.frecuencia, med.duracion_dias),
          data.id_prescripcion
        );
      }

      // Ejemplo: Registrar para auditoría
      await this.auditLog(payload);

      // 3. Marcar como procesado
      this.markEventAsProcessed(event_id);

      this.logger.log(`Evento procesado exitosamente: ${event_id}`);
    } catch (error) {
      this.logger.error(`Error procesando evento ${event_id}:`, error);
      throw error; // Re-lanzar para que el emisor reintente
    }
  }

  /**
   * Procesa webhook de comparación realizada
   */
  async handleComparacionRealizada(payload: any): Promise<void> {
    const { event_id, data } = payload;

    // 1. Verificar idempotencia
    if (this.isEventProcessed(event_id)) {
      this.logger.warn(`Evento duplicado ignorado: ${event_id}`);
      return;
    }

    try {
      this.logger.log(`Procesando comparacion.realizada: ${event_id}`);

      // 2. Lógica de negocio específica

      // Ejemplo: Actualizar analytics
      await this.updateProductSearchStats(
        data.id_producto,
        data.nombre_producto
      );

      // Ejemplo: Enviar alerta si el ahorro es significativo
      if (data.ahorro_potencial > 30 && data.id_usuario) {
        await this.sendSavingsAlert(
          data.id_usuario,
          data.nombre_producto,
          data.ahorro_potencial,
          data.precio_min
        );
      }

      // Ejemplo: Actualizar dashboard de reportes
      await this.updateReportsDashboard({
        producto: data.nombre_producto,
        ahorro: data.ahorro_potencial,
        fecha: data.fecha_comparacion
      });

      // 3. Marcar como procesado
      this.markEventAsProcessed(event_id);

      this.logger.log(`Evento procesado exitosamente: ${event_id}`);
    } catch (error) {
      this.logger.error(`Error procesando evento ${event_id}:`, error);
      throw error;
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private async sendNotificationToPaciente(
    nombrePaciente: string,
    nombreMedico: string,
    cantidadMedicamentos: number
  ): Promise<void> {
    this.logger.log(`📧 Enviando notificación a ${nombrePaciente}`);
    
    // Aquí iría la lógica real de envío (SMS, Email, Push)
    // await smsService.send({
    //   to: paciente.telefono,
    //   message: `El Dr. ${nombreMedico} ha registrado una prescripción...`
    // });
  }

  private async reserveStock(
    idProducto: number,
    quantity: number,
    idPrescripcion: number
  ): Promise<void> {
    this.logger.log(`📦 Reservando stock: Producto ${idProducto}, Cantidad ${quantity}`);
    
    // Aquí iría la lógica real de reserva de inventario
    // await inventoryService.reserve({
    //   productId: idProducto,
    //   quantity,
    //   prescriptionId: idPrescripcion
    // });
  }

  private calculateQuantity(dosis: string, frecuencia: string, duracionDias: number): number {
    // Lógica simplificada para calcular cantidad total
    // En producción, esto sería más complejo
    const dosisPerDay = this.extractDosisPerDay(frecuencia);
    return dosisPerDay * duracionDias;
  }

  private extractDosisPerDay(frecuencia: string): number {
    // Parsear frecuencia (ej: "cada 12 horas" = 2/día, "3 veces al día" = 3/día)
    if (frecuencia.includes('12 horas')) return 2;
    if (frecuencia.includes('8 horas')) return 3;
    if (frecuencia.includes('24 horas')) return 1;
    if (frecuencia.includes('3 veces')) return 3;
    return 1; // Default
  }

  private async auditLog(payload: any): Promise<void> {
    this.logger.log(`📝 Registrando evento en auditoría: ${payload.event_id}`);
    
    // Aquí iría el registro en sistema de auditoría
    // await auditService.log({
    //   eventType: payload.event_type,
    //   eventId: payload.event_id,
    //   timestamp: payload.timestamp,
    //   data: payload.data
    // });
  }

  private async updateProductSearchStats(
    idProducto: number,
    nombreProducto: string
  ): Promise<void> {
    this.logger.log(`📊 Actualizando estadísticas de búsqueda: ${nombreProducto}`);
    
    // Aquí iría la lógica de analytics
    // await analyticsService.increment('product_searches', {
    //   productId: idProducto,
    //   productName: nombreProducto
    // });
  }

  private async sendSavingsAlert(
    userId: number,
    producto: string,
    ahorro: number,
    precioMin: number
  ): Promise<void> {
    this.logger.log(`💰 Enviando alerta de ahorro a usuario ${userId}`);
    
    // Aquí iría la lógica de notificación
    // await notificationService.sendPush({
    //   userId,
    //   title: '¡Ahorro Disponible!',
    //   message: `Ahorra $${ahorro} en ${producto}. Precio mínimo: $${precioMin}`
    // });
  }

  private async updateReportsDashboard(data: any): Promise<void> {
    this.logger.log(`📈 Actualizando dashboard de reportes`);
    
    // Aquí iría la lógica de actualización de dashboard
    // await dashboardService.update('savings', data);
  }
}
