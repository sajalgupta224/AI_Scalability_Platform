import axios from "axios";
import https from "https";

const HOST = "PIHJDMO-SFCOCOHOL.snowflakecomputing.com";
const DATABASE = "D_IN_CAPG_POC_AI_SCALABILITY";
const SCHEMA = "AI_SCALABILITY_SCHEMA";
const AGENT = "LINEAGE360";
const WAREHOUSE = "W_IN_CAPG_AI_SCALABILITY_SOL_XS";
const AUTH_TOKEN = process.env.SNOWFLAKE_AUTH_TOKEN;

/**
 * POST /api/lineage-ai/chat
 * Uses Snowflake Cortex Agent (LINEAGE_AGENT) to answer questions about lineage nodes.
 */
// export const chatWithLineageAI = async (req, res) => {
//   try {
//     const { question, nodeId, nodeType, nodeLabel, graphContext } = req.body;

//     if (!question) {
//       return res.status(400).json({
//         success: false,
//         error: "QUESTION_REQUIRED",
//         message: "A question is required",
//       });
//     }

//     const contextParts = [];
//     if (nodeId) contextParts.push(`Node ID: ${nodeId}`);
//     if (nodeType) contextParts.push(`Node Type: ${nodeType}`);
//     if (nodeLabel) contextParts.push(`Node Label: ${nodeLabel}`);
//     if (graphContext?.fullId) contextParts.push(`Full Identifier: ${graphContext.fullId}`);
//     if (graphContext?.subtitle) contextParts.push(`Subtitle: ${graphContext.subtitle}`);

//     const contextStr = contextParts.length > 0
//       ? `\n\nContext about the current lineage node:\n${contextParts.join("\n")}`
//       : "";

//     const userMessage = `${question}${contextStr}`;

//     const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${AGENT}:run`;

//     const headers = {
//       "Content-Type": "application/json",
//       Accept: "text/event-stream",
//       Authorization: `Bearer ${AUTH_TOKEN}`,
//     };

//     const requestBody = {
//       agent: `${DATABASE}.${SCHEMA}.${AGENT}`,
//       messages: [{ role: "user", content: [{ type: "text", text: userMessage }] }],
//       context: { warehouse: WAREHOUSE, database: DATABASE, schema: SCHEMA },
//       options: { allow_execution: true },
//     };

//     const tryRequest = async (rejectUnauthorized) => {
//       const httpsAgent = new https.Agent({ rejectUnauthorized });
//       return axios.post(url, requestBody, {
//         headers,
//         responseType: "stream",
//         httpsAgent,
//         timeout: 60_000,
//         decompress: true,
//         maxRedirects: 0,
//       });
//     };

//     let response;
//     try {
//       response = await tryRequest(true);
//     } catch (err) {
//       console.warn("[lineage-ai] TLS failed, retrying without cert verification:", err?.message);
//       response = await tryRequest(false);
//     }

//     const stream = response.data;
//     let buffer = "";
//     const contentParts = new Map();
//     const rawLines = [];

//     await new Promise((resolve, reject) => {
//       stream.on("data", (chunk) => {
//         buffer += chunk.toString();
//         const lines = buffer.split("\n");
//         buffer = lines.pop() || "";

//         for (const line of lines) {
//           rawLines.push(line);
//           if (!line.startsWith("data:")) continue;
//           const json = line.replace(/^data:\s*/, "").trim();
//           if (!json || json === "[DONE]") continue;
//           try {
//             const parsed = JSON.parse(json);
//             if (parsed?.status === "planning") continue;
//             if (typeof parsed?.text === "string" && parsed?.content_index !== undefined) {
//               const idx = parsed.content_index;
//               if (!contentParts.has(idx)) contentParts.set(idx, []);
//               contentParts.get(idx).push(parsed.text);
//             }
//           } catch {
//             // skip malformed
//           }
//         }
//       });

//       stream.on("end", resolve);
//       stream.on("error", reject);
//     });

//     let finalResponse = "No response generated.";
//     const maxIndex = Math.max(...Array.from(contentParts.keys()), -1);
//     if (maxIndex >= 0 && contentParts.has(maxIndex)) {
//       let text = contentParts.get(maxIndex).join("").trim();
//       const lines = text.split("\n");
//       if (lines.length > 4) {
//         const marker = lines[0] + "\n" + lines[1];
//         const secondOccurrence = text.indexOf(marker, marker.length);
//         if (secondOccurrence > 0) {
//           text = text.substring(0, secondOccurrence).trim();
//         }
//       }
//       finalResponse = text;
//     }

//     if (finalResponse === "No response generated.") {
//       // console.log("[lineage-ai/chat] No text extracted. Total raw lines:", rawLines.length);
//       // console.log("[lineage-ai/chat] Content indices found:", Array.from(contentParts.keys()));
//     }

