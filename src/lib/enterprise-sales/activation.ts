import { randomBytes } from "crypto";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { hashPassword } from "@/lib/auth";
import { getPool, query } from "@/lib/db";
import { assertInstallmentFitsRemaining, remainingBalancePaise } from "./bill-ledger";
import { EnterpriseSalesValidationError, assertPaymentTransition } from "./validation";
import type { PaymentStatus } from "./types";
import {
  effectiveActivationPaymentDetails,
  invoiceBelongsToCustomer,
  isActivationReplay,
} from "./workflow-policy";

type ActivationDetails = {
  transactionId?: string | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
  adminId?: number | null;
};

export type EnterpriseActivationResult = {
  activated: boolean;
  alreadyActivated: boolean;
  firstActivation: boolean;
  collectionStatus: "unpaid" | "partial" | "paid";
  paidPaise: number;
  remainingPaise: number;
  customerId: number;
  customerUid: string;
  userId: number;
  email: string;
  contactName: string;
  subscriptionId: number;
  contractUid: string;
  activationEmailSent: boolean;
};

type LockedRequest = {
  id: number;
  request_uid: string;
  company_name: string;
  contact_name: string;
  business_email: string;
  phone: string;
  country: string;
  status: string;
  customer_id: number | null;
  activation_email_sent_at: string | null;
};

type ProvisionedCustomer = {
  customerId: number;
  customerUid: string;
  userId: number;
  email: string;
  contactName: string;
};

