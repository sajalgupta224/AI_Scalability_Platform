// controllers/settings.controller.js
import connection from "../config/database.js";   
import crypto from "crypto";
import { logAuditError } from "../helpers/errorLogger.js";

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function execSnowflake(sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, stmt, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    });
  });
}


export async function saveNotificationEmail(req, res) {
  try {
    const { email } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EMAIL",
        message: "Please enter a valid email address."
      });
    }

    const safeEmail = email.replace(/'/g, "''");

 
    const sql = `
      CREATE OR REPLACE PROCEDURE SEND_FAILED_AUDIT_LOG_EMAIL()
      RETURNS VARCHAR
      LANGUAGE SQL
      EXECUTE AS CALLER
      AS
      $$
      DECLARE 
        error_message VARCHAR; 
        event_type    VARCHAR; 
        log_desc      VARCHAR; 
        created_at    VARCHAR; 
        email_subject VARCHAR; 
        email_body    VARCHAR; 
        sql_statement VARCHAR; 
      BEGIN
        
        SELECT
          COALESCE(event_type::VARCHAR, ''),
          COALESCE(error_message::VARCHAR, ''),
          COALESCE(log_desc::VARCHAR, ''),
          COALESCE(created_at::VARCHAR, '')
        INTO
          :event_type, :error_message, :log_desc, :created_at
        FROM r_audit_logs_tbl
        WHERE error_message ILIKE '%failed%'
        ORDER BY created_at DESC
        LIMIT 1;

        IF (error_message IS NOT NULL AND error_message != '') THEN

          email_subject := 'System Alert: Errors Detected in AI Scalability Platform';

          email_body := 'A new error has been detected.:\\n\\n'
                        || 'Event Type: ' || event_type || '\\n\\n'
                        || 'Error Message: ' || error_message || '\\n\\n'
                        || 'Log Description: ' || log_desc || '\\n\\n'
                        || 'Created At: ' || created_at || '\\n';

          sql_statement := 'CALL SYSTEM$SEND_EMAIL('
                           || '''MY_EMAIL_INT'', '
                           || '''${safeEmail}'', '
                           || '''' || REPLACE(email_subject, '''', '''''') || ''', '
                           || '''' || REPLACE(email_body, '''', '''''') || ''')';

          EXECUTE IMMEDIATE sql_statement;

          RETURN 'Email sent to ${safeEmail}';
        ELSE
          RETURN 'No failed audit logs found.';
        END IF;

      END;
      $$;
    `;

    await execSnowflake(sql);

    return res.json({
      success: true,
      message: "Email saved and procedure updated successfully.",
      email
    });

  } catch (err) {
     logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    return res.status(500).json({
      success: false,
      error: "SAVE_EMAIL_FAILED",
      message: err.message
    });
  }
}


export async function verifyNotificationEmail(req, res) {
  return res.json({
    success: true,
    message: "Email verification endpoint placeholder — enable if needed."
  });
}



export async function sendTestEmail(req, res) {
  try {
    const rows = await execSnowflake(`CALL SEND_FAILED_AUDIT_LOG_EMAIL();`);
    return res.json({
      success: true,
      message: "Test email triggered. Check your inbox if a failed error exists.",
      result: rows
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "TEST_EMAIL_FAILED",
      message: err.message
    });
  }
}

export async function notifyOnError(req, res) {
  try {
    const result = await execSnowflake(`CALL SEND_FAILED_AUDIT_LOG_EMAIL();`);
    return res.json({
      success: true,
      message: "Error notification sent successfully.",
      result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "NOTIFY_FAILED",
      message: err.message
    });
  }
}