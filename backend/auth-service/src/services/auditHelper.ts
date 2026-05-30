import axios from 'axios';

const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://localhost:3003/log';

interface AuditExtras {
    actor_role?: string;
    entity_type?: string;
    entity_id?: string;
    result?: string;
    request_id?: string;
}

// Envía un evento de auditoría al audit-service con trazabilidad por correlation ID
export const sendToAudit = async (
    usuario_id: string | null,
    accion: string,
    detalles: string,
    correlationId?: string,
    extras?: AuditExtras
) => {
    try {
        await axios.post(AUDIT_SERVICE_URL, {
            usuario_id,
            accion,
            detalles,
            ip_origen: 'auth-service',
            request_id: extras?.request_id || correlationId || null,
            actor_role: extras?.actor_role || null,
            entity_type: extras?.entity_type || null,
            entity_id: extras?.entity_id || null,
            result: extras?.result || 'EXITO',
        }, {
            headers: { 'x-correlation-id': correlationId || 'SIN-RASTREO' }
        });
    } catch (error) {
        console.error('❌ Error de conexión con Audit Service:', error);
    }
};
