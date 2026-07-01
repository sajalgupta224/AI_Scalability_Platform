-- ============================================================
-- PII Detection & Protection - Database Objects
-- ============================================================

-- Table: Stores individual PII column detections
CREATE TABLE IF NOT EXISTS R_PII_SCAN_RESULTS (
    ID VARCHAR(36) DEFAULT UUID_STRING(),
    SCAN_ID VARCHAR(36),
    DATABASE_NAME VARCHAR(200),
    SCHEMA_NAME VARCHAR(200),
    TABLE_NAME VARCHAR(200),
    COLUMN_NAME VARCHAR(200),
    PII_TYPE VARCHAR(50),
    CONFIDENCE NUMBER(5,2),
    SAMPLE_VALUES VARIANT,
    IS_MASKED BOOLEAN DEFAULT FALSE,
    MASKING_POLICY_NAME VARCHAR(200),
    DETECTED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    STATUS VARCHAR(20) DEFAULT 'DETECTED'
);

-- Table: Audit log of scan runs
CREATE TABLE IF NOT EXISTS R_PII_SCAN_HISTORY (
    SCAN_ID VARCHAR(36) DEFAULT UUID_STRING(),
    DATABASE_NAME VARCHAR(200),
    SCHEMA_NAME VARCHAR(200),
    TABLE_NAME VARCHAR(200),
    SCANNED_BY VARCHAR(200) DEFAULT CURRENT_USER(),
    STARTED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    COMPLETED_AT TIMESTAMP_NTZ,
    TABLES_SCANNED NUMBER DEFAULT 0,
    TABLES_TOTAL NUMBER DEFAULT 0,
    COLUMNS_SCANNED NUMBER DEFAULT 0,
    PII_FOUND NUMBER DEFAULT 0,
    STATUS VARCHAR(20) DEFAULT 'RUNNING'
);

-- Table: Tracks applied masking policies
CREATE TABLE IF NOT EXISTS R_PII_MASKING_POLICIES (
    ID VARCHAR(36) DEFAULT UUID_STRING(),
    POLICY_NAME VARCHAR(200),
    DATABASE_NAME VARCHAR(200),
    SCHEMA_NAME VARCHAR(200),
    TABLE_NAME VARCHAR(200),
    COLUMN_NAME VARCHAR(200),
    PII_TYPE VARCHAR(50),
    MASK_TYPE VARCHAR(50),
    POLICY_SQL VARCHAR(4000),
    APPLIED_BY VARCHAR(200) DEFAULT CURRENT_USER(),
    APPLIED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    IS_ACTIVE BOOLEAN DEFAULT TRUE
);

