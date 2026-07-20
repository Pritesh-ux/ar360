import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import { createCustomerUid, createProductUid } from "@/lib/uid";
import { resolveStorageRoot, STORAGE_PUBLIC_PREFIX } from "@/lib/storage/paths";

export type CustomerRecord = {
  customerUid: string;
  userId?: string;
  name?: string;
  email?: string;
  folderPath: string;
  publicFolder: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductRecord = {
  productUid: string;
  customerUid: string;
  title: string;
  category?: string;
  folderPath: string;
  publicFolder: string;
  modelUrl?: string;
  fileName?: string;
  usdzUrl?: string;
  usdzFileName?: string;
  qrUrl?: string;
  poster?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_PUBLIC_ROOT = STORAGE_PUBLIC_PREFIX;

function getStorageRoot() {
  return resolveStorageRoot();
}

function getIndexFile() {
  return path.join(getStorageRoot(), "customers.index.json");
}

type CustomerIndex = Record<string, CustomerRecord>;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export function getCustomerFolder(customerUid: string) {
  return path.join(getStorageRoot(), customerUid);
}

export function getProductFolder(customerUid: string, productUid: string) {
  return path.join(getCustomerFolder(customerUid), "Products", productUid);
}

export function getCustomerPublicFolder(customerUid: string) {
  return `${STORAGE_PUBLIC_ROOT}/${customerUid}`;
}

export function getProductPublicFolder(customerUid: string, productUid: string) {
  return `${getCustomerPublicFolder(customerUid)}/Products/${productUid}`;
}

export async function ensureCustomerFolder(input: {
  userId?: string;
  name?: string;
  email?: string;
  customerUid?: string;
}) {
  await ensureDir(getStorageRoot());

  const index = await readJson<CustomerIndex>(getIndexFile(), {});
  const normalizedEmail = input.email?.toLowerCase();
  const existing = Object.values(index).find((item) => {
    if (input.customerUid && item.customerUid === input.customerUid) return true;
    if (input.userId && item.userId === input.userId) return true;
    if (normalizedEmail && item.email?.toLowerCase() === normalizedEmail) return true;
    return false;
  });

  const now = new Date().toISOString();
  const customerUid = existing?.customerUid || input.customerUid || createCustomerUid();
  const folderPath = getCustomerFolder(customerUid);
  const publicFolder = getCustomerPublicFolder(customerUid);

  await ensureDir(path.join(folderPath, "Products"));

  const customer: CustomerRecord = {
    customerUid,
    userId: input.userId || existing?.userId,
    name: input.name || existing?.name || "Demo Customer",
    email: normalizedEmail || existing?.email,
    folderPath,
    publicFolder,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  index[customerUid] = customer;
  await writeJson(getIndexFile(), index);
  await writeJson(path.join(folderPath, "customer.json"), customer);

  return customer;
}

export async function createProductFolder(input: {
  customerUid: string;
  title: string;
  category?: string;
  productUid?: string;
}) {
  const productUid = input.productUid || createProductUid();
  const folderPath = getProductFolder(input.customerUid, productUid);
  const publicFolder = getProductPublicFolder(input.customerUid, productUid);
  const now = new Date().toISOString();

  await ensureDir(folderPath);

  const product: ProductRecord = {
    productUid,
    customerUid: input.customerUid,
    title: input.title,
    category: input.category || "Uncategorized",
    folderPath,
    publicFolder,
    createdAt: now,
    updatedAt: now,
  };

  await writeJson(path.join(folderPath, "product.json"), product);

  return product;
}

export async function saveFileToProduct(input: {
  customerUid: string;
  productUid: string;
  fileName: string;
  data: Buffer;
}) {
  const folderPath = getProductFolder(input.customerUid, input.productUid);
  await ensureDir(folderPath);
  const diskPath = path.join(folderPath, input.fileName);
  await fs.writeFile(diskPath, input.data);
  return `${getProductPublicFolder(input.customerUid, input.productUid)}/${input.fileName}`;
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

export async function saveDataUrlToProduct(input: {
  customerUid: string;
  productUid: string;
  fileName: string;
  dataUrl?: string;
}) {
  if (!input.dataUrl) return "";
  const buffer = dataUrlToBuffer(input.dataUrl);
  if (!buffer) return "";
  return saveFileToProduct({
    customerUid: input.customerUid,
    productUid: input.productUid,
    fileName: input.fileName,
    data: buffer,
  });
}

export async function saveQrPng(input: {
  customerUid: string;
  productUid: string;
  destination: string;
}) {
  const png = await QRCode.toBuffer(input.destination, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  return saveFileToProduct({
    customerUid: input.customerUid,
    productUid: input.productUid,
    fileName: "qr.png",
    data: png,
  });
}

export async function updateProductJson(input: {
  customerUid: string;
  productUid: string;
  patch: Partial<ProductRecord> & Record<string, unknown>;
}) {
  const file = path.join(getProductFolder(input.customerUid, input.productUid), "product.json");
  const existing = await readJson<ProductRecord | Record<string, unknown>>(file, {});
  const next = {
    ...existing,
    ...input.patch,
    customerUid: input.customerUid,
    productUid: input.productUid,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(file, next);
  return next;
}
