/**
 * Función Serverless: External Webhook Notifier
 * 
 * Procesa eventos y notifica a sistemas externos de forma escalable.
 * Envía webhooks con firma HMAC a URLs configuradas.
 * 
 * Características:
 * - Validación HMAC entrante
 * - Generación HMAC para webhooks salientes
 * - Reintentos automáticos con backoff exponencial
 * - Registro de entrega y fallos
 * - Procesamiento asíncrono escalable
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CONFIGURACIÓN
// ============================================

interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
  retry_config: {
    max_attempts: number;
    delays_ms: number[];
  };
}

const DEFAULT_RETRY_CONFIG = {
  max_attempts: 3,
  delays_ms: [5000, 15000, 60000], // 5s, 15s, 1min
};

// ============================================
// UTILIDADES HMAC
// ============================================

async function generateHmacSignature(
  payload: string,
  timestamp: number,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const dataToSign = `${timestamp}.${payload}`;
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(dataToSign);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${hexSignature}`;
}

async function validateIncomingHmac(
  payload: string,
  signature: string,
  timestamp: number,
  secret: string
): Promise<boolean> {
  if (!signature?.includes("=")) return false;

  const now = Date.now();
  const maxDrift = 5 * 60 * 1000;
  if (Math.abs(now - timestamp) > maxDrift) return false;

  const expectedSignature = await generateHmacSignature(payload, timestamp, secret);
  return signature === expectedSignature;
}

// ============================================
// NOTIFICACIONES TELEGRAM
// ============================================

async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error Telegram: ${error}`);
      return false;
    }

    console.log("✅ Notificación Telegram enviada");
    return true;
  } catch (error) {
    console.error("❌ Fallo enviando a Telegram:", error);
    return false;
  }
}

function formatTelegramMessage(
  eventType: string,
  eventId: string,
  totalSubscribers: number,
  successCount: number
): string {
  const emoji = successCount === totalSubscribers ? "✅" : 
                successCount > 0 ? "⚠️" : "❌";
  
  return `${emoji} *Webhook Entregado*

📋 *Evento:* \`${eventType}\`
🆔 *ID:* \`${eventId}\`
📤 *Suscriptores:* ${totalSubscribers}
✅ *Exitosos:* ${successCount}
❌ *Fallidos:* ${totalSubscribers - successCount}

🕐 *Hora:* ${new Date().toLocaleString('es-ES', { timeZone: 'America/La_Paz' })}`;
}

// ============================================
// ENVÍO DE WEBHOOKS
// ============================================

async function sendWebhookWithRetry(
  config: WebhookConfig,
  payload: any,
  attempt: number = 1
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    const timestamp = Date.now();
    const payloadString = JSON.stringify(payload);
    const signature = await generateHmacSignature(
      payloadString,
      timestamp,
      config.secret
    );

    console.log(`📤 Enviando a ${config.url} (intento ${attempt}/${config.retry_config.max_attempts})`);

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": timestamp.toString(),
        "X-Event-ID": payload.event_id,
        "X-Webhook-Version": "1.0.0",
        "User-Agent": "Supabase-Webhook-Notifier/1.0",
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log(`✅ Webhook entregado exitosamente`);

    return {
      success: true,
      response: responseData,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Fallo en intento ${attempt}: ${errorMessage}`);

    // Reintentar si no se alcanzó el máximo
    if (attempt < config.retry_config.max_attempts) {
      const delay = config.retry_config.delays_ms[attempt - 1] || 5000;
      console.log(`⏳ Reintentando en ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhookWithRetry(config, payload, attempt + 1);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req) => {
  console.log(`📥 Nueva solicitud: ${req.method} ${req.url}`);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp, x-event-id",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // 1. VALIDAR WEBHOOK ENTRANTE
    const signature = req.headers.get("x-webhook-signature");
    const timestampHeader = req.headers.get("x-webhook-timestamp");
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    if (!signature || !timestampHeader) {
      return new Response(
        JSON.stringify({ error: "Missing security headers" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const incomingSecret = Deno.env.get("WEBHOOK_SECRET");
    if (!incomingSecret) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const timestamp = parseInt(timestampHeader, 10);
    const isValid = await validateIncomingHmac(
      rawBody,
      signature,
      timestamp,
      incomingSecret
    );

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid HMAC signature" }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log("✅ Webhook entrante validado");

    // 2. CONECTAR A SUPABASE
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. VERIFICAR IDEMPOTENCIA (evitar reenvíos duplicados)
    const { data: existingDeliveries } = await supabase
      .from("webhook_deliveries")
      .select("id, success, subscription_id")
      .eq("event_id", payload.event_id);

    if (existingDeliveries && existingDeliveries.length > 0) {
      const successfulCount = existingDeliveries.filter(d => d.success).length;
      console.warn(`⚠️  Evento ya procesado: ${payload.event_id} (${successfulCount} entregas exitosas previas)`);
      
      return new Response(
        JSON.stringify({
          status: "duplicate",
          message: "Event already processed",
          event_id: payload.event_id,
          previous_deliveries: existingDeliveries.length,
          successful_deliveries: successfulCount,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 4. OBTENER CONFIGURACIONES DE WEBHOOKS
    const { data: configs, error: configError } = await supabase
      .from("webhook_subscriptions")
      .select("*")
      .eq("active", true)
      .contains("events", [payload.event_type]);

    if (configError) throw configError;

    if (!configs || configs.length === 0) {
      console.log(`ℹ️  No hay suscriptores para ${payload.event_type}`);
      return new Response(
        JSON.stringify({
          status: "success",
          message: "No subscribers for this event type",
          event_type: payload.event_type,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`📨 Enviando a ${configs.length} suscriptor(es)`);

    // 5. ENVIAR A TODOS LOS SUSCRIPTORES
    const deliveryResults = await Promise.allSettled(
      configs.map(async (config) => {
        const webhookConfig: WebhookConfig = {
          url: config.endpoint_url,
          secret: config.secret,
          events: config.events,
          retry_config: config.retry_config || DEFAULT_RETRY_CONFIG,
        };

        const result = await sendWebhookWithRetry(webhookConfig, payload);

        // Registrar entrega
        await supabase.from("webhook_deliveries").insert({
          subscription_id: config.id,
          event_id: payload.event_id,
          event_type: payload.event_type,
          success: result.success,
          response: result.response,
          error: result.error,
          delivered_at: new Date().toISOString(),
        });

        return { config_id: config.id, ...result };
      })
    );

    const successCount = deliveryResults.filter(
      r => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(`✅ ${successCount}/${configs.length} entregas exitosas`);

    // 6. ENVIAR NOTIFICACIÓN A TELEGRAM
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

    let telegramNotified = false;
    let telegramError = null;

    if (telegramBotToken && telegramChatId) {
      const telegramMessage = formatTelegramMessage(
        payload.event_type,
        payload.event_id,
        configs.length,
        successCount
      );

      telegramNotified = await sendTelegramNotification(
        telegramBotToken,
        telegramChatId,
        telegramMessage
      );

      if (!telegramNotified) {
        telegramError = "Failed to send Telegram notification";
      }

      // Registrar resultado de notificación en webhook_notifications
      await supabase.from("webhook_notifications").insert({
        event_id: payload.event_id,
        event_type: payload.event_type,
        notification_type: "telegram",
        success: telegramNotified,
        error: telegramError,
        metadata: {
          total_subscribers: configs.length,
          successful_deliveries: successCount,
          chat_id: telegramChatId,
        },
        sent_at: new Date().toISOString(),
      });

    } else {
      console.log("ℹ️  Telegram no configurado, omitiendo notificación");
    }

    // 7. RESPUESTA
    return new Response(
      JSON.stringify({
        status: "success",
        message: "Webhooks processed",
        event_id: payload.event_id,
        total_subscribers: configs.length,
        successful_deliveries: successCount,
        telegram_notified: telegramNotified,
        processed_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Error procesando notificaciones:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/webhook-external-notifier' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