//     return res.json({ success: true, response: finalResponse });
//   } catch (err) {
//     console.error("[lineage-ai/chat] Error:", err?.response?.status, err?.message || err);
//     const status = err?.response?.status || 500;
//     const errData = err?.response?.data ? String(err.response.data) : err?.message;
//     return res.status(status).json({
//       success: false,
//       error: "AI_CHAT_ERROR",
//       message: errData || "Failed to get AI response",
//     });
//   }
// };


export const chatWithLineageAI = async (req, res) => {
  try {
    const { question, nodeId, nodeType, nodeLabel, graphContext, mentions } = req.body;
 
    if (!question) {
      return res.status(400).json({
        success: false,
        error: "QUESTION_REQUIRED",
        message: "A question is required",
      });
    }
 
    const contextParts = [];
    if (nodeId) contextParts.push(`Node ID: ${nodeId}`);
    if (nodeType) contextParts.push(`Node Type: ${nodeType}`);
    if (nodeLabel) contextParts.push(`Node Label: ${nodeLabel}`);
    if (graphContext?.fullId) contextParts.push(`Full Identifier: ${graphContext.fullId}`);
    if (graphContext?.subtitle) contextParts.push(`Subtitle: ${graphContext.subtitle}`);
    if (Array.isArray(mentions) && mentions.length > 0) {
      const refList = mentions
        .map((m) => `- ${m.objectName || ""} (${m.objectType || "object"}): ${m.fullIdentifier || ""}`)
        .join("\n");
      contextParts.push(`Referenced objects (@-mentions):\n${refList}`);
    }
 
    const contextStr = contextParts.length > 0
      ? `\n\nContext about the current lineage node:\n${contextParts.join("\n")}`
      : "";
 
    const userMessage = `${question}${contextStr}`;
 
    const url = `https://${HOST}/api/v2/databases/${DATABASE}/schemas/${SCHEMA}/agents/${AGENT}:run`;
 
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    };
 
    const requestBody = {
      agent: `${DATABASE}.${SCHEMA}.${AGENT}`,
      messages: [{ role: "user", content: [{ type: "text", text: userMessage }] }],
      context: { warehouse: WAREHOUSE, database: DATABASE, schema: SCHEMA },
      options: { allow_execution: true },
    };
 
    const tryRequest = async (rejectUnauthorized) => {
      const httpsAgent = new https.Agent({ rejectUnauthorized });
      return axios.post(url, requestBody, {
        headers,
        responseType: "stream",
        httpsAgent,
        timeout: 60_000,
        decompress: true,
        maxRedirects: 0,
      });
    };
 
    let response;
    try {
      response = await tryRequest(true);
    } catch (err) {
      console.warn("[lineage-ai] TLS failed, retrying without cert verification:", err?.message);
      response = await tryRequest(false);
    }
 
    const stream = response.data;
    let buffer = "";
    const contentParts = new Map();
    const rawLines = [];
 
    await new Promise((resolve, reject) => {
      stream.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
 
        for (const line of lines) {
          rawLines.push(line);
          if (!line.startsWith("data:")) continue;
          const json = line.replace(/^data:\s*/, "").trim();
          if (!json || json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            if (parsed?.status === "planning") continue;
            if (typeof parsed?.text === "string" && parsed?.content_index !== undefined) {
              const idx = parsed.content_index;
              if (!contentParts.has(idx)) contentParts.set(idx, []);
              contentParts.get(idx).push(parsed.text);
            }
          } catch {
            // skip malformed
          }
        }
      });
 
      stream.on("end", resolve);
      stream.on("error", reject);
    });
 
    let finalResponse = "No response generated.";
    const maxIndex = Math.max(...Array.from(contentParts.keys()), -1);
    if (maxIndex >= 0 && contentParts.has(maxIndex)) {
      let text = contentParts.get(maxIndex).join("").trim();
      const lines = text.split("\n");
      if (lines.length > 4) {
        const marker = lines[0] + "\n" + lines[1];
        const secondOccurrence = text.indexOf(marker, marker.length);
        if (secondOccurrence > 0) {
          text = text.substring(0, secondOccurrence).trim();
        }
      }
      finalResponse = text;
    }
 
    if (finalResponse === "No response generated.") {
      // console.log("[lineage-ai/chat] No text extracted. Total raw lines:", rawLines.length);
      // console.log("[lineage-ai/chat] Content indices found:", Array.from(contentParts.keys()));
    }
 
    return res.json({ success: true, response: finalResponse });
  } catch (err) {
    console.error("[lineage-ai/chat] Error:", err?.response?.status, err?.message || err);
    const status = err?.response?.status || 500;
    const errData = err?.response?.data ? String(err.response.data) : err?.message;
    return res.status(status).json({
      success: false,
      error: "AI_CHAT_ERROR",
      message: errData || "Failed to get AI response",
    });
  }
};
