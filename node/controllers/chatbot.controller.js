import { execQuery } from "../config/database.js";
import { logAuditError } from "../helpers/errorLogger.js";

// Get all chatbots
export const getAllChatbots = async (req, res) => {
  try {
    const query = "SELECT * FROM R_CHATBOTS_TBL ORDER BY CREATED_AT DESC";
    const rows = await execQuery(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching chatbots:", err.message);
    logAuditError({
      eventType: 'DATA_FETCH',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch chatbots",
      message: err.message
    });
  }
};

// Get chatbot by ID
export const getChatbotById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = "SELECT * FROM R_CHATBOTS_TBL WHERE CHATBOT_ID = ?";
    const rows = await execQuery(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Chatbot not found"
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error fetching chatbot by ID:", err.message);
    logAuditError({
      eventType: 'DATA_FETCH',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch chatbot",
      message: err.message
    });
  }
};

// Get chatbot history/responses
export const getChatbotHistory = async (req, res) => {
  try {
    const { id: chatbotId } = req.params;
    const userId = req.query.user_id || null;

    if (!chatbotId) {
      return res.status(400).json({
        success: false,
        error: "CHATBOT_ID_REQUIRED",
        message: "chatbot_id is required"
      });
    }

    // Build query with parameterized values
    const binds = [chatbotId];
    let userFilter = "";
    if (userId) {
      userFilter = "AND USER_ID = ?";
      binds.push(userId);
    }

    const query = `
      SELECT
        RESPONSE_ID,
        CHATBOT_ID,
        USER_ID,
        MODEL_NAME,
        QUESTION AS USER_MESSAGE,
        RESPONSE AS BOT_MESSAGE,
        THINKINGDESC,
        TOKEN_COUNT,
        START_TIME,
        END_TIME,
        CREATED_AT
      FROM R_CHATBOT_RESPONSE_TBL
      WHERE CHATBOT_ID = ?
      ${userFilter}
      ORDER BY START_TIME ASC, RESPONSE_ID ASC
    `;

    const rows = await execQuery(query, binds);

    res.json({
      success: true,
      message: "Chat history fetched successfully",
      data: rows
    });
  } catch (err) {
    console.error("Error fetching chatbot history:", err.message);
    logAuditError({
      eventType: 'DATA_FETCH',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    res.status(500).json({
      success: false,
      error: "QUERY_FAILED",
      message: err.message
    });
  }
};

// Get all chatbot deployments
export const getAllDeployments = async (req, res) => {
  try {
    const query = `SELECT DISTINCT
  t.*,
  CURRENT_ROLE() AS c_role
FROM R_CHATBOT_DEPLOYMENTS_TBL t,
     LATERAL SPLIT_TO_TABLE(
       REGEXP_REPLACE(COALESCE(t.ROLE, ''), '\\s+', ''),  
       ','
     ) r
WHERE UPPER(NVL(TRIM(r.VALUE), '')) = UPPER(CURRENT_ROLE());`;
    const rows = await execQuery(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching deployments:", err.message);
    logAuditError({
      eventType: 'DATA_FETCH',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch deployments",
      message: err.message
    });
  }
};

// Create a new chatbot
// export const createChatbot = async (req, res) => {
//   try {
//     const { name, pipelineId, promptId, chatbotType, templateId, modelName, parentExperId, userId } = req.body;

//     // Validate required fields
//     if (!name || !pipelineId || !chatbotType || !modelName || !userId) {
//       return res.status(400).json({
//         success: false,
//         error: "Missing required fields",
//         message: "name, pipelineId, chatbotType, and modelName are required"
//       });
//     }

//     // Check if chatbot name already exists
//     const checkQuery = "SELECT CHATBOT_NAME FROM R_CHATBOTS_TBL WHERE CHATBOT_NAME = ?";
//     const existingChatbot = await execQuery(checkQuery, [name]);

//     if (existingChatbot.length > 0) {
//       return res.status(409).json({
//         success: false,
//         error: "Chatbot name already exists",
//         message: `A chatbot with the name '${name}' already exists. Please choose a different name.`
//       });
//     }

//     const query = `CALL R_SP_SAVE_CHATBOT(?,?,?,?,?,?,?,?)`;
//     const binds = [
//       name,
//       pipelineId,
//       promptId || null,
//       chatbotType,
//       templateId || null,
//       modelName,
//       parentExperId || null,
//       userId
//     ]
//     const rows = await execQuery(query, binds);
//     res.json({ success: true, data: rows });
//   } catch (err) {
//     console.error("Error creating chatbot:", err.message);
//     res.status(500).json({
//       success: false,
//       error: "Failed to create chatbot",
//       message: err.message
//     });
//   }
// };
export const createChatbot = async (req, res) => {
  try {
    const rawBody = req.body || {};
    let {
      name,
      pipelineId,
      promptId,        // may be null/undefined/empty-string
      chatbotType,
      templateId,      // may be null/undefined/empty-string
      modelName,       // can be string or array of strings from UI
      parentExperId,   // may be null/undefined/empty-string
      userId
    } = rawBody;

    // helper to treat empty string as null
    const toNullable = (v) => (v === '' || v == null ? null : v);
    pipelineId = toNullable(pipelineId);
    promptId = toNullable(promptId);
    templateId = toNullable(templateId);
    parentExperId = toNullable(parentExperId);
    userId = toNullable(userId);

    // 1) Validate required fields (allow promptId/templateId/parentExperId to be optional)
    if (!name || pipelineId == null || !chatbotType || !modelName || userId == null) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "name, pipelineId, chatbotType, modelName, and userId are required and cannot be empty"
      });
    }

    // ensure numeric IDs are numbers (Snowflake will implicitly cast STRING to NUMBER if numeric text, but reject empty)
    const ensureNumber = (label, v) => {
      if (v == null) return null;
      const n = Number(v);
      if (Number.isNaN(n)) {
        const err = new Error(`${label} must be a valid number`);
        err.status = 400;
        throw err;
      }
      return n;
    };

    // pipelineId is stored as STRING in the SP so don't coerce to number.
    if (typeof pipelineId === 'string') {
      pipelineId = pipelineId.trim();
    }
    promptId = ensureNumber('promptId', promptId);
    templateId = ensureNumber('templateId', templateId);
    parentExperId = ensureNumber('parentExperId', parentExperId);
    userId = ensureNumber('userId', userId);


    // 2) Normalize models => array of strings, trim, dedupe, cap at 3
    const toArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
    const rawModels = toArray(modelName).map(String).map(s => s.trim()).filter(Boolean);
    const seen = new Set();
    const normalizedModels = [];
    for (const m of rawModels) {
      if (!seen.has(m)) {
        seen.add(m);
        normalizedModels.push(m);
      }
      if (normalizedModels.length === 3) break; // enforce max 3
    }

    if (normalizedModels.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid models",
        message: "At least one model must be selected"
      });
    }

    // 3) Convert models to JSON string for the SP (VARCHAR column)
    const modelNameJson = JSON.stringify(normalizedModels); // e.g. '["mamba-370b","llama3-70b"]'

    // 4) Optional: FK pre-check for templateId to avoid runtime FK violation
    //    (Do this only if templateId is provided)
    if (templateId != null) {
      const tmplCheckSql = `
        SELECT TEMPLATE_ID
        FROM ${process.env.SNOWFLAKE_DATABASE}.${process.env.SNOWFLAKE_SCHEMA}.R_TEMPLATE_TBL
        WHERE TEMPLATE_ID = ?
        LIMIT 1
      `;
      const tmplRows = await execQuery(tmplCheckSql, [templateId]);
      if (tmplRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid templateId",
          message: `templateId ${templateId} does not exist in R_TEMPLATE_TBL`
        });
      }
    }

    // 5) Enforce unique chatbot name (use fully qualified table if needed)
    const checkQuery = `
      SELECT CHATBOT_NAME
      FROM ${process.env.SNOWFLAKE_DATABASE}.${process.env.SNOWFLAKE_SCHEMA}.R_CHATBOTS_TBL
      WHERE CHATBOT_NAME = ?
      LIMIT 1
    `;
    const existingChatbot = await execQuery(checkQuery, [name]);
    if (existingChatbot.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Chatbot name already exists",
        message: `A chatbot with the name '${name}' already exists. Please choose a different name.`
      });
    }

    // 6) Prepare SP call
    //    Your SP signature (as finalized) is:
    //    R_sp_save_chatbot(
    //       chatbot_name STRING,
    //       pipeline_id STRING,
    //       prompt_id INT,
    //       chatbot_type STRING,
    //       template_id INT,
    //       app_model_name STRING,     -- JSON text
    //       parent_exper_id INT,
    //       user_id INT
    //    )
    //
    // Use fully-qualified name to avoid resolution issues.
    const callSql = `
      CALL ${process.env.SNOWFLAKE_DATABASE}.${process.env.SNOWFLAKE_SCHEMA}.R_sp_save_chatbot(?,?,?,?,?,?,?,?)
    `;
    const binds = [
      name,
      pipelineId,
      promptId ?? null,
      chatbotType,
      templateId ?? null,
      modelNameJson,        // pass JSON string
      parentExperId ?? null,
      userId
    ];

    const rows = await execQuery(callSql, binds);

    // 7) Parse return value
    // Snowflake CALL typically returns a single row with a column like 'R_SP_SAVE_CHATBOT'
    // or 'COLUMN1' depending on your driver/wrapper. Inspect 'rows' to confirm.
    // Fallback defensively:
    let chatbotId = null;
    if (rows && rows.length > 0) {
      const r = rows[0];
      chatbotId = r.CHATBOT_ID
        ?? r.R_SP_SAVE_CHATBOT
        ?? r.COLUMN1
        ?? r['R_SP_SAVE_CHATBOT(CHATBOT_NAME STRING, PIPELINE_ID STRING, PROMPT_ID INT, CHATBOT_TYPE STRING, TEMPLATE_ID INT, APP_MODEL_NAME STRING, PARENT_EXPER_ID INT, USER_ID INT)'] // some drivers use full sig
        ?? null;
    }

    return res.json({
      success: true,
      data: {
        chatbotId,
        name,
        pipelineId,
        promptId: promptId ?? null,
        chatbotType,
        templateId: templateId ?? null,
        models: normalizedModels
      }
    });

  } catch (err) {
    // Surface FK violations and validation hints
    const msg = String(err?.message || err);
    console.error("Error creating chatbot:", msg);
    logAuditError({
      eventType: 'PROCESS_new',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });

    // if we threw a manual validation error with status
    if (err && err.status && err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({
        success: false,
        error: "Validation error",
        message: msg
      });
    }

    const isFK = msg.toLowerCase().includes('foreign key constraint')
      || msg.includes('200009 (22000)');
    return res.status(isFK ? 400 : 500).json({
      success: false,
      error: isFK ? "Foreign key violation" : "Failed to create chatbot",
      message: isFK
        ? "Invalid templateId. Ensure the template exists in R_TEMPLATE_TBL."
        : msg
    });
  }
};

