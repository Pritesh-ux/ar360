import fs from "fs/promises";
import path from "path";
import type mysql from "mysql2/promise";

/**
 * Idempotent RBAC seed — mirrors migration 12 defaults.
 * Ensures roles exist and assigns super_admin to admins without a role.
 */
export async function seedAdminRbac(connection: mysql.Connection) {
  const [roleRows]: any = await connection.execute(
    "SELECT id FROM admin_roles WHERE code = 'super_admin' LIMIT 1",
  );
  let superAdminRoleId = roleRows[0]?.id as number | undefined;

  if (!superAdminRoleId) {
    console.log("Seeding admin RBAC roles and permissions...");
    const migrationPath = path.resolve("./", "database", "migrations", "12_admin_rbac.sql");
    const sql = await fs.readFile(migrationPath, "utf-8");
    if (sql.trim()) {
      await connection.query(sql);
    }
    const [after]: any = await connection.execute(
      "SELECT id FROM admin_roles WHERE code = 'super_admin' LIMIT 1",
    );
    superAdminRoleId = after[0]?.id;
  }

  if (superAdminRoleId) {
    const [result]: any = await connection.execute(
      `UPDATE master_admins SET role_id = ? WHERE role_id IS NULL`,
      [superAdminRoleId],
    );
    if (result.affectedRows > 0) {
      console.log(`Assigned super_admin role to ${result.affectedRows} master admin(s).`);
    }
  }
}
