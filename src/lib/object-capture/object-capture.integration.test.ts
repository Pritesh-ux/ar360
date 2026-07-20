import assert from "node:assert/strict";
import test from "node:test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

test("Object Capture database isolation, races, leases, idempotency, and notification dedupe", async () => {
  const { getPool, query } = await import("@/lib/db");
  const {
    getCaptureJobForCustomer,
    heartbeatCaptureJob,
    transitionCaptureJob,
  } = await import("./repository");
  const { createProductFromCaptureTransaction, captureProductId } = await import("./create-product.service");
  const { createCustomerNotification } = await import("@/lib/account/notify.service");

  const suffix = crypto.randomUUID().replaceAll("-", "");
  const customerA = `oc-it-a-${suffix}`.slice(0, 64);
  const customerB = `oc-it-b-${suffix}`.slice(0, 64);
  const isolationJob = `oc-it-isolation-${suffix}`.slice(0, 64);
  const raceJob = `oc-it-race-${suffix}`.slice(0, 64);
  const leaseJob = `oc-it-lease-${suffix}`.slice(0, 64);
  const productJob = `oc-it-product-${suffix}`.slice(0, 64);
  const productId = captureProductId(productJob);
  const dedupeKey = `object-capture:${suffix}:completed`;

  try {
    await query(
      `INSERT INTO object_capture_jobs
       (id,customer_uid,status,progress,photo_count,model_key,lease_token,lease_expires_at,locked_at)
       VALUES
       (?,?,'pending',0,0,NULL,NULL,NULL,NULL),
       (?,?,'failed',0,20,NULL,NULL,NULL,NULL),
       (?,?,'processing',50,20,NULL,'lease-good',DATE_ADD(NOW(),INTERVAL 2 MINUTE),NOW()),
       (?,?,'completed',100,20,?,NULL,NULL,NULL)`,
      [
        isolationJob, customerA,
        raceJob, customerA,
        leaseJob, customerA,
        productJob, customerA, `${productJob}/output/model.glb`,
      ],
    );

    assert.equal(await getCaptureJobForCustomer(isolationJob, customerB), null);
    assert.equal((await getCaptureJobForCustomer(isolationJob, customerA))?.id, isolationJob);

    const race = await Promise.allSettled([
      transitionCaptureJob(raceJob, customerA, "queued", { progress: 25 }),
      transitionCaptureJob(raceJob, customerA, "cancelled", { progress: 0 }),
    ]);
    const rejected = race.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
    assert.ok(race.some((result) => result.status === "fulfilled"));
    for (const result of rejected) assert.match(String(result.reason), /changed while this action/);
    assert.ok(["queued", "cancelled"].includes(
      (await getCaptureJobForCustomer(raceJob, customerA))?.status || "",
    ));

    assert.equal(await heartbeatCaptureJob(leaseJob, "lease-wrong", 90), false);
    assert.equal(await heartbeatCaptureJob(leaseJob, "lease-good", 90, { progress: 60 }), true);

    let builds = 0;
    const build = async () => {
      builds++;
      await query(
        `INSERT INTO products
         (id,customer_uid,user_id,title,category,model_url,file_name,status,views,settings,material_settings,variants,hotspots)
         VALUES (?,?,NULL,'Integration Capture','Object Capture','/model.glb','model.glb','Draft',0,'{}','{}','[]','[]')`,
        [productId, customerA],
      );
      return { productId, product: { id: productId, customer_uid: customerA } };
    };
    const first = await createProductFromCaptureTransaction({ customerUid: customerA, jobId: productJob, build });
    const second = await createProductFromCaptureTransaction({ customerUid: customerA, jobId: productJob, build });
    assert.equal(first.existing, false);
    assert.equal(second.existing, true);
    assert.equal(builds, 1);

    const notifications = await Promise.all([
      createCustomerNotification({
        customerUid: customerA, category: "product", title: "Ready", body: "Ready",
        dedupeKey,
      }),
      createCustomerNotification({
        customerUid: customerA, category: "product", title: "Ready", body: "Ready",
        dedupeKey,
      }),
    ]);
    assert.equal(notifications.filter((result) => "created" in result).length, 1);
    const count = await query<{ total: number }>(
      "SELECT COUNT(*) total FROM customer_notifications WHERE customer_uid=? AND dedupe_key=?",
      [customerA, dedupeKey],
    );
    assert.equal(Number(count[0]?.total), 1);
  } finally {
    await query("DELETE FROM customer_notifications WHERE customer_uid=?", [customerA]).catch(() => undefined);
    await query("DELETE FROM products WHERE id=? AND customer_uid=?", [productId, customerA]).catch(() => undefined);
    await query(
      "DELETE FROM object_capture_jobs WHERE id IN (?,?,?,?)",
      [isolationJob, raceJob, leaseJob, productJob],
    ).catch(() => undefined);
    await (await getPool()).end();
  }
});
