import type mysql from "mysql2/promise";
import { getPool } from "@/lib/db";
import type { ObjectCaptureJob } from "./types";

export type CaptureProductResult = {
  productId: string;
  product: Record<string, unknown>;
};

export function captureProductId(jobId: string) {
  return `oc_${jobId}`;
}

/**
 * Serializes product creation on the capture-job row. The builder performs
 * quota checks and durable writes while the row lock is held; repeats return
 * the already-linked tenant product instead of creating another one.
 */
export async function createProductFromCaptureTransaction(input: {
  customerUid: string;
  jobId: string;
  build: (job: ObjectCaptureJob) => Promise<CaptureProductResult>;
}) {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [jobRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM object_capture_jobs
       WHERE id=? AND customer_uid=? LIMIT 1 FOR UPDATE`,
      [input.jobId, input.customerUid],
    );
    const job = jobRows[0] as ObjectCaptureJob | undefined;
    if (!job) throw new CaptureProductError("Capture job not found.", 404);
    if (job.status !== "completed" || !job.model_key) {
      throw new CaptureProductError("Model is not ready yet.", 409);
    }
    if (job.product_id) {
      const [productRows] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT * FROM products WHERE id=? AND customer_uid=? LIMIT 1",
        [job.product_id, input.customerUid],
      );
      if (productRows[0]) {
        await connection.commit();
        return {
          existing: true,
          productId: job.product_id,
          product: productRows[0] as Record<string, unknown>,
        };
      }
    }
    const deterministicProductId = captureProductId(job.id);
    const [orphanRows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM products WHERE id=? AND customer_uid=? LIMIT 1",
      [deterministicProductId, input.customerUid],
    );
    if (orphanRows[0]) {
      await connection.execute(
        `UPDATE object_capture_jobs SET product_id=?, updated_at=NOW()
         WHERE id=? AND customer_uid=? AND product_id IS NULL`,
        [deterministicProductId, job.id, input.customerUid],
      );
      await connection.commit();
      return {
        existing: true,
        productId: deterministicProductId,
        product: orphanRows[0] as Record<string, unknown>,
      };
    }

    const created = await input.build(job);
    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `UPDATE object_capture_jobs SET product_id=?, updated_at=NOW()
       WHERE id=? AND customer_uid=? AND product_id IS NULL`,
      [created.productId, input.jobId, input.customerUid],
    );
    if (result.affectedRows !== 1) {
      throw new CaptureProductError("This capture job was linked by another request.", 409);
    }
    await connection.commit();
    return { ...created, existing: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export class CaptureProductError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}
