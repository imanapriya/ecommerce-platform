/**
 * Audit log service
 * Records all administrative changes and sensitive operations
 */
const db = require('../db');
const logger = require('../utils/logger');

async function recordAuditLog({
  entityType,
  entityId,
  action,
  actor,
  oldValues = null,
  newValues = null,
  reason = null,
  client = null,
}) {
  const queryExecutor = client || db;
  const sql = `
    INSERT INTO audit_logs (entity_type, entity_id, action, actor, old_values, new_values, reason)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
  `;
  const params = [
    entityType,
    String(entityId),
    action,
    actor || 'system',
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    reason,
  ];

  try {
    const res = await queryExecutor.query(sql, params);
    logger.info({
      auditId: res.rows[0].id,
      entityType,
      entityId,
      action,
      actor,
    }, 'Audit log recorded');
    return res.rows[0];
  } catch (err) {
    logger.error({ err: err.message, entityType, entityId }, 'Failed to write audit log');
    throw err;
  }
}

async function getAuditLogs({ entityType, entityId, limit = 50 }) {
  let sql = 'SELECT * FROM audit_logs';
  const params = [];
  const conditions = [];

  if (entityType) {
    params.push(entityType);
    conditions.push(`entity_type = $${params.length}`);
  }
  if (entityId) {
    params.push(String(entityId));
    conditions.push(`entity_id = $${params.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const res = await db.query(sql, params);
  return res.rows;
}

module.exports = {
  recordAuditLog,
  getAuditLogs,
};
