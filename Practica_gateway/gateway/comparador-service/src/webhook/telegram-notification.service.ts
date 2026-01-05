import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Servicio de Notificaciones de Telegram
 * 
 * Envía notificaciones a Telegram cuando ocurren eventos importantes
 * en el sistema (prescripciones, comparaciones, errores, etc.)
 */
@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly enabled: boolean;

  constructor(private readonly http: HttpService) {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.enabled = !!(this.botToken && this.chatId);

    if (!this.enabled) {
      this.logger.warn('⚠️  Telegram no configurado - Variables TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID faltantes');
    } else {
      this.logger.log('✅ Servicio de Telegram inicializado correctamente');
    }
  }

  /**
   * Verifica si Telegram está configurado
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Envía un mensaje simple a Telegram
   */
  async sendMessage(message: string): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug('Telegram deshabilitado, omitiendo mensaje');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      const response = await firstValueFrom(
        this.http.post(url, {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
        })
      );

      if (response.data.ok) {
        this.logger.debug('✅ Mensaje enviado a Telegram');
        return true;
      } else {
        this.logger.error('❌ Error en respuesta de Telegram', response.data);
        return false;
      }
    } catch (error) {
      this.logger.error('❌ Error enviando mensaje a Telegram', error);
      return false;
    }
  }

  /**
   * Notifica cuando se registra una prescripción
   */
  async notifyPrescripcionRegistrada(data: {
    id_prescripcion: number;
    nombre_paciente: string;
    nombre_medico: string;
    total_medicamentos: number;
  }): Promise<boolean> {
    const message = `
🏥 <b>Nueva Prescripción Registrada</b>

📋 ID: <code>${data.id_prescripcion}</code>
👤 Paciente: ${data.nombre_paciente}
👨‍⚕️ Médico: ${data.nombre_medico}
💊 Medicamentos: ${data.total_medicamentos}

📅 ${new Date().toLocaleString('es-MX')}
    `.trim();

    return this.sendMessage(message);
  }

  /**
   * Notifica cuando se realiza una comparación de precios
   */
  async notifyComparacionRealizada(data: {
    id_producto: number;
    nombre_producto: string;
    precio_min: number;
    precio_max: number;
    ahorro_potencial: number;
    total_farmacias: number;
  }): Promise<boolean> {
    const message = `
💰 <b>Comparación de Precios Realizada</b>

💊 Producto: ${data.nombre_producto}
💵 Precio Mínimo: $${data.precio_min.toFixed(2)}
💵 Precio Máximo: $${data.precio_max.toFixed(2)}
💸 Ahorro Potencial: $${data.ahorro_potencial.toFixed(2)}
🏪 Farmacias consultadas: ${data.total_farmacias}

📅 ${new Date().toLocaleString('es-MX')}
    `.trim();

    return this.sendMessage(message);
  }

  /**
   * Notifica un error del sistema
   */
  async notifyError(data: {
    servicio: string;
    error: string;
    detalles?: string;
  }): Promise<boolean> {
    const message = `
❌ <b>Error en el Sistema</b>

⚙️ Servicio: ${data.servicio}
🔴 Error: ${data.error}
${data.detalles ? `📝 Detalles: ${data.detalles}` : ''}

📅 ${new Date().toLocaleString('es-MX')}
    `.trim();

    return this.sendMessage(message);
  }

  /**
   * Notifica webhook enviado
   */
  async notifyWebhookSent(data: {
    evento: string;
    url: string;
    exitoso: boolean;
    tiempo_respuesta?: number;
  }): Promise<boolean> {
    const emoji = data.exitoso ? '✅' : '❌';
    const status = data.exitoso ? 'Exitoso' : 'Fallido';

    const message = `
${emoji} <b>Webhook Enviado</b>

📡 Evento: ${data.evento}
🌐 URL: <code>${data.url}</code>
📊 Estado: ${status}
${data.tiempo_respuesta ? `⏱️ Tiempo: ${data.tiempo_respuesta}ms` : ''}

📅 ${new Date().toLocaleString('es-MX')}
    `.trim();

    return this.sendMessage(message);
  }

  /**
   * Envía un mensaje de prueba
   */
  async sendTestMessage(): Promise<boolean> {
    const message = `
🧪 <b>Mensaje de Prueba</b>

✅ El bot de Telegram está funcionando correctamente
🤖 Sistema de Notificaciones Activo

📅 ${new Date().toLocaleString('es-MX')}
    `.trim();

    return this.sendMessage(message);
  }

  /**
   * Obtiene información del bot
   */
  async getBotInfo(): Promise<any> {
    if (!this.enabled) {
      return { error: 'Telegram no configurado' };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/getMe`;
      const response = await firstValueFrom(this.http.get(url));
      return response.data;
    } catch (error) {
      this.logger.error('Error obteniendo info del bot', error);
      return { error: 'Error al obtener información del bot' };
    }
  }
}
