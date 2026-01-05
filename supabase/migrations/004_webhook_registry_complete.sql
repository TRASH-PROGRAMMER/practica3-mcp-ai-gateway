-- ============================================
-- WEBHOOK REGISTRY - TABLAS COMPLETAS
-- ============================================
-- Completa el sistema de gestión de webhooks con control de idempotencia

-- ============================================
-- TABLA: processed_webhooks
-- ============================================
-- Control de idempotencia para evitar procesamiento duplicado

CREATE TABLE IF NOT EXISTS processed_webhooks (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    source VARCHAR(100), -- Sistema que generó el evento
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Fecha de expiración para limpieza
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar columnas si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_webhooks' AND column_name = 'event_type') THEN
        ALTER TABLE processed_webhooks ADD COLUMN event_type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_webhooks' AND column_name = 'source') THEN
        ALTER TABLE processed_webhooks ADD COLUMN source VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_webhooks' AND column_name = 'processed_at') THEN
        ALTER TABLE processed_webhooks ADD COLUMN processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_webhooks' AND column_name = 'expires_at') THEN
        ALTER TABLE processed_webhooks ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_webhooks' AND column_name = 'metadata') THEN
        ALTER TABLE processed_webhooks ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_webhooks' AND column_name = 'created_at') THEN
        ALTER TABLE processed_webhooks ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Índices para búsqueda rápida (crear solo si no existen)
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_webhooks_event_id 
    ON processed_webhooks(event_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_event_type 
    ON processed_webhooks(event_type);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_processed_at 
    ON processed_webhooks(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_expires_at 
    ON processed_webhooks(expires_at) 
    WHERE expires_at IS NOT NULL;

-- ============================================
-- MEJORAS A webhook_subscriptions
-- ============================================

-- Agregar campos adicionales para configuración avanzada
ALTER TABLE webhook_subscriptions 
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}'::jsonb, -- Headers personalizados
    ADD COLUMN IF NOT EXISTS timeout_ms INTEGER DEFAULT 30000, -- Timeout en ms
    ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
    ADD COLUMN IF NOT EXISTS backoff_multiplier DECIMAL(3,1) DEFAULT 2.0,
    ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Índice para última activación
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_last_triggered 
    ON webhook_subscriptions(last_triggered_at DESC NULLS LAST);

-- Índice para fallos
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_failure_count 
    ON webhook_subscriptions(failure_count) 
    WHERE failure_count > 0;

-- ============================================
-- MEJORAS A webhook_deliveries
-- ============================================

-- Agregar campos si no existen
ALTER TABLE webhook_deliveries
    ADD COLUMN IF NOT EXISTS headers_sent JSONB,
    ADD COLUMN IF NOT EXISTS headers_received JSONB,
    ADD COLUMN IF NOT EXISTS retry_scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS retry_attempt INTEGER DEFAULT 0;

-- Índice compuesto para reintentos pendientes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry_pending 
    ON webhook_deliveries(retry_scheduled_at, success) 
    WHERE retry_scheduled_at IS NOT NULL AND success = false;

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista: Estado de suscripciones (solo si las columnas existen)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_subscriptions' AND column_name = 'name'
    ) THEN
        EXECUTE '
        CREATE OR REPLACE VIEW webhook_subscriptions_status AS
        SELECT 
            s.id,
            s.name,
            s.endpoint_url,
            s.active,
            s.failure_count,
            s.last_triggered_at,
            s.disabled_at,
            s.disabled_reason,
            COUNT(d.id) as total_deliveries,
            SUM(CASE WHEN d.success THEN 1 ELSE 0 END) as successful_deliveries,
            SUM(CASE WHEN NOT d.success THEN 1 ELSE 0 END) as failed_deliveries,
            ROUND(
                AVG(CASE WHEN d.success THEN 1.0 ELSE 0.0 END) * 100, 2
            ) as success_rate_percent,
            MAX(d.delivered_at) as last_delivery_at
        FROM webhook_subscriptions s
        LEFT JOIN webhook_deliveries d ON s.id = d.subscription_id
        GROUP BY s.id, s.name, s.endpoint_url, s.active, s.failure_count, 
                 s.last_triggered_at, s.disabled_at, s.disabled_reason';
    END IF;
END $$;

-- Vista: Métricas de entregas por hora
CREATE OR REPLACE VIEW webhook_delivery_metrics AS
SELECT 
    DATE_TRUNC('hour', delivered_at) as hour,
    event_type,
    COUNT(*) as total_deliveries,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
    ROUND(AVG(response_time_ms), 2) as avg_response_time_ms,
    MAX(response_time_ms) as max_response_time_ms,
    ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate_percent
FROM webhook_deliveries
WHERE delivered_at > NOW() - INTERVAL '7 days'
  AND response_time_ms IS NOT NULL
GROUP BY DATE_TRUNC('hour', delivered_at), event_type
ORDER BY hour DESC;

-- Vista: Eventos procesados recientemente
CREATE OR REPLACE VIEW webhook_processed_recent AS
SELECT 
    pw.event_id,
    pw.event_type,
    pw.source,
    pw.processed_at,
    we.payload,
    COUNT(wd.id) as delivery_count,
    SUM(CASE WHEN wd.success THEN 1 ELSE 0 END) as successful_deliveries
FROM processed_webhooks pw
LEFT JOIN webhook_events we ON pw.event_id::TEXT = we.event_id::TEXT
LEFT JOIN webhook_deliveries wd ON pw.event_id::TEXT = wd.event_id::TEXT
WHERE pw.processed_at > NOW() - INTERVAL '24 hours'
GROUP BY pw.event_id, pw.event_type, pw.source, pw.processed_at, we.payload
ORDER BY pw.processed_at DESC;

-- ============================================
-- FUNCIONES ÚTILES
-- ============================================

-- Función: Verificar si un evento ya fue procesado
CREATE OR REPLACE FUNCTION is_webhook_processed(p_event_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM processed_webhooks 
        WHERE event_id = p_event_id
    );
END;
$$ LANGUAGE plpgsql;

-- Función: Marcar evento como procesado
CREATE OR REPLACE FUNCTION mark_webhook_processed(
    p_event_id VARCHAR,
    p_event_type VARCHAR,
    p_source VARCHAR DEFAULT NULL,
    p_ttl_days INTEGER DEFAULT 30
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO processed_webhooks (
        event_id, 
        event_type, 
        source,
        expires_at
    ) VALUES (
        p_event_id, 
        p_event_type, 
        p_source,
        NOW() + (p_ttl_days || ' days')::INTERVAL
    )
    ON CONFLICT (event_id) DO UPDATE SET
        processed_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Función: Limpiar webhooks procesados expirados
CREATE OR REPLACE FUNCTION cleanup_expired_processed_webhooks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM processed_webhooks
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Función: Deshabilitar suscripción con alta tasa de fallos
CREATE OR REPLACE FUNCTION auto_disable_failing_subscriptions(
    p_failure_threshold INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
    disabled_count INTEGER;
BEGIN
    UPDATE webhook_subscriptions
    SET 
        active = false,
        disabled_at = NOW(),
        disabled_reason = 'Auto-disabled: High failure rate (' || failure_count || ' failures)'
    WHERE 
        active = true 
        AND failure_count >= p_failure_threshold
        AND disabled_at IS NULL;
    
    GET DIAGNOSTICS disabled_count = ROW_COUNT;
    
    RETURN disabled_count;
END;
$$ LANGUAGE plpgsql;

-- Función: Obtener estadísticas de una suscripción
CREATE OR REPLACE FUNCTION get_subscription_stats(p_subscription_id BIGINT)
RETURNS TABLE (
    total_deliveries BIGINT,
    successful_deliveries BIGINT,
    failed_deliveries BIGINT,
    success_rate NUMERIC,
    avg_response_time NUMERIC,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_deliveries,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_deliveries,
        ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate,
        ROUND(AVG(response_time_ms), 2) as avg_response_time,
        MAX(CASE WHEN success THEN delivered_at END) as last_success_at,
        MAX(CASE WHEN NOT success THEN delivered_at END) as last_failure_at
    FROM webhook_deliveries
    WHERE subscription_id = p_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: Actualizar updated_at en webhook_subscriptions
CREATE OR REPLACE FUNCTION update_webhook_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_webhook_subscription_timestamp
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_subscription_timestamp();

-- Trigger: Incrementar failure_count en webhook_subscriptions
CREATE OR REPLACE FUNCTION increment_subscription_failure_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.success = false THEN
        UPDATE webhook_subscriptions
        SET failure_count = failure_count + 1
        WHERE id = NEW.subscription_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_subscription_failure_count
    AFTER INSERT ON webhook_deliveries
    FOR EACH ROW
    WHEN (NEW.success = false)
    EXECUTE FUNCTION increment_subscription_failure_count();

-- Trigger: Actualizar last_triggered_at en webhook_subscriptions
CREATE OR REPLACE FUNCTION update_subscription_last_triggered()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE webhook_subscriptions
    SET last_triggered_at = NOW()
    WHERE id = NEW.subscription_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_last_triggered
    AFTER INSERT ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_last_triggered();

-- ============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ============================================

-- Habilitar RLS en processed_webhooks
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si existen antes de crearlas
DROP POLICY IF EXISTS "Permitir lectura de webhooks procesados" ON processed_webhooks;
DROP POLICY IF EXISTS "Permitir inserción a service_role" ON processed_webhooks;

-- Política: Permitir lectura a usuarios autenticados
CREATE POLICY "Permitir lectura de webhooks procesados"
    ON processed_webhooks
    FOR SELECT
    TO authenticated
    USING (true);

-- Política: Permitir inserción solo a service_role
CREATE POLICY "Permitir inserción a service_role"
    ON processed_webhooks
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE processed_webhooks IS 'Control de idempotencia: registro de eventos ya procesados';
COMMENT ON COLUMN processed_webhooks.event_id IS 'ID único del evento (clave de idempotencia)';
COMMENT ON COLUMN processed_webhooks.expires_at IS 'Fecha de expiración para limpieza automática';
COMMENT ON COLUMN processed_webhooks.metadata IS 'Información adicional del procesamiento';

COMMENT ON FUNCTION is_webhook_processed(VARCHAR) IS 'Verifica si un evento ya fue procesado (true/false)';
COMMENT ON FUNCTION mark_webhook_processed(VARCHAR, VARCHAR, VARCHAR, INTEGER) IS 'Marca un evento como procesado con TTL configurable';
COMMENT ON FUNCTION cleanup_expired_processed_webhooks() IS 'Elimina registros de webhooks procesados que ya expiraron';
COMMENT ON FUNCTION auto_disable_failing_subscriptions(INTEGER) IS 'Deshabilita automáticamente suscripciones con alta tasa de fallos';
COMMENT ON FUNCTION get_subscription_stats(BIGINT) IS 'Retorna estadísticas completas de una suscripción';

-- ============================================
-- DATOS DE PRUEBA (opcional)
-- ============================================

-- Insertar ejemplos de webhooks procesados (solo si event_id es VARCHAR)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'processed_webhooks' 
        AND column_name = 'event_id' 
        AND data_type IN ('character varying', 'text')
    ) THEN
        INSERT INTO processed_webhooks (event_id, event_type, source, metadata) VALUES
            ('evt_example_001', 'pedido.creado', 'api-gateway', '{"version": "1.0"}'::jsonb),
            ('evt_example_002', 'comparacion.realizada', 'comparador-service', '{"productos": 3}'::jsonb)
        ON CONFLICT (event_id) DO NOTHING;
    END IF;
END $$;

-- ============================================
-- CONSULTAS ÚTILES
-- ============================================

-- Verificar idempotencia de un evento
-- SELECT is_webhook_processed('evt_12345');

-- Marcar evento como procesado (TTL 30 días)
-- SELECT mark_webhook_processed('evt_12345', 'pedido.creado', 'api-gateway', 30);

-- Limpiar webhooks expirados
-- SELECT cleanup_expired_processed_webhooks();

-- Estadísticas de una suscripción
-- SELECT * FROM get_subscription_stats(1);

-- Estado de todas las suscripciones
-- SELECT * FROM webhook_subscriptions_status ORDER BY success_rate_percent DESC;

-- Métricas por hora
-- SELECT * FROM webhook_delivery_metrics ORDER BY hour DESC LIMIT 24;

-- Eventos procesados recientes
-- SELECT * FROM webhook_processed_recent LIMIT 50;

-- Deshabilitar suscripciones con >10 fallos
-- SELECT auto_disable_failing_subscriptions(10);
