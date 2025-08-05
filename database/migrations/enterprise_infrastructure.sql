-- Enterprise Infrastructure Migration
-- Adds security events, application logs, and audit trails
-- for enterprise-grade monitoring and compliance

-- Security Events Table
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('auth_attempt', 'data_access', 'api_call', 'suspicious_activity', 'security_violation')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application Logs Table
CREATE TABLE IF NOT EXISTS application_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    service TEXT NOT NULL DEFAULT 'siFia-app',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    correlation_id TEXT,
    metadata JSONB DEFAULT '{}',
    error JSONB,
    performance JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Trail Table
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id TEXT
);

-- System Health Metrics Table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT NOT NULL,
    operation TEXT NOT NULL,
    duration_ms NUMERIC NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Classification Table
CREATE TABLE IF NOT EXISTS data_classification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    column_name TEXT,
    classification_level TEXT NOT NULL CHECK (classification_level IN ('public', 'internal', 'confidential', 'restricted')),
    encryption_required BOOLEAN NOT NULL DEFAULT false,
    audit_required BOOLEAN NOT NULL DEFAULT false,
    retention_days INTEGER NOT NULL DEFAULT 365,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(table_name, column_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_application_logs_timestamp ON application_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_service ON application_logs(service);
CREATE INDEX IF NOT EXISTS idx_application_logs_user_id ON application_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_correlation_id ON application_logs(correlation_id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_correlation_id ON audit_trail(correlation_id);

CREATE INDEX IF NOT EXISTS idx_system_health_metrics_timestamp ON system_health_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_type ON system_health_metrics(metric_type, metric_name);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_service ON performance_metrics(service, operation);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);

-- Enable Row Level Security
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_classification ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_events
CREATE POLICY "Users can view their own security events" ON security_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service accounts can insert security events" ON security_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all security events" ON security_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND subscription_tier = 'admin'
        )
    );

-- RLS Policies for application_logs
CREATE POLICY "Users can view their own application logs" ON application_logs
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service accounts can insert application logs" ON application_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all application logs" ON application_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND subscription_tier = 'admin'
        )
    );

-- RLS Policies for audit_trail
CREATE POLICY "Users can view their own audit trail" ON audit_trail
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service accounts can insert audit trail" ON audit_trail
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all audit trails" ON audit_trail
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND subscription_tier = 'admin'
        )
    );

-- RLS Policies for system_health_metrics
CREATE POLICY "Admins can manage system health metrics" ON system_health_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND subscription_tier = 'admin'
        )
    );

CREATE POLICY "Service accounts can insert system health metrics" ON system_health_metrics
    FOR INSERT WITH CHECK (true);

-- RLS Policies for performance_metrics
CREATE POLICY "Users can view their own performance metrics" ON performance_metrics
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service accounts can insert performance metrics" ON performance_metrics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all performance metrics" ON performance_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND subscription_tier = 'admin'
        )
    );

-- RLS Policies for data_classification
CREATE POLICY "Admins can manage data classification" ON data_classification
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND subscription_tier = 'admin'
        )
    );

-- Functions for automated cleanup
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean logs older than 90 days
    DELETE FROM application_logs 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean security events older than 1 year
    DELETE FROM security_events 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    -- Clean performance metrics older than 30 days
    DELETE FROM performance_metrics 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Clean system health metrics older than 7 days
    DELETE FROM system_health_metrics 
    WHERE timestamp < NOW() - INTERVAL '7 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get security metrics
CREATE OR REPLACE FUNCTION get_security_metrics(timeframe_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    total_events BIGINT,
    critical_events BIGINT,
    high_events BIGINT,
    medium_events BIGINT,
    low_events BIGINT,
    top_event_types JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH event_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical,
            COUNT(*) FILTER (WHERE severity = 'high') as high,
            COUNT(*) FILTER (WHERE severity = 'medium') as medium,
            COUNT(*) FILTER (WHERE severity = 'low') as low
        FROM security_events 
        WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
    ),
    event_types AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'event_type', event_type,
                'count', count
            ) ORDER BY count DESC
        ) as types
        FROM (
            SELECT event_type, COUNT(*) as count
            FROM security_events 
            WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
            GROUP BY event_type
            ORDER BY count DESC
            LIMIT 5
        ) t
    )
    SELECT 
        event_stats.total,
        event_stats.critical,
        event_stats.high,
        event_stats.medium,
        event_stats.low,
        COALESCE(event_types.types, '[]'::jsonb)
    FROM event_stats, event_types;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get performance metrics