-- Stored Procedure: Scans a table for PII using pattern matching (OPTIMIZED)
CREATE OR REPLACE PROCEDURE SCAN_TABLE_FOR_PII(
    P_DATABASE VARCHAR,
    P_SCHEMA VARCHAR,
    P_TABLE VARCHAR,
    P_SCAN_ID VARCHAR
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
var results = [];
var columnsScanned = 0;
var piiFound = 0;

// PII patterns: column name patterns + data regex
var piiPatterns = [
    { type: 'EMAIL',       namePattern: /email|e_mail|email_addr/i,       dataRegex: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' },
    { type: 'PHONE',       namePattern: /phone|mobile|cell|tel|fax/i,     dataRegex: '\\+?[0-9][0-9\\-\\s\\(\\)]{7,15}' },
    { type: 'SSN',         namePattern: /ssn|social_sec|sin_number/i,     dataRegex: '[0-9]{3}-[0-9]{2}-[0-9]{4}' },
    { type: 'CREDIT_CARD', namePattern: /credit|card_num|cc_num|pan/i,    dataRegex: '[0-9]{4}[\\-\\s]?[0-9]{4}[\\-\\s]?[0-9]{4}[\\-\\s]?[0-9]{4}' },
    { type: 'NAME',        namePattern: /first_name|last_name|full_name|customer_name|person_name/i, dataRegex: null },
    { type: 'ADDRESS',     namePattern: /address|street|city|zip|postal|state/i, dataRegex: null },
    { type: 'IP_ADDRESS',  namePattern: /ip_addr|ip_address|client_ip|source_ip/i, dataRegex: '[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}' },
    { type: 'DOB',         namePattern: /dob|date_of_birth|birth_date|birthday/i, dataRegex: null }
];

// Data types that CAN contain PII (skip all others for data regex check)
var STRING_TYPES = ['TEXT', 'VARCHAR', 'STRING', 'CHAR', 'CHARACTER', 'VARIANT'];

try {
    // Get only relevant columns (skip NUMBER, DATE, BOOLEAN, BINARY, etc.)
    var colSql = `SELECT COLUMN_NAME, DATA_TYPE 
                  FROM ${P_DATABASE}.INFORMATION_SCHEMA.COLUMNS 
                  WHERE TABLE_SCHEMA = '${P_SCHEMA}' AND TABLE_NAME = '${P_TABLE}'
                  ORDER BY ORDINAL_POSITION`;
    var colStmt = snowflake.execute({sqlText: colSql});
    
    var columns = [];
    while (colStmt.next()) {
        columns.push({ name: colStmt.getColumnValue(1), dataType: colStmt.getColumnValue(2) });
    }
    columnsScanned = columns.length;

    for (var i = 0; i < columns.length; i++) {
        var col = columns[i];
        var isStringType = STRING_TYPES.indexOf(col.dataType) !== -1;
        
        for (var j = 0; j < piiPatterns.length; j++) {
            var pattern = piiPatterns[j];
            var confidence = 0;
            var nameMatch = pattern.namePattern.test(col.name);
            
            if (nameMatch) {
                confidence = 70;
            }
            
            // Only run data regex on string-type columns (big performance gain)
            if (pattern.dataRegex && isStringType && (nameMatch || confidence === 0)) {
                try {
                    var sampleSql = `SELECT COUNT(*) AS MATCH_COUNT
                                     FROM (SELECT "${col.name}" AS VAL FROM ${P_DATABASE}.${P_SCHEMA}.${P_TABLE} LIMIT 50)
                                     WHERE VAL IS NOT NULL AND REGEXP_LIKE(VAL::VARCHAR, '${pattern.dataRegex}')`;
                    var sampleStmt = snowflake.execute({sqlText: sampleSql});
                    if (sampleStmt.next()) {
                        var matchCount = sampleStmt.getColumnValue(1);
                        if (matchCount > 0) {
                            confidence = nameMatch ? 95 : 60;
                        }
                    }
                } catch (e) { }
            }
            
            // Skip non-string columns entirely if no name match
            if (!isStringType && !nameMatch) continue;
            
            if (confidence >= 60) {
                piiFound++;
                
                // Get masked sample values (limit 2 for speed)
                var sampleVals = [];
                try {
                    var svSql = `SELECT LEFT("${col.name}"::VARCHAR, 3) || '***' AS MASKED_VAL 
                                 FROM ${P_DATABASE}.${P_SCHEMA}.${P_TABLE} 
                                 WHERE "${col.name}" IS NOT NULL LIMIT 2`;
                    var svStmt = snowflake.execute({sqlText: svSql});
                    while (svStmt.next()) {
                        sampleVals.push(svStmt.getColumnValue(1));
                    }
                } catch(e) {}

                var insertSql = `INSERT INTO R_PII_SCAN_RESULTS 
                    (SCAN_ID, DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, COLUMN_NAME, PII_TYPE, CONFIDENCE, SAMPLE_VALUES, STATUS)
                    SELECT ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?), 'DETECTED'`;
                snowflake.execute({
                    sqlText: insertSql,
                    binds: [P_SCAN_ID, P_DATABASE, P_SCHEMA, P_TABLE, col.name, pattern.type, confidence, JSON.stringify(sampleVals)]
                });
                
                results.push({ column: col.name, piiType: pattern.type, confidence: confidence });
                break;
            }
        }
    }
} catch (e) {
    return { error: e.message, columnsScanned: columnsScanned, piiFound: piiFound };
}

return { table: P_TABLE, columnsScanned: columnsScanned, piiFound: piiFound, details: results };
$$;
