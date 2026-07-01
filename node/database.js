
// import snowflake from "snowflake-sdk";
// import dotenv from "dotenv";
// import fs from "fs";

// dotenv.config();

// // Read the private key file (PEM)
// const privateKey = fs.readFileSync(process.env.SNOWFLAKE_PRIVATE_KEY_PATH, "utf8");

// const connection = snowflake.createConnection({
//   account: process.env.SNOWFLAKE_ACCOUNT,
//   username: process.env.SNOWFLAKE_USER,

//   warehouse: process.env.SNOWFLAKE_WAREHOUSE,
//   database: process.env.SNOWFLAKE_DATABASE,
//   schema: process.env.SNOWFLAKE_SCHEMA,

//   // ✅ Key-pair authentication
//   authenticator: "SNOWFLAKE_JWT",
//   privateKey,

//   // ✅ Only if encrypted key + passphrase is provided
//   // privateKeyPass: process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE,
// });

// // Connect to Snowflake
// connection.connect((err, conn) => {
//   if (err) {
//     console.error("Unable to connect to Snowflake: " + err.message);
//   } else {
//     console.log("Connected to Snowflake successfully!");
//   }
// });

// // Helper function to execute queries with promise support
// export const execQuery = (sqlText, binds = []) => {
//   return new Promise((resolve, reject) => {
//     connection.execute({
//       sqlText,
//       binds,
//       complete: (err, stmt, rows) => {
//         if (err) {
//           console.error("Query execution error:", err);
//           reject(err);
//         } else {
//           resolve(rows || []);
//         }
//       },
//     });
//   });
// };

// export default connection;



// import snowflake from "snowflake-sdk";
// import dotenv from "dotenv";

// dotenv.config();

// // Create a single Snowflake connection instance
// const connection = snowflake.createConnection({
//   account: process.env.SNOWFLAKE_ACCOUNT,
//   username: process.env.SNOWFLAKE_USER,
//   password: process.env.SNOWFLAKE_PASSWORD,
//   warehouse: process.env.SNOWFLAKE_WAREHOUSE,
//   database: process.env.SNOWFLAKE_DATABASE,
//   schema: process.env.SNOWFLAKE_SCHEMA,
//       /*lineage */
//   // authenticator: 'PROGRAMMATIC_ACCESS_TOKEN',
//   // token:
//   // application: 'node-app-svc'
//    /*lineage */
// });

// // Connect to Snowflake
// connection.connect((err, conn) => {
//   if (err) {
//     console.error("Unable to connect to Snowflake: " + err.message);
//   } else {
//     console.log("Connected to Snowflake successfully!");
//   }
// });

// // Helper function to execute queries with promise support
// export const execQuery = (sqlText, binds = []) => {
//   return new Promise((resolve, reject) => {
//     connection.execute({
//       sqlText,
//       binds,
//       complete: (err, stmt, rows) => {
//         if (err) {
//           console.error("Query execution error:", err);
//           reject(err);
//         } else {
//           resolve(rows || []);
//         }
//       },
//     });
//   });
// };

// export default connection;




import snowflake from "snowflake-sdk";
import dotenv from "dotenv";
 
dotenv.config();

// Hardcoded role
const HARDCODED_ROLE = "X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL";

// Create Snowflake connection using username/password
const connection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  // privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  role: HARDCODED_ROLE,
});
 
// Connect to Snowflake
connection.connect((err, conn) => {
  if (err) {
    console.error("Unable to connect to Snowflake:", err.message);
  } else {
    console.log("Connected to Snowflake successfully!");
    console.log("Using role:", HARDCODED_ROLE);
  }
});
 
// Helper function to execute queries with promise support
export const execQuery = (sqlText, binds = []) => {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, stmt, rows) => {
        if (err) {
          console.error("Query execution error:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      },
    });
  });
};
 
export default connection;



