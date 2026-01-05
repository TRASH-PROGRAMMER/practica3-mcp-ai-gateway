import { Controller, Get, Post, Body } from '@nestjs/common';
import { TelegramNotificationService } from './telegram-notification.service';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramNotificationService,
  ) {}

  /**
   * Verifica si Telegram está configurado
   */
  @Get('status')
  getStatus() {
    return {
      enabled: this.telegramService.isEnabled(),
      message: this.telegramService.isEnabled()
        ? 'Telegram configurado correctamente'
        : 'Telegram no configurado - Verifica TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID',
    };
  }

  /**
   * Envía un mensaje de prueba
   */
  @Post('test')
  async sendTest() {
    const sent = await this.telegramService.sendTestMessage();
    return {
      success: sent,
      message: sent
        ? '✅ Mensaje de prueba enviado a Telegram'
        : '❌ No se pudo enviar el mensaje. Verifica la configuración.',
    };
  }

  /**
   * Envía un mensaje personalizado
   */
  @Post('send')
  async sendCustomMessage(@Body() body: any) {
    // Debug logs
    console.log('🔍 Body recibido:', body);
    console.log('🔍 Tipo de body:', typeof body);
    console.log('🔍 Body es objeto?:', body && typeof body === 'object');
    console.log('🔍 Keys del body:', body ? Object.keys(body) : 'body es null/undefined');
    
    const message = body?.message;
    
    if (!message || typeof message !== 'string') {
      return {
        success: false,
        message: 'El campo "message" es requerido y debe ser un string',
      };
    }

    const sent = await this.telegramService.sendMessage(message);
    return {
      success: sent,
      message: sent
        ? '✅ Mensaje enviado a Telegram'
        : '❌ No se pudo enviar el mensaje',
    };
  }

  /**
   * Obtiene información del bot
   */
  @Get('bot-info')
  async getBotInfo() {
    return await this.telegramService.getBotInfo();
  }

  /**
   * Simula notificación de prescripción
   */
  @Post('test/prescripcion')
  async testPrescripcion() {
    const sent = await this.telegramService.notifyPrescripcionRegistrada({
      id_prescripcion: 123,
      nombre_paciente: 'Juan Pérez',
      nombre_medico: 'Dra. López',
      total_medicamentos: 3,
    });

    return {
      success: sent,
      message: sent
        ? '✅ Notificación de prescripción enviada'
        : '❌ No se pudo enviar la notificación',
    };
  }

  /**
   * Simula notificación de comparación
   */
  @Post('test/comparacion')
  async testComparacion() {
    const sent = await this.telegramService.notifyComparacionRealizada({
      id_producto: 1,
      nombre_producto: 'Aspirina 500mg',
      precio_min: 95.0,
      precio_max: 105.0,
      ahorro_potencial: 10.0,
      total_farmacias: 3,
    });

    return {
      success: sent,
      message: sent
        ? '✅ Notificación de comparación enviada'
        : '❌ No se pudo enviar la notificación',
    };
  }

  /**
   * Simula notificación de error
   */
  @Post('test/error')
  async testError() {
    const sent = await this.telegramService.notifyError({
      servicio: 'Comparador Service',
      error: 'Error de prueba',
      detalles: 'Este es un mensaje de prueba para verificar notificaciones de error',
    });

    return {
      success: sent,
      message: sent
        ? '✅ Notificación de error enviada'
        : '❌ No se pudo enviar la notificación',
    };
  }
}
