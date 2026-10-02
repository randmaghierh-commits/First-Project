// Expense Tracker - backend (Express API + PostgreSQL)
//
// PHASE 1
// Setup:
//   1. Create a database named expense_tracker and run schema.sql on it.
//   2. Copy .env.example to a new file named .env and write your PostgreSQL password.
//   3. npm install express cors pg dotenv
// Run:    node server.js   (restart it every time you change this file)
//
// Endpoints you need to build:
//   GET    /api/expenses        return all expenses
//   GET    /api/expenses/:id    return one expense (404 if not found)
//   POST   /api/expenses        add an expense (201, or 400 if the data is invalid)
//   PUT    /api/expenses/:id    update an expense (200, 400, or 404)
//   DELETE /api/expenses/:id    delete an expense (200, or 404)
//
// Tips:
//   - Create one Pool (from the "pg" library) with the values from .env,
//     and use pool.query(...) in every route.
//   - ALWAYS send the values as parameters: pool.query("... WHERE id = $1", [id]).
//     NEVER build the SQL text by joining strings with data from the user.
//   - Use RETURNING to get the new (or updated) row back from INSERT and UPDATE.
//   - The database creates the id. The client never sends one.
//   - pg returns NUMERIC as text and DATE as a JavaScript Date, so fix both in your SELECT.
//     Hint: amount::float8 and to_char(date, 'YYYY-MM-DD').
//   - Validate the data before the query, and answer 400 with a message that explains the problem.
//   - Check the id before the query. A text like "abc" makes PostgreSQL throw an error.
//   - Enable CORS so the frontend can talk to the server.
//   - Test every endpoint with Thunder Client BEFORE you connect the frontend.


require("dotenv").config();          // load values from .env into process.env
const express = require("express");
const cors = require("cors");        // lets the frontend (another port) talk to this server
const { Pool } = require("pg");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());             // reads a JSON body into req.body 

// One Pool for the whole app; every route uses pool.query
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const EXPENSE_COLUMNS = `id, title, amount::float8 AS amount, category, to_char(date, 'YYYY-MM-DD') AS date`;

const CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];

// Checks the data for POST and PUT. Returns an error message, or null if everything is valid.
function validateExpense(body) {
  const { title, amount, category, date } = body || {};

  if (typeof title !== "string" || title.trim() === "") {
    return "Title is required.";
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "Amount must be a number greater than 0.";
  }
  if (!CATEGORIES.includes(category)) {
    return "Category must be one of: " + CATEGORIES.join(", ") + ".";
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "Date is required in the format YYYY-MM-DD.";
  }

  return null; // no error
}


// GET /api/expenses: return every expense
app.get("/api/expenses", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${EXPENSE_COLUMNS}
       FROM expenses
       ORDER BY date DESC, id DESC`
    );
    res.json(result.rows);// the rows are always in result.rows
  } catch (error) {
    console.error(error);// print the real error in the terminal for debugging
    res.status(500).json({ message: "Server error" });
  }
});
  
// GET /api/expenses/:id: return one expense, or 404 if it doesn't exist
app.get("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  // Check the id BEFORE the query: PostgreSQL throws an error if we send "abc" as an integer
  if (!/^\d+$/.test(id)) {
    return res.status(404).json({ message: "Expense not found" });
  }

  try {
   const result = await pool.query(
  `SELECT ${EXPENSE_COLUMNS}
   FROM expenses
   WHERE id = $1`,
  [id]
  );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/expenses: add a new expense
app.post("/api/expenses", async (req, res) => {
  const error = validateExpense(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const { title, amount, category, date } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO expenses (title, amount, category, date)
       VALUES ($1, $2, $3, $4)
       RETURNING ${EXPENSE_COLUMNS}`,
      [title.trim(), amount, category, date]
    );
    res.status(201).json(result.rows[0]); // 201 = created
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/expenses/:id: update an existing expense
app.put("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(404).json({ message: "Expense not found" });
  }

  const error = validateExpense(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const { title, amount, category, date } = req.body;

  try {
    const result = await pool.query(
      `UPDATE expenses
       SET title = $1, amount = $2, category = $3, date = $4
       WHERE id = $5
       RETURNING ${EXPENSE_COLUMNS}`,
      [title.trim(), amount, category, date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/expenses/:id: remove an expense
app.delete("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(404).json({ message: "Expense not found" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM expenses WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json({ message: "Expense deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// Start the server. 
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});