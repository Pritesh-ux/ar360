import mysql from "mysql2/promise";

async function run() {
  const connection = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    database: "arstudio"
  });

  console.log("--- master_admins ---");
  const [admins] = await connection.query("SELECT id, admin_uid, name, email, status, role_id FROM master_admins");
  console.log(admins);

  console.log("\n--- admin_roles ---");
  const [roles] = await connection.query("SELECT * FROM admin_roles");
  console.log(roles);

  await connection.end();
}

run().catch(console.error);
