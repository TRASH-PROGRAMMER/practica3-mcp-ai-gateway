-- Actualización de tabla webhook_deliveries para registrar todos los intentos
-- Esta migración agrega campos adicionales necesarios

-- Agregar columnas si no existen
ALTER TABLE webhook_deliveries 
  ADD COLUMN IF NOT EXISTS endpoint_url TEXT,
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_body JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Renombrar columna response a response_body si existe y response_body no existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_deliveries' AND column_name = 'response'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_deliveries' AND column_name = 'response_body'
  ) THEN
    ALTER TABLE webhook_deliveries RENAME COLUMN response TO response_body;
  END IF;
END $$;

-- Renombrar columna error a error_message si existe y error_message no existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_deliveries' AND column_name = 'error'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_deliveries' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE webhook_deliveries RENAME COLUMN error TO error_message;
  END IF;
END $$;

-- Crear índices adicionales para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_attempt_number ON webhook_deliveries(attempt_number);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);

-- Comentarios
COMMENT ON COLUMN webhook_deliveries.endpoint_url IS 'URL destino del webhook';
COMMENT ON COLUMN webhook_deliveries.http_status IS 'Código de estado HTTP de la respuesta';
COMMENT ON COLUMN webhook_deliveries.attempt_number IS 'Número de intento (1, 2, 3, etc.)';
COMMENT ON COLUMN webhook_deliveries.response_time_ms IS 'Tiempo de respuesta en milisegundos';
COMMENT ON COLUMN webhook_deliveries.error_message IS 'Mensaje de error si el intento falló';
COMMENT ON COLUMN webhook_deliveries.request_payload IS 'Payload del request enviado';
COMMENT ON COLUMN webhook_deliveries.response_body IS 'Cuerpo de la respuesta recibida';
