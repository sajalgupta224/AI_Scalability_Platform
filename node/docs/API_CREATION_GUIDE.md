# API Creation Guide for Node Developers

This guide provides a comprehensive overview of how to create new API endpoints in the Node backend, following the established patterns in the codebase.

## Table of Contents
1. [Project Structure](#project-structure)
2. [Creating a New API Endpoint](#creating-a-new-api-endpoint)
3. [Controller Pattern](#controller-pattern)
4. [Route Configuration](#route-configuration)
5. [Response Formats](#response-formats)
6. [Database Integration](#database-integration)
7. [Best Practices](#best-practices)

---

## Project Structure

```
node/
├── controllers/          # Business logic handlers
│   ├── chatbot.controller.js
│   ├── pipeline.controller.js
│   ├── prompt.controller.js
│   └── snowflake.controller.js
├── routes/              # Route definitions
│   ├── chatbot.routes.js
│   ├── pipeline.routes.js
│   ├── prompt.routes.js
│   └── snowflake.routes.js
├── config/              # Configuration files
│   └── database.js      # Database connection
└── server.js            # Main server file
```

---

## Creating a New API Endpoint

### Step 1: Create Controller

Create a new controller file in the `controllers/` directory (e.g., `example.controller.js`):

```javascript
import { execQuery } from "../config/database.js";

// GET endpoint - Fetch all records
export const getAllExamples = async (req, res) => {
  try {
    const query = "SELECT * FROM EXAMPLE_TABLE ORDER BY CREATED_AT DESC";
    const rows = await execQuery(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching examples:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch examples",
      message: err.message
    });
  }
};

// GET endpoint - Fetch by ID (with params)
export const getExampleById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = "SELECT * FROM EXAMPLE_TABLE WHERE EXAMPLE_ID = ?";
    const rows = await execQuery(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Example not found"
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error fetching example by ID:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch example",
      message: err.message
    });
  }
};

// POST endpoint - Create new record (with body validation)
export const createExample = async (req, res) => {
  try {
    const { name, description, userId } = req.body;

    // Validate required fields
    if (!name || !description || !userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "name, description, and userId are required"
      });
    }

    const query = `CALL SP_CREATE_EXAMPLE(?, ?, ?)`;
    const binds = [name, description, userId];
    const rows = await execQuery(query, binds);

    res.json({
      success: true,
      message: "Example created successfully",
      data: rows
    });
  } catch (err) {
    console.error("Error creating example:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to create example",
      message: err.message
    });
  }
};

// PUT endpoint - Update existing record
export const updateExample = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name && !description) {
      return res.status(400).json({
        success: false,
        error: "At least one field (name or description) must be provided"
      });
    }

    const query = `UPDATE EXAMPLE_TABLE SET NAME = ?, DESCRIPTION = ? WHERE EXAMPLE_ID = ?`;
    const binds = [name, description, id];
    await execQuery(query, binds);

    res.json({
      success: true,
      message: "Example updated successfully"
    });
  } catch (err) {
    console.error("Error updating example:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to update example",
      message: err.message
    });
  }
};

// DELETE endpoint - Remove record
export const deleteExample = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `DELETE FROM EXAMPLE_TABLE WHERE EXAMPLE_ID = ?`;

    await execQuery(query, [id]);

    res.json({
      success: true,
      message: "Example deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting example:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to delete example",
      message: err.message
    });
  }
};
```

### Step 2: Create Routes File

Create a new routes file in the `routes/` directory (e.g., `example.routes.js`):

```javascript
import express from "express";
import {
  getAllExamples,
  getExampleById,
  createExample,
  updateExample,
  deleteExample
} from "../controllers/example.controller.js";

const router = express.Router();

// GET /examples - Get all examples
router.get("/", getAllExamples);

// GET /examples/:id - Get specific example by ID
router.get("/:id", getExampleById);

// POST /examples/create - Create new example
router.post('/create', createExample);

// PUT /examples/:id - Update existing example
router.put('/:id', updateExample);

// DELETE /examples/:id - Delete example
router.delete('/:id', deleteExample);

export default router;
```

### Step 3: Register Routes in Server

Add the route to [server.js](server.js):

```javascript
import exampleRoutes from "./routes/example.routes.js";

// Mount the routes
app.use('/examples', exampleRoutes);
```

---

## Controller Pattern

### Standard Controller Structure

```javascript
export const controllerName = async (req, res) => {
  try {
    // 1. Extract parameters (params, query, or body)
    const { param1, param2 } = req.params;  // URL params
    const { query1 } = req.query;            // Query string
    const { field1, field2 } = req.body;     // Request body

    // 2. Validate input (if required)
    if (!field1 || !field2) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "field1 and field2 are required"
      });
    }

    // 3. Execute database query
    const query = "SELECT * FROM TABLE WHERE ID = ?";
    const rows = await execQuery(query, [param1]);

    // 4. Handle empty results (if applicable)
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Resource not found"
      });
    }

    // 5. Send success response
    res.json({ success: true, data: rows });

  } catch (err) {
    // 6. Handle errors
    console.error("Error description:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to perform operation",
      message: err.message
    });
  }
};
```

---

## Route Configuration

### HTTP Methods and Patterns

| Method | Purpose | Route Pattern | Example |
|--------|---------|---------------|---------|
| GET | Fetch all records | `router.get("/", controller)` | `/examples` |
| GET | Fetch by ID | `router.get("/:id", controller)` | `/examples/123` |
| GET | Fetch nested resource | `router.get("/:id/history", controller)` | `/examples/123/history` |
| POST | Create record | `router.post('/create', controller)` | `/examples/create` |
| POST | Custom action | `router.post('/action', controller)` | `/examples/deploy` |
| PUT | Update record | `router.put('/:id', controller)` | `/examples/123` |
| DELETE | Delete record | `router.delete('/:id', controller)` | `/examples/123` |

### Route Naming Conventions

- Use plural nouns for resource names: `/chatbots`, `/pipelines`, `/prompts`
- Use descriptive action names for custom endpoints: `/create`, `/deploy`, `/response`
- Use URL parameters for IDs: `/:id`
- Use query parameters for filtering: `?status=active&limit=10`

---

## Response Formats

### Success Response (200 OK)

```javascript
// Single record
res.json({
  success: true,
  data: { id: 1, name: "Example" }
});

// Multiple records
res.json({
  success: true,
  data: [
    { id: 1, name: "Example 1" },
    { id: 2, name: "Example 2" }
  ]
});

// With message
res.json({
  success: true,
  message: "Operation completed successfully",
  data: { id: 1 }
});
```

### Error Response (4xx/5xx)

```javascript
// 400 - Bad Request (validation error)
res.status(400).json({
  success: false,
  error: "Missing required fields",
  message: "name, email, and password are required"
});

// 404 - Not Found
res.status(404).json({
  success: false,
  error: "Resource not found"
});

// 500 - Internal Server Error
res.status(500).json({
  success: false,
  error: "Failed to fetch data",
  message: err.message
});
```

---

## Database Integration

### Using execQuery

The `execQuery` function from [config/database.js](config/database.js) is used for all database operations:

```javascript
import { execQuery } from "../config/database.js";

// Simple query (no parameters)
const rows = await execQuery("SELECT * FROM TABLE");

// Query with parameters (prevents SQL injection)
const rows = await execQuery(
  "SELECT * FROM TABLE WHERE ID = ?",
  [id]
);

// Multiple parameters
const rows = await execQuery(
  "INSERT INTO TABLE (NAME, EMAIL, STATUS) VALUES (?, ?, ?)",
  [name, email, status]
);

// Stored procedure call
const rows = await execQuery(
  "CALL SP_PROCEDURE_NAME(?, ?, ?)",
  [param1, param2, param3]
);
```

### Query Parameter Binding

Always use parameter binding (`?`) to prevent SQL injection:

```javascript
// ✅ CORRECT - Using parameter binding
const query = "SELECT * FROM USERS WHERE EMAIL = ?";
const rows = await execQuery(query, [email]);

// ❌ WRONG - String concatenation (vulnerable to SQL injection)
const query = `SELECT * FROM USERS WHERE EMAIL = '${email}'`;
const rows = await execQuery(query);
```

---

## Best Practices

### 1. Error Handling

Always wrap controller logic in try-catch blocks:

```javascript
export const controllerName = async (req, res) => {
  try {
    // Your logic here
  } catch (err) {
    console.error("Error description:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to perform operation",
      message: err.message
    });
  }
};
```

### 2. Input Validation

Validate required fields before processing:

```javascript
const { name, email, password } = req.body;

if (!name || !email || !password) {
  return res.status(400).json({
    success: false,
    error: "Missing required fields",
    message: "name, email, and password are required"
  });
}
```

### 3. Handle Empty Results

Check for empty results when fetching by ID:

```javascript
if (rows.length === 0) {
  return res.status(404).json({
    success: false,
    error: "Resource not found"
  });
}
```

### 4. Consistent Response Format

Always return consistent JSON responses:

```javascript
// Success
{ success: true, data: {...}, message: "..." }

// Error
{ success: false, error: "...", message: "..." }
```

### 5. Console Logging

Log errors with descriptive messages:

```javascript
console.error("Error fetching user by ID:", err.message);
```

---

## Complete Example: User API

### Controller: `controllers/user.controller.js`

```javascript
import { execQuery } from "../config/database.js";

// GET /users - Get all users
export const getAllUsers = async (req, res) => {
  try {
    const query = "SELECT * FROM USERS_TBL ORDER BY CREATED_AT DESC";
    const rows = await execQuery(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
      message: err.message
    });
  }
};

// GET /users/:id - Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = "SELECT * FROM USERS_TBL WHERE USER_ID = ?";
    const rows = await execQuery(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error fetching user by ID:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user",
      message: err.message
    });
  }
};

// POST /users/create - Create new user
export const createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "name, email, and role are required"
      });
    }

    const query = `CALL SP_CREATE_USER(?, ?, ?)`;
    const binds = [name, email, role];
    const rows = await execQuery(query, binds);

    res.json({
      success: true,
      message: "User created successfully",
      data: rows
    });
  } catch (err) {
    console.error("Error creating user:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to create user",
      message: err.message
    });
  }
};
```

### Routes: `routes/user.routes.js`

```javascript
import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post('/create', createUser);

export default router;
```

### Register in `server.js`

```javascript
import userRoutes from "./routes/user.routes.js";
app.use('/users', userRoutes);
```

---

## API Documentation Template

When creating a new API, document it using this template:

### API Endpoint: `[METHOD] /resource`

**Method:** GET | POST | PUT | DELETE

**Route:** `/api/resource`

**Description:** Brief description of what this endpoint does

**Request Parameters:**
- **Path Params:** `id` (number, required) - Resource ID
- **Query Params:** `status` (string, optional) - Filter by status
- **Body:**
  ```json
  {
    "name": "string (required)",
    "email": "string (required)",
    "role": "string (optional)"
  }
  ```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Missing required fields",
  "message": "name and email are required"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to fetch resource",
  "message": "Database connection error"
}
```

---

## Quick Reference Checklist

When creating a new API endpoint:

- [ ] Create controller function in `controllers/` directory
- [ ] Export controller function
- [ ] Wrap logic in try-catch block
- [ ] Validate required input fields
- [ ] Use `execQuery` with parameter binding
- [ ] Handle empty results (404) when appropriate
- [ ] Return consistent JSON response format
- [ ] Add error logging with `console.error`
- [ ] Create route definition in `routes/` directory
- [ ] Import and use controller in routes file
- [ ] Register routes in [server.js](server.js)
- [ ] Test API endpoint with sample requests
- [ ] Document the API endpoint

---

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Snowflake Node.js Driver](https://docs.snowflake.com/en/user-guide/nodejs-driver)
- Project Database Config: [config/database.js](config/database.js)
- Main Server File: [server.js](server.js)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-16
