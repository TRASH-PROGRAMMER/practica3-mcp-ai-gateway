-- ============================================
-- TABLAS PARA SISTEMA DE WEBHOOKS ESCALABLE
-- ============================================

-- Tabla: webhook_events
-- Almacena todos los eventos recibidos con validación HMAC
CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    timestamp TIMESTAMPTZ,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'processed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar columnas si no existen (ejecutar ANTES de crear índices)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_events' AND column_name = 'signature') THEN
        ALTER TABLE webhook_events ADD COLUMN signature VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_events' AND column_name = 'timestamp') THEN
        ALTER TABLE webhook_events ADD COLUMN timestamp TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_events' AND column_name = 'created_at') THEN
        ALTER TABLE webhook_events ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_events' AND column_name = 'status') THEN
        ALTER TABLE webhook_events ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'processed';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_events' AND column_name = 'processed_at') THEN
        ALTER TABLE webhook_events ADD COLUMN processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Índices para búsqueda rápida (crear solo si no existen)
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_timestamp ON webhook_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- ============================================

-- Tabla: webhook_metrics
-- Métricas de procesamiento y análisis
CREATE TABLE IF NOT EXISTS webhook_metrics (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Índices para análisis
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_event_type ON webhook_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_timestamp ON webhook_metrics(timestamp DESC);

-- ============================================

-- Tabla: webhook_subscriptions
-- Configuración de webhooks a sistemas externos
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    endpoint_url TEXT NOT NULL,
    secret VARCHAR(255) NOT NULL,
    events TEXT[] NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    retry_config JSONB NOT NULL DEFAULT '{"max_attempts": 3, "delays_ms": [5000, 15000, 60000]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar columnas si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_subscriptions' AND column_name = 'events') THEN
        ALTER TABLE webhook_subscriptions ADD COLUMN events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_subscriptions' AND column_name = 'active') THEN
        ALTER TABLE webhook_subscriptions ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_subscriptions' AND column_name = 'retry_config') THEN
        ALTER TABLE webhook_subscriptions ADD COLUMN retry_config JSONB NOT NULL DEFAULT '{"max_attempts": 3, "delays_ms": [5000, 15000, 60000]}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_subscriptions' AND column_name = 'created_at') THEN
        ALTER TABLE webhook_subscriptions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_subscriptions' AND column_name = 'updated_at') THEN
        ALTER TABLE webhook_subscriptions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_events ON webhook_subscriptions USING GIN(events);

-- ============================================

-- Tabla: webhook_deliveries
-- Registro de entregas a sistemas externos
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL,
    response JSONB,
    error TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar columnas si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_deliveries' AND column_name = 'success') THEN
        ALTER TABLE webhook_deliveries ADD COLUMN success BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_deliveries' AND column_name = 'event_type') THEN
        ALTER TABLE webhook_deliveries ADD COLUMN event_type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_deliveries' AND column_name = 'response') THEN
        ALTER TABLE webhook_deliveries ADD COLUMN response JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_deliveries' AND column_name = 'error') THEN
        ALTER TABLE webhook_deliveries ADD COLUMN error TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'webhook_deliveries' AND column_name = 'delivered_at') THEN
        ALTER TABLE webhook_deliveries ADD COLUMN delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription_id ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);

-- ============================================

-- Vista: webhook_statistics
-- Estadísticas agregadas de webhooks
CREATE OR REPLACE VIEW webhook_statistics AS
SELECT
    event_type,
    COUNT(*) as total_events,
    AVG(processing_time_ms) as avg_processing_time_ms,
    MAX(processing_time_ms) as max_processing_time_ms,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as success_rate_percent,
    DATE_TRUNC('hour', timestamp) as hour
FROM webhook_metrics
GROUP BY event_type, DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- ============================================

-- Función: Limpiar eventos antiguos (> 30 días)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_events
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================

-- Datos de ejemplo: Suscripciones (solo si las columnas existen)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'webhook_subscriptions' AND column_name = 'name') THEN
        INSERT INTO webhook_subscriptions (name, endpoint_url, secret, events) VALUES
            ('Sistema de Notificaciones', 'https://example.com/webhooks/notifications', 'secret-notifications-123', ARRAY['prescripcion.registrada', 'comparacion.realizada']),
            ('Sistema de Analytics', 'https://example.com/webhooks/analytics', 'secret-analytics-456', ARRAY['comparacion.realizada'])
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================

COMMENT ON TABLE webhook_events IS 'Registro de todos los eventos de webhook recibidos con validación HMAC';
COMMENT ON TABLE webhook_metrics IS 'Métricas de rendimiento y análisis de webhooks';
COMMENT ON TABLE webhook_subscriptions IS 'Configuración de webhooks salientes a sistemas externos';
COMMENT ON TABLE webhook_deliveries IS 'Registro de entregas de webhooks a suscriptores';