CREATE OR REPLACE FUNCTION get_performance_metrics(timeframe_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    total_operations BIGINT,
    avg_duration_ms NUMERIC,
    success_rate NUMERIC,
    error_rate NUMERIC,
    slowest_operations JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH perf_stats AS (
        SELECT 
            COUNT(*) as total,
            AVG(duration_ms) as avg_duration,
            COUNT(*) FILTER (WHERE success = true) as success_count,
            COUNT(*) FILTER (WHERE success = false) as error_count
        FROM performance_metrics 
        WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
    ),
    slow_ops AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'service', service,
                'operation', operation,
                'avg_duration_ms', avg_duration_ms
            ) ORDER BY avg_duration_ms DESC
        ) as operations
        FROM (
            SELECT 
                service, 
                operation, 
                AVG(duration_ms) as avg_duration_ms
            FROM performance_metrics 
            WHERE timestamp >= NOW() - (timeframe_hours || ' hours')::INTERVAL
            GROUP BY service, operation
            ORDER BY avg_duration_ms DESC
            LIMIT 10
        ) t
    )
    SELECT 
        perf_stats.total,
        perf_stats.avg_duration,
        CASE 
            WHEN perf_stats.total > 0 THEN (perf_stats.success_count::NUMERIC / perf_stats.total * 100)
            ELSE 0 
        END,
        CASE 
            WHEN perf_stats.total > 0 THEN (perf_stats.error_count::NUMERIC / perf_stats.total * 100)
            ELSE 0 
        END,
        COALESCE(slow_ops.operations, '[]'::jsonb)
    FROM perf_stats, slow_ops;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job for cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-logs', '0 2 * * *', 'SELECT cleanup_old_logs();');

-- Insert initial data classifications
INSERT INTO data_classification (table_name, column_name, classification_level, encryption_required, audit_required, retention_days)
VALUES 
    ('user_profiles', 'email', 'confidential', true, true, 2555), -- 7 years
    ('user_profiles', 'full_name', 'internal', false, true, 2555),
    ('journal_entries', 'content', 'confidential', true, true, 1095), -- 3 years
    ('playbooks', 'content', 'internal', false, false, 365),
    ('devotionals', 'content', 'public', false, false, 365),
    ('security_events', NULL, 'restricted', true, true, 2555),
    ('application_logs', NULL, 'internal', false, true, 90),
    ('audit_trail', NULL, 'restricted', true, true, 2555)
ON CONFLICT (table_name, column_name) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT ON security_events TO authenticated;
GRANT SELECT, INSERT ON application_logs TO authenticated;
GRANT SELECT, INSERT ON audit_trail TO authenticated;
GRANT SELECT, INSERT ON system_health_metrics TO authenticated;
GRANT SELECT, INSERT ON performance_metrics TO authenticated;
GRANT SELECT ON data_classification TO authenticated;

-- Grant admin permissions
GRANT ALL ON security_events TO service_role;
GRANT ALL ON application_logs TO service_role;
GRANT ALL ON audit_trail TO service_role;
GRANT ALL ON system_health_metrics TO service_role;
GRANT ALL ON performance_metrics TO service_role;
GRANT ALL ON data_classification TO service_role;

COMMENT ON TABLE security_events IS 'Enterprise security event logging for monitoring and compliance';
COMMENT ON TABLE application_logs IS 'Centralized application logging with structured data';
COMMENT ON TABLE audit_trail IS 'Comprehensive audit trail for all user actions and data changes';
COMMENT ON TABLE system_health_metrics IS 'System health and performance monitoring metrics';
COMMENT ON TABLE performance_metrics IS 'Application performance tracking and optimization';
COMMENT ON TABLE data_classification IS 'Data classification and retention policies for compliance';
