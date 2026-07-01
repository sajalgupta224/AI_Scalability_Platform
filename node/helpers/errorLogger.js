import { runQuery } from "../server.js";

export async function logAuditError({
  eventType = 'ERROR',
  errorMessage = '',
  context = '',
  logDesc = '',
  userId = 'unknown',
  eventSeq = 0,
  serviceId = -1,
  templateId = -1,
  querId = 'UNKNOWN',
}) {
  try {
    const sql = `
      CALL ${process.env.SNOWFLAKE_DATABASE}.${process.env.SNOWFLAKE_SCHEMA}.R_SP_SAVE_AUDIT_LOG(?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const binds = [
      eventType,
      errorMessage,
      context,
      logDesc,
      userId,
      eventSeq,
      serviceId,
      templateId,
      querId,
    ];

    await runQuery(sql, binds);
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}