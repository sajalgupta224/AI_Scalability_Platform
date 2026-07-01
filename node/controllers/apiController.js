// node/controllers/apiController.js
import connection from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

// 1️⃣ CURRENT ROLE
export const getCurrentRole = (req, res) => {
  connection.execute({
    sqlText: `SELECT CURRENT_ROLE() AS CURRENT_ROLE;`,
    complete: (err, stmt, rows) => {
      if (err) {
        logAuditError({
          eventType: 'ERROR',
          errorMessage: err.message || String(err),
          context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
          logDesc: 'Failure in ' + req.originalUrl,
          userId: req.headers['x-user-id'] || 'unknown',
          querId: err.statementId || 'UNKNOWN'
        });
        return res.status(500).json({ error: err.message });
      }

      return res.json({
        current_role: rows?.[0]?.CURRENT_ROLE ?? null,
      });
    },
  });
};

// 2️⃣ CURRENT ACCESS (from r_role_permissions)
export const getCurrentAccess = (req, res) => {
  connection.execute({
    sqlText: `SELECT ROLE_NAME, PAGE_NAME, HAS_ACCESS FROM r_role_permissions;`,
    complete: (err, stmt, rows) => {
      if (err) {
        logAuditError({
          eventType: 'ERROR',
          errorMessage: err.message || String(err),
          context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
          logDesc: 'Failure in ' + req.originalUrl,
          userId: req.headers['x-user-id'] || 'unknown',
          querId: err.statementId || 'UNKNOWN'
        });
        return res.status(500).json({ error: err.message });
      }
      return res.json({ access: rows || [] });
    },
  });
};

// 3️⃣ UPSERT ROLE PERMISSION (Update if exists, else Insert)
export const updateRolePermission = (req, res) => {
  const { role_name, page_name, has_access } = req.body;

  if (!role_name || !page_name) {
    return res.status(400).json({
      success: false,
      error: "role_name and page_name are required",
    });
  }

  // normalize has_access to boolean
  let hasAccess = has_access;
  if (typeof hasAccess === "string") {
    hasAccess = hasAccess.toLowerCase() === "true" || hasAccess === "1";
  }
  if (typeof hasAccess === "number") {
    hasAccess = hasAccess === 1;
  }
  hasAccess = Boolean(hasAccess);

  // ✅ Snowflake MERGE (UPSERT)
  // This version DOES NOT require created_at/updated_at columns.
  const sqlText = `
    MERGE INTO r_role_permissions t
    USING (SELECT ? AS role_name, ? AS page_name, ? AS has_access) s
    ON t.role_name = s.role_name AND t.page_name = s.page_name
    WHEN MATCHED THEN UPDATE SET
      t.has_access = s.has_access
    WHEN NOT MATCHED THEN INSERT (role_name, page_name, has_access)
    VALUES (s.role_name, s.page_name, s.has_access);
  `;

  connection.execute({
    sqlText,
    binds: [role_name, page_name, hasAccess],
    complete: (err, stmt) => {
      if (err) {
        logAuditError({
          eventType: 'ERROR',
          errorMessage: err.message || String(err),
          context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
          logDesc: 'Failure in ' + req.originalUrl,
          userId: req.headers['x-user-id'] || 'unknown',
          querId: err.statementId || 'UNKNOWN'
        });
        return res.status(500).json({ error: err.message });
      }

      let updatedRows = 0;
      try {
        updatedRows = stmt?.getNumUpdatedRows?.() ?? 0;
      } catch (e) {
        // ignore if driver doesn't support
      }

      return res.json({
        success: true,
        upserted: {
          role_name,
          page_name,
          has_access: hasAccess,
        },
        rows_affected: updatedRows,
      });
    },
  });
};

// 4️⃣ CURRENT USER WITH ROLE (r_raise_user)
export const getUsersWithRole = (req, res) => {
  connection.execute({
    sqlText: `SELECT * FROM r_raise_user;`,
    complete: (err, stmt, rows) => {
      if (err) {
        logAuditError({
          eventType: 'ERROR',
          errorMessage: err.message || String(err),
          context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
          logDesc: 'Failure in ' + req.originalUrl,
          userId: req.headers['x-user-id'] || 'unknown',
          querId: err.statementId || 'UNKNOWN'
        });
        return res.status(500).json({ error: err.message });
      }
      return res.json({ users: rows || [] });
    },
  });
};