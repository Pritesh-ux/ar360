import nextEnv from "@next/env";
import mysql from "mysql2/promise";

nextEnv.loadEnvConfig(process.cwd());

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "arstudio",
});

const [rows] = await conn.execute(
  `SELECT id, product_uid, title, model_url
   FROM products
   WHERE customer_uid = ?
     AND deleted_at IS NULL
   ORDER BY updated_at DESC
   LIMIT 10`,
  ["CUS-169432"],
);

console.log(JSON.stringify(rows, null, 2));
await conn.end();