function publicUid(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function customerUid() {
  return `CUS-${randomBytes(12).toString("hex").toUpperCase()}`;
}

function userUid() {
  return `USR-${randomBytes(12).toString("hex").toUpperCase()}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function lockRequest(connection: PoolConnection, requestUid: string): Promise<LockedRequest> {
  const [rows] = await connection.execute<any[]>(
    `SELECT id, request_uid, company_name, contact_name, business_email, phone, country, status,
            customer_id, activation_email_sent_at
       FROM enterprise_requests
      WHERE request_uid = ?
      FOR UPDATE`,
    [requestUid],
  );
  if (!rows[0]) throw new Error("Enterprise request not found");
  return rows[0] as LockedRequest;
}

async function provisionLockedCustomer(
  connection: PoolConnection,
  enterpriseRequest: LockedRequest,
): Promise<ProvisionedCustomer> {
  const email = normalizeEmail(enterpriseRequest.business_email);
  if (!email) throw new EnterpriseSalesValidationError("Enterprise request has no business email");

  const [users] = await connection.execute<any[]>(
    "SELECT id, name, email, status FROM users WHERE email = ? FOR UPDATE",
    [email],
  );
  if (users.length > 1) {
    throw new EnterpriseSalesValidationError("Multiple users match the Enterprise business email");
  }
  let user = users[0] as { id: number; name: string; email: string; status: string } | undefined;
  if (user?.status === "Deleted") {
    throw new EnterpriseSalesValidationError("The matching user account is deleted");
  }

  let customerRows: any[] = [];
  if (enterpriseRequest.customer_id) {
    const [rows] = await connection.execute<any[]>(
      "SELECT id, user_id, customer_uid, contact_name, email, status FROM customers WHERE id = ? FOR UPDATE",
      [enterpriseRequest.customer_id],
    );
    customerRows = rows;
  } else {
    const [rows] = await connection.execute<any[]>(
      `SELECT id, user_id, customer_uid, contact_name, email, status
         FROM customers
        WHERE LOWER(TRIM(email)) = ? OR (? IS NOT NULL AND user_id = ?)
        FOR UPDATE`,
      [email, user?.id ?? null, user?.id ?? null],
    );
    customerRows = rows;
  }
  if (customerRows.length > 1) {
    throw new EnterpriseSalesValidationError("Multiple customers match the Enterprise business email");
  }
  let customer = customerRows[0] as {
    id: number;
    user_id: number | null;
    customer_uid: string | null;
    contact_name: string | null;
    email: string | null;
    status: string;
  } | undefined;
  if (customer?.status === "Deleted") {
    throw new EnterpriseSalesValidationError("The matching customer account is deleted");
  }
  if (customer?.email && normalizeEmail(customer.email) !== email) {
    throw new EnterpriseSalesValidationError("The linked customer email does not match the business email");
  }

  if (customer?.user_id && user && Number(customer.user_id) !== Number(user.id)) {
    throw new EnterpriseSalesValidationError("The matching customer is linked to a different user");
  }
  if (customer?.user_id && !user) {
    const [linkedUsers] = await connection.execute<any[]>(
      "SELECT id, name, email, status FROM users WHERE id = ? FOR UPDATE",
      [customer.user_id],
    );
    user = linkedUsers[0];
    if (!user || normalizeEmail(user.email) !== email || user.status === "Deleted") {
      throw new EnterpriseSalesValidationError("The linked customer user does not match the business email");
    }
  }

  if (!user) {
    const unusablePassword = hashPassword(randomBytes(48).toString("base64url"));
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (user_uid, name, email, password_hash, role, status, email_verified, two_factor_enabled)
       VALUES (?, ?, ?, ?, 'user', 'Suspended', FALSE, FALSE)`,
      [userUid(), enterpriseRequest.contact_name, email, unusablePassword],
    );
    user = {
      id: Number(result.insertId),
      name: enterpriseRequest.contact_name,
      email,
      status: "Suspended",
    };
  }

  if (!customer) {
    const newCustomerUid = customerUid();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO customers
        (user_id, customer_uid, company_name, contact_name, email, phone, country, plan_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'free', 'Suspended')`,
      [
        user.id,
        newCustomerUid,
        enterpriseRequest.company_name,
        enterpriseRequest.contact_name,
        email,
        enterpriseRequest.phone || null,
        enterpriseRequest.country || null,
      ],
    );
    customer = {
      id: Number(result.insertId),
      user_id: user.id,
      customer_uid: newCustomerUid,
      contact_name: enterpriseRequest.contact_name,
      email,
      status: "Suspended",
    };
  } else {
    if (customer.user_id == null) {
      await connection.execute("UPDATE customers SET user_id = ? WHERE id = ?", [user.id, customer.id]);
      customer.user_id = user.id;
    }
    if (!customer.customer_uid) {
      customer.customer_uid = customerUid();
      await connection.execute("UPDATE customers SET customer_uid = ? WHERE id = ?", [
        customer.customer_uid,
        customer.id,
      ]);
    }
  }

  await connection.execute("UPDATE enterprise_requests SET customer_id = ? WHERE id = ?", [
    customer.id,
    enterpriseRequest.id,
  ]);

  return {
    customerId: Number(customer.id),
    customerUid: String(customer.customer_uid),
    userId: Number(user.id),
    email,
    contactName: enterpriseRequest.contact_name,
  };
}

export async function provisionEnterpriseCustomer(
  requestUid: string,
  adminId?: number | null,
): Promise<ProvisionedCustomer> {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const enterpriseRequest = await lockRequest(connection, requestUid);
    if (["active", "rejected", "closed"].includes(enterpriseRequest.status)) {
      throw new EnterpriseSalesValidationError("This Enterprise request cannot be provisioned");
    }
    const customer = await provisionLockedCustomer(connection, enterpriseRequest);
    await connection.execute(
      `INSERT INTO enterprise_notes (note_uid, request_id, admin_id, event_type, body)
       VALUES (?, ?, ?, 'status_change', ?)`,
      [
        publicUid("en"),
        enterpriseRequest.id,
        adminId ?? null,
        `Customer ${customer.customerUid} linked in suspended state for invoicing`,
      ],
    );
    await connection.commit();
    return customer;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function activatePaidEnterprisePayment(
  requestUid: string,
  paymentUid: string,
  nextStatus: PaymentStatus,
  details: ActivationDetails,
): Promise<EnterpriseActivationResult> {
  const transactionId = details.transactionId?.trim() || "";
  const paymentMethod = details.paymentMethod?.trim() || null;
  if (nextStatus !== "paid") {
    throw new EnterpriseSalesValidationError("Enterprise activation requires paid status");
  }
  if (!transactionId || !details.paidAt) {
    throw new EnterpriseSalesValidationError("Paid payments require a transaction ID and paid date");
  }
  if (transactionId.length > 191 || (paymentMethod?.length || 0) > 80) {
    throw new EnterpriseSalesValidationError("Transaction details are too long");
  }
  const paidAt = new Date(details.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new EnterpriseSalesValidationError("Paid date is invalid");
  }
  const paidAtMysql = paidAt.toISOString().slice(0, 19).replace("T", " ");

  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const enterpriseRequest = await lockRequest(connection, requestUid);
    const activatable = ["quoted", "waiting_payment", "active"];
    if (enterpriseRequest.status === "rejected" || enterpriseRequest.status === "closed") {
      throw new EnterpriseSalesValidationError(
        `Cannot mark paid while request is ${enterpriseRequest.status}`,
      );
    }
    if (!activatable.includes(enterpriseRequest.status)) {
      // Cash/installment collection implies the deal is waiting on payment —
      // don't force admins to manually click Quoted → Waiting Payment first.
      await connection.execute(
        "UPDATE enterprise_requests SET status = 'waiting_payment' WHERE id = ?",
        [enterpriseRequest.id],
      );
      enterpriseRequest.status = "waiting_payment";
    }

    const [payments] = await connection.execute<any[]>(
      `SELECT id, request_id, quote_id, invoice_id, subscription_id, contract_id, amount_paise,
              currency, transaction_id, payment_method, paid_at, status
         FROM enterprise_payments
        WHERE payment_uid = ? AND request_id = ?
        FOR UPDATE`,
      [paymentUid, enterpriseRequest.id],
    );
    const payment = payments[0];
    if (!payment) throw new Error("Enterprise payment not found");
    assertPaymentTransition(payment.status as PaymentStatus, "paid");
    if (payment.status === "paid" && payment.transaction_id !== transactionId) {
      throw new EnterpriseSalesValidationError("Paid payment transaction ID cannot be changed");
    }

    const [duplicateTransactions] = await connection.execute<any[]>(
      "SELECT id FROM enterprise_payments WHERE transaction_id = ? AND id <> ? FOR UPDATE",
      [transactionId, payment.id],
    );
    if (duplicateTransactions[0]) {
      throw new EnterpriseSalesValidationError("Transaction ID is already linked to another payment");
    }

    const [quotes] = await connection.execute<any[]>(
      `SELECT id, request_id, custom_plan_id, billing_cycle, price_paise, currency
         FROM enterprise_quotes
        WHERE id = ? AND request_id = ?
        FOR UPDATE`,
      [payment.quote_id, enterpriseRequest.id],
    );
    const quote = quotes[0];
    if (!quote?.custom_plan_id) {
      throw new EnterpriseSalesValidationError("Payment quote has no selected custom plan");
    }
    if (payment.currency !== quote.currency) {
      throw new EnterpriseSalesValidationError("Payment currency does not match the selected quote");
    }

    const [paidRows] = await connection.execute<any[]>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS paid
         FROM enterprise_payments
        WHERE quote_id = ? AND status = 'paid' AND id <> ?
        FOR UPDATE`,
      [quote.id, payment.id],
    );
    const alreadyPaidPaise = Number(paidRows[0]?.paid || 0);
    const remainingPaise = remainingBalancePaise(Number(quote.price_paise), alreadyPaidPaise);
    try {
      assertInstallmentFitsRemaining(Number(payment.amount_paise), remainingPaise);
    } catch (error) {
      throw new EnterpriseSalesValidationError(error instanceof Error ? error.message : "Invalid installment amount");
    }

    const [plans] = await connection.execute<any[]>(
      "SELECT id, custom_plan_uid FROM enterprise_custom_plans WHERE id = ? FOR UPDATE",
      [quote.custom_plan_id],
    );
    const plan = plans[0];
    if (!plan) throw new EnterpriseSalesValidationError("Selected Enterprise custom plan no longer exists");
    if (!payment.invoice_id) {
      throw new EnterpriseSalesValidationError("Generate and link the GST invoice before marking payment Paid");
    }
    const [duplicateInvoices] = await connection.execute<any[]>(
      "SELECT id FROM enterprise_payments WHERE invoice_id = ? AND id <> ? FOR UPDATE",
      [payment.invoice_id, payment.id],
    );
    if (duplicateInvoices[0]) {
      throw new EnterpriseSalesValidationError("Invoice is already linked to another Enterprise payment");
    }

    const customer = await provisionLockedCustomer(connection, enterpriseRequest);
    const [invoices] = await connection.execute<any[]>(
      `SELECT id, customer_uid, status FROM billing_invoices WHERE id = ? FOR UPDATE`,
      [payment.invoice_id],
    );
    const invoice = invoices[0];
    if (!invoice || !invoiceBelongsToCustomer(invoice.customer_uid, customer.customerUid)) {
      throw new EnterpriseSalesValidationError("Linked invoice does not belong to the Enterprise customer");
    }
    if (["void", "refunded"].includes(invoice.status)) {
      throw new EnterpriseSalesValidationError("Linked invoice cannot be activated");
    }

    await connection.execute(
      "UPDATE users SET status = 'Active', email_verified = TRUE WHERE id = ?",
      [customer.userId],
    );
    // plan_id mirrored below after we know final subscription status (preserve pause)

    const isReplay = isActivationReplay({
      status: payment.status,
      subscriptionId: payment.subscription_id,
      contractId: payment.contract_id,
    });

    const [existingActiveSubs] = await connection.execute<any[]>(
      `SELECT id, status FROM customer_subscriptions
        WHERE customer_uid = ? AND status IN ('active', 'paused', 'past_due', 'grace')
        FOR UPDATE`,
      [customer.customerUid],
    );
    const hasLiveSubscription = Boolean(existingActiveSubs[0] || (isReplay && payment.subscription_id));
    const firstActivation = !hasLiveSubscription && !isReplay;
    let nextSubscriptionStatus: string = existingActiveSubs[0]?.status === "paused" ? "paused" : "active";

    let subscriptionId = Number(payment.subscription_id || existingActiveSubs[0]?.id || 0);
    if (isReplay) {
      const [linkedSubscriptions] = await connection.execute<any[]>(
        "SELECT id, customer_uid, status FROM customer_subscriptions WHERE id = ? FOR UPDATE",
        [subscriptionId],
      );
      if (linkedSubscriptions[0]?.customer_uid !== customer.customerUid) {
        throw new EnterpriseSalesValidationError("Paid payment has an invalid subscription link");
      }
      nextSubscriptionStatus = linkedSubscriptions[0]?.status === "paused" ? "paused" : "active";
      await connection.execute(
        `UPDATE customer_subscriptions
            SET plan_id = ?, status = IF(status = 'paused', 'paused', 'active'), cancel_at_period_end = 0,
                billing_period = ?, provider = 'manual_enterprise',
                provider_subscription_id = NULL, cancelled_at = NULL, grace_ends_at = NULL
          WHERE id = ?`,
        [plan.custom_plan_uid, quote.billing_cycle, subscriptionId],
      );
    } else if (hasLiveSubscription && subscriptionId) {
      nextSubscriptionStatus = existingActiveSubs[0]?.status === "paused" ? "paused" : "active";
      await connection.execute(
        `UPDATE customer_subscriptions
            SET plan_id = ?, status = IF(status = 'paused', 'paused', 'active'),
                cancel_at_period_end = 0, billing_period = ?, provider = 'manual_enterprise',
                cancelled_at = NULL, grace_ends_at = NULL
          WHERE id = ?`,
        [plan.custom_plan_uid, quote.billing_cycle, subscriptionId],
      );
    } else {
      nextSubscriptionStatus = "active";
      const periodSql = quote.billing_cycle === "yearly"
        ? "DATE_ADD(NOW(), INTERVAL 1 YEAR)"
        : "DATE_ADD(NOW(), INTERVAL 1 MONTH)";
      await connection.execute(
        `INSERT INTO customer_subscriptions
          (customer_uid, plan_id, status, current_period_start, current_period_end,
           cancel_at_period_end, billing_period, provider)
         VALUES (?, ?, 'active', NOW(), ${periodSql}, 0, ?, 'manual_enterprise')
         ON DUPLICATE KEY UPDATE
           id = LAST_INSERT_ID(id), plan_id = VALUES(plan_id),
           status = IF(status = 'paused', 'paused', 'active'),
           current_period_start = VALUES(current_period_start),
           current_period_end = VALUES(current_period_end), cancel_at_period_end = 0,
           billing_period = VALUES(billing_period), provider = VALUES(provider),
           provider_subscription_id = NULL, cancelled_at = NULL, grace_ends_at = NULL`,
        [customer.customerUid, plan.custom_plan_uid, quote.billing_cycle],
      );
      const [subscriptionRows] = await connection.execute<any[]>(
        "SELECT id, status FROM customer_subscriptions WHERE customer_uid = ? FOR UPDATE",
        [customer.customerUid],
      );
      subscriptionId = Number(subscriptionRows[0]?.id);
      if (subscriptionRows[0]?.status === "paused") nextSubscriptionStatus = "paused";
    }
    if (!subscriptionId) throw new Error("Enterprise subscription activation failed");

    // Keep customers.status in sync with subscription (paused → Suspended)
    const customerMirrorStatus = nextSubscriptionStatus === "paused" ? "Suspended" : "Active";
    await connection.execute(
      "UPDATE customers SET status = ?, plan_id = ? WHERE id = ?",
      [customerMirrorStatus, plan.custom_plan_uid, customer.customerId],
    );

    const [contracts] = payment.contract_id
      ? await connection.execute<any[]>(
        "SELECT id, contract_uid FROM enterprise_contracts WHERE id = ? AND request_id = ? FOR UPDATE",
        [payment.contract_id, enterpriseRequest.id],
      )
      : await connection.execute<any[]>(
        `SELECT id, contract_uid FROM enterprise_contracts
          WHERE request_id = ? AND status IN ('active', 'draft')
          ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [enterpriseRequest.id],
      );
    let contractId: number;
    let contractUid: string;
    if (contracts[0]) {
      contractId = Number(contracts[0].id);
      contractUid = contracts[0].contract_uid;
      await connection.execute(
        `UPDATE enterprise_contracts
            SET customer_id = ?, custom_plan_id = ?, subscription_id = ?, status = 'active',
                created_by_admin_id = COALESCE(created_by_admin_id, ?)
          WHERE id = ?`,
        [customer.customerId, plan.id, subscriptionId, details.adminId ?? null, contractId],
      );
    } else {
      contractUid = publicUid("ec");
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO enterprise_contracts
          (contract_uid, request_id, customer_id, custom_plan_id, subscription_id,
           starts_on, expires_on, status, created_by_admin_id)
         VALUES (?, ?, ?, ?, ?, CURDATE(),
           ${quote.billing_cycle === "yearly" ? "DATE_ADD(CURDATE(), INTERVAL 1 YEAR)" : "DATE_ADD(CURDATE(), INTERVAL 1 MONTH)"},
           'active', ?)`,
        [
          contractUid,
          enterpriseRequest.id,
          customer.customerId,
          plan.id,
          subscriptionId,
          details.adminId ?? null,
        ],
      );
      contractId = Number(result.insertId);
    }

    const effectivePayment = effectiveActivationPaymentDetails(
      {
        status: payment.status,
        transactionId: payment.transaction_id,
        paymentMethod: payment.payment_method,
        paidAt: payment.paid_at,
      },
      { transactionId, paymentMethod, paidAt },
    );
    const paidAtForDb =
      effectivePayment.paidAt instanceof Date
        ? effectivePayment.paidAt.toISOString().slice(0, 19).replace("T", " ")
        : paidAtMysql;
    await connection.execute(
      `UPDATE billing_invoices
          SET subscription_id = ?, plan_id = ?, period = ?, status = 'paid', paid_at = ?
        WHERE id = ?`,
      [subscriptionId, plan.custom_plan_uid, quote.billing_cycle, paidAtForDb, payment.invoice_id],
    );
    await connection.execute(
      `UPDATE enterprise_payments
          SET status = 'paid', transaction_id = ?, payment_method = ?, paid_at = ?,
              subscription_id = ?, contract_id = ?
        WHERE id = ?`,
      [
        effectivePayment.transactionId,
        effectivePayment.paymentMethod,
        paidAtForDb,
        subscriptionId,
        contractId,
        payment.id,
      ],
    );
    await connection.execute(
      "UPDATE enterprise_requests SET customer_id = ?, status = 'active' WHERE id = ?",
      [customer.customerId, enterpriseRequest.id],
    );

    const newPaidTotal = alreadyPaidPaise + Number(payment.amount_paise);
    const collectionStatus = newPaidTotal >= Number(quote.price_paise) ? "paid" as const
      : newPaidTotal > 0 ? "partial" as const
      : "unpaid" as const;
    await connection.execute(
      "UPDATE enterprise_quotes SET paid_paise = ?, collection_status = ? WHERE id = ?",
      [newPaidTotal, collectionStatus, quote.id],
    );

    if (!isReplay) {
      await connection.execute(
        `INSERT INTO enterprise_notes (note_uid, request_id, admin_id, event_type, body)
         VALUES (?, ?, ?, 'payment', ?)`,
        [
          publicUid("en"),
          enterpriseRequest.id,
          details.adminId ?? null,
          firstActivation
            ? `Enterprise account activated from first installment ${paymentUid} (${(Number(payment.amount_paise) / 100).toFixed(2)}); contract ${contractUid}; collection ${collectionStatus}`
            : `Installment ${paymentUid} recorded (${(Number(payment.amount_paise) / 100).toFixed(2)}); collection ${collectionStatus}`,
        ],
      );
    }

    await connection.commit();
    return {
      activated: true,
      alreadyActivated: payment.status === "paid",
      firstActivation,
      collectionStatus,
      paidPaise: newPaidTotal,
      remainingPaise: remainingBalancePaise(Number(quote.price_paise), newPaidTotal),
      ...customer,
      subscriptionId,
      contractUid,
      activationEmailSent: Boolean(enterpriseRequest.activation_email_sent_at),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markEnterpriseActivationEmailSent(requestUid: string) {
  await query(
    "UPDATE enterprise_requests SET activation_email_sent_at = COALESCE(activation_email_sent_at, NOW()) WHERE request_uid = ?",
    [requestUid],
  );
}
