import prisma from '../config/database';
import logger from '../config/logger';

interface AuditLogData {
  mandatorId?: string;
  userId: string;
  userType: 'super-admin' | 'mandator' | 'tenant';
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    if (data.userType === 'super-admin') {
      // Log to system audit logs
      await prisma.systemAuditLog.create({
        data: {
          superAdminId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } else if (data.mandatorId) {
      // Log to mandator audit logs
      await prisma.auditLog.create({
        data: {
          mandatorId: data.mandatorId,
          userId: data.userId,
          userType: data.userType,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    }
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    // Don't throw error - audit logging should not block operations
  }
}
