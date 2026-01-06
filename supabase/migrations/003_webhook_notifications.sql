-- ============================================
-- TABLA: webhook_notifications
-- ============================================
-- Registra todos los intentos de notificación externa
-- (Telegram, Email, SMS, etc.)

CREATE TABLE IF NOT EXISTS webhook_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'telegram', 'email', 'sms', etc.
    success BOOLEAN NOT NULL,
    error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Información adicional (chat_id, recipients, etc.)
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================

-- Búsqueda por event_id (para tracking completo de un evento)
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_event_id 
    ON webhook_notifications(event_id);

-- Búsqueda por tipo de notificación
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_type 
    ON webhook_notifications(notification_type);

-- Búsqueda por estado de éxito
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_success 
    ON webhook_notifications(success);

-- Búsqueda temporal (notificaciones recientes)
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_sent_at 
    ON webhook_notifications(sent_at DESC);

-- Búsqueda combinada: tipo + éxito + fecha
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_type_success_date 
    ON webhook_notifications(notification_type, success, sent_at DESC);

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE webhook_notifications IS 'Registro de notificaciones externas (Telegram, Email, etc.) enviadas por eventos webhook';

COMMENT ON COLUMN webhook_notifications.event_id IS 'ID del evento que generó la notificación';
COMMENT ON COLUMN webhook_notifications.event_type IS 'Tipo de evento (pedido.creado, etc.)';
COMMENT ON COLUMN webhook_notifications.notification_type IS 'Canal de notificación: telegram, email, sms, slack, etc.';
COMMENT ON COLUMN webhook_notifications.success IS 'Si la notificación fue enviada exitosamente';
COMMENT ON COLUMN webhook_notifications.error IS 'Mensaje de error si la notificación falló';
COMMENT ON COLUMN webhook_notifications.metadata IS 'Metadata adicional (chat_id, destinatarios, etc.)';
COMMENT ON COLUMN webhook_notifications.sent_at IS 'Timestamp del intento de envío';

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

ALTER TABLE webhook_notifications ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si existen antes de crearlas
DROP POLICY IF EXISTS "Permitir lectura de notificaciones" ON webhook_notifications;
DROP POLICY IF EXISTS "Permitir inserción a service_role" ON webhook_notifications;

-- Permitir lectura a usuarios autenticados
CREATE POLICY "Permitir lectura de notificaciones"
    ON webhook_notifications
    FOR SELECT
    TO authenticated
    USING (true);

-- Permitir inserción solo a service_role
CREATE POLICY "Permitir inserción a service_role"
    ON webhook_notifications
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================
-- CONSULTAS ÚTILES
-- ============================================

-- Estadísticas de notificaciones Telegram
-- SELECT 
--     COUNT(*) as total,
--     SUM(CASE WHEN success THEN 1 ELSE 0 END) as exitosas,
--     SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as fallidas,
--     ROUND(AVG(CASE WHEN success THEN 1 ELSE 0 END)::numeric * 100, 2) as tasa_exito
-- FROM webhook_notifications
-- WHERE notification_type = 'telegram'
--     AND sent_at > NOW() - INTERVAL '24 hours';

-- Notificaciones fallidas recientes
-- SELECT event_id, event_type, error, sent_at
-- FROM webhook_notifications
-- WHERE success = false
--     AND notification_type = 'telegram'
-- ORDER BY sent_at DESC
-- LIMIT 20;

-- Tracking completo de un evento
-- SELECT 
--     wn.notification_type,
--     wn.success,
--     wn.error,
--     wn.sent_at,
--     wn.metadata
-- FROM webhook_notifications wn
-- WHERE event_id = 'evt_12345'
-- ORDER BY sent_at DESC;
