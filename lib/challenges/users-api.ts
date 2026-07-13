import { defineChallenge } from "./helpers";

const jsContent = `const express = require('express');
const md5 = require('md5');
const db = require('../db');

const router = express.Router();

router.get('/users/:id', async (req, res) => {
  const query = "SELECT * FROM users WHERE id = " + req.params.id;
  const rows = await db.query(query);
  res.json(rows[0]);
});

router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const users = await db.query(
    'SELECT * FROM users ORDER BY created_at LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  res.json(users);
});

router.post('/users', async (req, res) => {
  const { email, name, password } = req.body;
  const passwordHash = md5(password);
  const rows = await db.query(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [email, name, passwordHash]
  );
  res.json(rows[0]);
});

router.delete('/users/:id', (req, res) => {
  db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

module.exports = router;
`;

const pyContent = `from fastapi import APIRouter
from hashlib import md5

from app import db

router = APIRouter()


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    rows = await db.fetch_all(query)
    return rows[0]


@router.get("/users")
async def list_users(page: int = 1, limit: int = 20):
    offset = (page - 1) * limit
    users = await db.fetch_all(
        "SELECT * FROM users ORDER BY created_at LIMIT :limit OFFSET :offset",
        {"limit": limit, "offset": offset},
    )
    return users


@router.post("/users")
async def create_user(payload: dict):
    email = payload.get("email")
    name = payload.get("name")
    password = payload.get("password")
    password_hash = md5(password.encode()).hexdigest()
    row = await db.fetch_one(
        "INSERT INTO users (email, name, password_hash)"
        " VALUES (:email, :name, :hash) RETURNING *",
        {"email": email, "name": name, "hash": password_hash},
    )
    return row


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str):
    db.execute("DELETE FROM users WHERE id = :id", {"id": user_id})
`;

export const usersApi = defineChallenge({
  id: "users-api",
  title: "Users REST API endpoints",
  summary:
    "A CRUD router with realistic production mistakes: SQL injection, leaked password hashes, MD5 hashing, missing validation, an unbounded page size and a fire-and-forget DELETE. Tests security instincts and API hygiene.",
  prTitle: "Add user CRUD endpoints for the admin panel",
  prDescription:
    "Adds the first version of the users API: fetch one, list with pagination, create, and delete. " +
    "The db module exposes parameterised query helpers. " +
    "Please review as you would a normal PR — leave comments on any lines you have concerns about.",
  fixInstructions:
    "Now fix the endpoints. Address the security problems first (injection, password handling, data exposure), then correctness (validation, error handling, missing await) and the pagination limits. You can assume a bcrypt/argon2 library is available.",
  findings: [
    {
      id: "api-sql-injection",
      title: "SQL injection in GET /users/:id",
      description:
        "The id is concatenated straight into the SQL string. Any caller can inject arbitrary SQL (e.g. '1 OR 1=1' or a UNION select). It must use a parameterised query like the other endpoints do.",
      category: "security",
      severity: "critical",
    },
    {
      id: "api-password-leak",
      title: "password_hash is returned to the client",
      description:
        "SELECT * / RETURNING * pulls every column including password_hash, and the rows are serialised straight into the response. Responses must select or whitelist safe columns only.",
      category: "security",
      severity: "critical",
    },
    {
      id: "api-weak-hash",
      title: "Passwords hashed with unsalted MD5",
      description:
        "MD5 is broken for password storage: it is fast to brute-force and there is no salt, so identical passwords produce identical hashes. Use bcrypt, scrypt or argon2.",
      category: "security",
      severity: "critical",
    },
    {
      id: "api-no-validation",
      title: "No input validation on POST /users",
      description:
        "email, name and password are taken from the body unchecked. A missing password crashes the hash call; malformed emails and empty names go straight to the database. Validate and return 400 on bad input (and 201, not 200, on success).",
      category: "bug",
      severity: "major",
    },
    {
      id: "api-unbounded-limit",
      title: "Page size is not clamped",
      description:
        "limit comes from the query string with no maximum, so ?limit=1000000 dumps the whole table in one request — a trivial DoS / data-scraping vector. Clamp it to a sane maximum.",
      category: "performance",
      severity: "major",
    },
    {
      id: "api-delete-fire-forget",
      title: "DELETE is fire-and-forget",
      description:
        "The delete query is never awaited, so the handler returns 204 before (and regardless of whether) the delete succeeds, and any failure is an unhandled rejection. There is also no check that the row existed. Await the query and handle errors.",
      category: "bug",
      severity: "major",
    },
  ],
  variants: {
    javascript: {
      language: "javascript",
      files: [{ path: "routes/users.js", content: jsContent }],
      anchors: {
        "api-sql-injection": {
          file: "routes/users.js",
          anchor: '+ req.params.id',
        },
        "api-password-leak": {
          file: "routes/users.js",
          anchor: "RETURNING *",
        },
        "api-weak-hash": {
          file: "routes/users.js",
          anchor: "md5(password)",
        },
        "api-no-validation": {
          file: "routes/users.js",
          anchor: "const { email, name, password } = req.body;",
        },
        "api-unbounded-limit": {
          file: "routes/users.js",
          anchor: "parseInt(req.query.limit) || 20",
        },
        "api-delete-fire-forget": {
          file: "routes/users.js",
          anchor: "'DELETE FROM users WHERE id = $1'",
        },
      },
    },
    python: {
      language: "python",
      files: [{ path: "routes/users.py", content: pyContent }],
      anchors: {
        "api-sql-injection": {
          file: "routes/users.py",
          anchor: 'f"SELECT * FROM users WHERE id = {user_id}"',
        },
        "api-password-leak": {
          file: "routes/users.py",
          anchor: "RETURNING *",
        },
        "api-weak-hash": {
          file: "routes/users.py",
          anchor: "md5(password.encode())",
        },
        "api-no-validation": {
          file: "routes/users.py",
          anchor: "async def create_user(payload: dict):",
        },
        "api-unbounded-limit": {
          file: "routes/users.py",
          anchor: "page: int = 1, limit: int = 20",
        },
        "api-delete-fire-forget": {
          file: "routes/users.py",
          anchor: 'db.execute("DELETE FROM users WHERE id = :id"',
        },
      },
    },
  },
});