// Deploy a chatbot
export const deployChatbot = async (req, res) => {
  try {
    const {
      chatbotId,
      chatbotName,
      chatbotType,
      model,
      roles,
      pipelineName,
      deployedBy,
      prompt_id // <-- optional
    } = req.body;

    // Validate required fields
    if (!chatbotId || !chatbotName || !chatbotType || !model || !pipelineName || !deployedBy) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message:
          "chatbotId, chatbotName, chatbotType, model, pipelineName, and deployedBy are required",
      });
    }

    // Convert roles array to CSV if provided
    const rolesString = roles
      ? (Array.isArray(roles) ? roles.join(',') : String(roles))
      : '';

    const query = `
      INSERT INTO R_CHATBOT_DEPLOYMENTS_TBL
      (chatbot_id, chatbot_name, chatbot_type, model, role, pipeline_name, deployed_by, deployed_at, prompt_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?)
    `;

    // ***** IMPORTANT: 8 binds for 8 ? placeholders *****
    const binds = [
      chatbotId,      // ?
      chatbotName,    // ?
      chatbotType,    // ?
      model,          // ?
      rolesString,    // ?
      pipelineName,   // ?
      deployedBy,     // ?
      prompt_id ?? null  // ?  <-- ensure we bind something (NULL if missing)
    ];

    const rows = await execQuery(query, binds);

    return res.json({
      success: true,
      message: "Chatbot deployed successfully",
      data: {
        chatbotId,
        chatbotName,
        chatbotType,
        model,
        roles: rolesString,
        pipelineName,
        deployedBy,
        prompt_id: prompt_id ?? null
      }
    });
  } catch (err) {
    console.error("Error deploying chatbot:", err?.message || err);
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
      data: {},
      error: "Failed to deploy chatbot",
      message: err?.message || String(err),
    });
  }
};

// Save chatbot response
export const saveChatbotResponse = async (req, res) => {
  try {
    const { chatbotId, modelName, question, response, tokenCount } = req.body;

    // Validate required fields
    if (!chatbotId || !modelName || !question || !response) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "chatbotId, modelName, question, and response are required"
      });
    }

    const query = `CALL R_SP_SAVE_CHATBOT_RESPONSE(?, ?, ?, ?, ?)`;
    const binds = [
      chatbotId,
      modelName,
      question,
      response,
      tokenCount ?? response.length
    ];

    const rows = await execQuery(query, binds);

    res.json({
      success: true,
      message: "Chatbot response saved successfully",
      data: rows
    });
  } catch (err) {
    console.error("Error saving chatbot response:", err.message);
    logAuditError({
      eventType: 'ERROR',
      errorMessage: err.message || String(err),
      context: JSON.stringify({ endpoint: req.originalUrl, method: req.method }),
      logDesc: 'Failure in ' + req.originalUrl,
      userId: req.headers['x-user-id'] || 'unknown',
      querId: err.statementId || 'UNKNOWN'
    });
    res.status(500).json({
      success: false,
      error: "Failed to save chatbot response",
      message: err.message
    });
  }
};

