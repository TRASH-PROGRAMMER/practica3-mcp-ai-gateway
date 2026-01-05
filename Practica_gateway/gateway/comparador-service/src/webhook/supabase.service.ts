import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para operaciones de base de datos
 * Wrapper para facilitar acceso a las tablas de webhooks
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('Supabase no configurado - Variables SUPABASE_URL o SUPABASE_ANON_KEY faltantes');
      this.logger.warn('Los intentos de entrega no se guardarán en base de datos');
      // Crear cliente dummy para evitar errores
      this.supabase = null as any;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Verifica si Supabase está configurado correctamente
   */
  isConfigured(): boolean {
    return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  }

  /**
   * Obtiene el cliente de Supabase
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Inserta un registro de entrega de webhook
   */
  async insertDelivery(delivery: {
    subscription_id: number;
    event_id: string;
    event_type: string;
    endpoint_url: string;
    http_status?: number;
    success: boolean;
    attempt_number: number;
    response_time_ms: number;
    error_message?: string;
    request_payload: any;
    response_body?: any;
  }) {
    if (!this.isConfigured()) {
      this.logger.debug('Supabase no configurado, omitiendo inserción');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('webhook_deliveries')
        .insert([delivery])
        .select()
        .single();

      if (error) {
        this.logger.error('Error al insertar delivery en Supabase', error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error en insertDelivery', error);
      throw error;
    }
  }

  /**
   * Obtiene entregas recientes
   */
  async getRecentDeliveries(limit: number = 50) {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('webhook_deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Error al obtener deliveries recientes', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error en getRecentDeliveries', error);
      return [];
    }
  }

  /**
   * Obtiene entregas por subscription ID
   */
  async getDeliveriesBySubscription(subscriptionId: number, limit: number = 50) {
    try {
      const { data, error } = await this.supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Error al obtener deliveries por subscription', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error en getDeliveriesBySubscription', error);
      return [];
    }
  }

  /**
   * Obtiene entregas por event ID
   */
  async getDeliveriesByEvent(eventId: string) {
    try {
      const { data, error } = await this.supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Error al obtener deliveries por event', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error en getDeliveriesByEvent', error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas de entregas por subscription
   */
  async getDeliveryStatsBySubscription(subscriptionId: number) {
    try {
      // Obtener conteo total
      const { count: totalCount } = await this.supabase
        .from('webhook_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_id', subscriptionId);

      // Obtener conteo exitoso
      const { count: successCount } = await this.supabase
        .from('webhook_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_id', subscriptionId)
        .eq('success', true);

      // Obtener promedio de response time
      const { data: avgData } = await this.supabase
        .from('webhook_deliveries')
        .select('response_time_ms')
        .eq('subscription_id', subscriptionId)
        .eq('success', true);

      const avgResponseTime = avgData && avgData.length > 0
        ? avgData.reduce((sum, d) => sum + d.response_time_ms, 0) / avgData.length
        : 0;

      return {
        totalDeliveries: totalCount || 0,
        successfulDeliveries: successCount || 0,
        failedDeliveries: (totalCount || 0) - (successCount || 0),
        successRate: totalCount ? (successCount || 0) / totalCount : 0,
        avgResponseTime: Math.round(avgResponseTime),
      };
    } catch (error) {
      this.logger.error('Error en getDeliveryStatsBySubscription', error);
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Obtiene estadísticas globales
   */
  async getGlobalDeliveryStats() {
    try {
      const { count: totalCount } = await this.supabase
        .from('webhook_deliveries')
        .select('*', { count: 'exact', head: true });

      const { count: successCount } = await this.supabase
        .from('webhook_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('success', true);

      const { data: avgData } = await this.supabase
        .from('webhook_deliveries')
        .select('response_time_ms')
        .eq('success', true);

      const avgResponseTime = avgData && avgData.length > 0
        ? avgData.reduce((sum, d) => sum + d.response_time_ms, 0) / avgData.length
        : 0;

      return {
        totalDeliveries: totalCount || 0,
        successfulDeliveries: successCount || 0,
        failedDeliveries: (totalCount || 0) - (successCount || 0),
        successRate: totalCount ? (successCount || 0) / totalCount : 0,
        avgResponseTime: Math.round(avgResponseTime),
      };
    } catch (error) {
      this.logger.error('Error en getGlobalDeliveryStats', error);
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Obtiene suscripciones desde la base de datos
   */
  async getSubscriptions() {
    try {
      const { data, error } = await this.supabase
        .from('webhook_subscriptions')
        .select('*')
        .eq('active', true);

      if (error) {
        this.logger.error('Error al obtener subscriptions', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error en getSubscriptions', error);
      return [];
    }
  }

  /**
   * Inserta una suscripción
   */
  async insertSubscription(subscription: {
    name: string;
    endpoint_url: string;
    secret: string;
    events: string[];
    active?: boolean;
    retry_config?: any;
  }) {
    try {
      const { data, error } = await this.supabase
        .from('webhook_subscriptions')
        .insert([{ ...subscription, active: subscription.active !== false }])
        .select()
        .single();

      if (error) {
        this.logger.error('Error al insertar subscription', error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error en insertSubscription', error);
      throw error;
    }
  }

  /**
   * Actualiza una suscripción
   */
  async updateSubscription(id: number, updates: Partial<{
    name: string;
    endpoint_url: string;
    secret: string;
    events: string[];
    active: boolean;
    retry_config: any;
  }>) {
    try {
      const { data, error } = await this.supabase
        .from('webhook_subscriptions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error('Error al actualizar subscription', error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error en updateSubscription', error);
      throw error;
    }
  }

  /**
   * Elimina una suscripción
   */
  async deleteSubscription(id: number) {
    try {
      const { error } = await this.supabase
        .from('webhook_subscriptions')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error('Error al eliminar subscription', error);
        throw error;
      }

      return true;
    } catch (error) {
      this.logger.error('Error en deleteSubscription', error);
      throw error;
    }
  }
}
