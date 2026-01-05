/**
 * Función Serverless: Webhook Event Logger
 * 
 * Procesa y registra eventos de webhooks de forma escalable
 * con validación de seguridad HMAC y protección anti-replay.
 * 
 * Características:
 * - Validación HMAC-SHA256 obligatoria
 * - Protección anti-replay con timestamp
 * - Detección de eventos duplicados
 * - Registro en Supabase con análisis
 * - Procesamiento sin gestión de servidores
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function validateHmacSignature(
  payload: string,
  receivedSignature: string,
  timestamp: number,
  secret: string
): Promise<boolean> {
  // Validar formato
  if (!receivedSignature?.includes("=")) return false;

  // Validar timestamp (máximo 5 minutos de diferencia)
  const now = Date.now();
  const maxDrift = 5 * 60 * 1000; // 5 minutos
  if (Math.abs(now - timestamp) > maxDrift) {
    console.warn(`❌ Timestamp fuera de rango: ${Math.abs(now - timestamp)}ms`);
    return false;
  }

  // Generar firma esperada
  const expectedSignature = await generateHmacSignature(payload, timestamp, secret);
  
  // Comparación timing-safe
  return receivedSignature === expectedSignature;
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req) => {
  console.log(`📥 Nueva solicitud: ${req.method} ${req.url}`);

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp, x-event-id",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // 1. EXTRAER HEADERS Y PAYLOAD
    const signature = req.headers.get("x-webhook-signature");
    const timestampHeader = req.headers.get("x-webhook-timestamp");
    const eventId = req.headers.get("x-event-id");
    
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    console.log(`🔍 Validando evento: ${eventId}`);

    // 2. VALIDAR HEADERS REQUERIDOS
    if (!signature || !timestampHeader) {
      console.warn("❌ Headers de seguridad faltantes");
      return new Response(
        JSON.stringify({
          error: "Missing security headers",
          required: ["x-webhook-signature", "x-webhook-timestamp"],
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 3. VALIDAR FIRMA HMAC
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("❌ WEBHOOK_SECRET no configurado");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const timestamp = parseInt(timestampHeader, 10);
    const isValidSignature = await validateHmacSignature(
      rawBody,
      signature,
      timestamp,
      webhookSecret
    );

    if (!isValidSignature) {
      console.warn("❌ Firma HMAC inválida");
      return new Response(
        JSON.stringify({ error: "Invalid HMAC signature" }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log("✅ Firma HMAC válida");

    // 4. CONECTAR A SUPABASE
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. VERIFICAR DUPLICADOS (idempotencia)
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("event_id", payload.event_id)
      .single();

    if (existing) {
      console.warn(`⚠️  Evento duplicado ignorado: ${payload.event_id}`);
      return new Response(
        JSON.stringify({
          status: "duplicate",
          message: "Event already processed",
          event_id: payload.event_id,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 6. REGISTRAR EVENTO
    const { data: logged, error: logError } = await supabase
      .from("webhook_events")
      .insert({
        event_id: payload.event_id,
        event_type: payload.event_type,
        payload: payload,
        signature: signature,
        timestamp: new Date(timestamp).toISOString(),
        processed_at: new Date().toISOString(),
        status: "processed",
      })
      .select()
      .single();

    if (logError) throw logError;

    console.log(`✅ Evento registrado: ${logged.id}`);

    // 7. ANÁLISIS Y MÉTRICAS
    await supabase.from("webhook_metrics").insert({
      event_type: payload.event_type,
      processing_time_ms: Date.now() - timestamp,
      success: true,
      timestamp: new Date().toISOString(),
    });

    // 8. RESPUESTA EXITOSA
    return new Response(
      JSON.stringify({
        status: "success",
        message: "Event logged successfully",
        event_id: payload.event_id,
        logged_id: logged.id,
        processed_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Error procesando webhook:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/webhook-event-logger' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
