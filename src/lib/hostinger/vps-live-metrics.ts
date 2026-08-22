import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type LiveMetricsSource = "hostinger_api" | "vps_disk" | "unavailable";

export type HostingerVpsLiveMetrics = {
  source: LiveMetricsSource;
  hostname: string | null;
  vmId: string | null;
  plan: string | null;
  /** Absolute disk used on the VPS (bytes). */
  diskUsedBytes: number;
  /** Absolute disk total / capacity (bytes). */
  diskTotalBytes: number;
  diskFreeBytes: number;
  diskUsedPct: number;
  /** Monthly (or window) network transfer — inbound + outbound when known. */
  bandwidthUsedBytes: number | null;
  bandwidthLimitBytes: number | null;
  bandwidthUsedPct: number | null;
  /** ISO timestamp of the sample. */
  sampledAt: string;
  notes: string[];
};

type MetricSeries = {
  unit?: string;
  usage?: Record<string, number>;
};

type MetricsPayload = {
  disk_space?: MetricSeries;
  incoming_traffic?: MetricSeries;
  outgoing_traffic?: MetricSeries;
};

type VmInfo = {
  id?: number | string;
  hostname?: string;
  plan?: string;
  disk?: number; // MB
  ipv4?: Array<{ address?: string }>;
};

let cache: { at: number; value: HostingerVpsLiveMetrics } | null = null;
const CACHE_TTL_MS = 30_000;

function bytesToTb(bytes: number) {
  return bytes / 1024 ** 4;
}

export function liveBytesToTb(bytes: number) {
  return Number(bytesToTb(Math.max(0, bytes)).toFixed(6));
}

function latestSeriesValue(series?: MetricSeries): number | null {
  if (!series?.usage) return null;
  let maxTs = -1;
  let value: number | null = null;
  for (const [ts, raw] of Object.entries(series.usage)) {
    const t = Number(ts);
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    if (!Number.isFinite(t) || t >= maxTs) {
      maxTs = Number.isFinite(t) ? t : maxTs;
      value = v;
    }
  }
  return value;
}

function sumSeriesValues(series?: MetricSeries): number | null {
  if (!series?.usage) return null;
  let sum = 0;
  let count = 0;
  for (const raw of Object.values(series.usage)) {
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    sum += v;
    count += 1;
  }
  return count > 0 ? sum : null;
}

function hostingerBaseUrl() {
  const raw = (process.env.HOSTINGER_BASE_URL || "https://developers.hostinger.com").trim();
  if (raw.includes("/api/vps/v1")) return raw.replace(/\/$/, "");
  return `${raw.replace(/\/$/, "")}/api/vps/v1`;
}

function bandwidthLimitBytesFromEnv() {
  const gb = Number(process.env.HOSTINGER_BANDWIDTH_LIMIT_GB || process.env.PLATFORM_BANDWIDTH_LIMIT_GB || 4096);
  if (!Number.isFinite(gb) || gb <= 0) return 4096 * 1024 ** 3;
  return Math.round(gb * 1024 ** 3);
}

/** Map raw VPS disk size to Hostinger marketed plan size (e.g. ~48 GiB → 50 GB). */
export function normalizeHostingerDiskLimitGb(totalBytes: number) {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 50;
  const gib = totalBytes / 1024 ** 3;
  if (gib >= 40 && gib < 60) return 50;
  if (gib >= 90 && gib < 120) return 100;
  if (gib >= 180 && gib < 220) return 200;
  if (gib >= 350 && gib < 450) return 400;
  // Hostinger hPanel often shows decimal GB
  return Math.max(1, Math.round(totalBytes / 1_000_000_000));
}

export function normalizeHostingerBandwidthLimitGb(preferred?: number | null) {
  const fromEnv = Number(process.env.HOSTINGER_BANDWIDTH_LIMIT_GB || 0);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  if (preferred != null && Number.isFinite(preferred) && preferred > 0) return preferred;
  // KVM 1 typical Hostinger plan from hPanel
  return 4096;
}

async function readLocalDisk(mount = "/"): Promise<{
  usedBytes: number;
  totalBytes: number;
  freeBytes: number;
} | null> {
  if (process.platform === "win32") return null;
  try {
    const { stdout } = await execFileAsync("df", ["-B1", "--output=size,used,avail,target", mount], {
      timeout: 8000,
      maxBuffer: 1024 * 1024,
    });
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    // Skip header
    const data = lines.find((line) => line.startsWith("/") || /^\d/.test(line)) || lines[1];
    if (!data) return null;
    const parts = data.split(/\s+/);
    const totalBytes = Number(parts[0]);
    const usedBytes = Number(parts[1]);
    const freeBytes = Number(parts[2]);
    if (![totalBytes, usedBytes, freeBytes].every((n) => Number.isFinite(n) && n >= 0)) return null;
    return { usedBytes, totalBytes, freeBytes };
  } catch {
    // BusyBox / older df without --output
    try {
      const { stdout } = await execFileAsync("df", ["-B1", mount], { timeout: 8000 });
      const line = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l && !l.toLowerCase().startsWith("filesystem"));
      if (!line) return null;
      const parts = line.split(/\s+/);
      const totalBytes = Number(parts[1]);
      const usedBytes = Number(parts[2]);
      const freeBytes = Number(parts[3]);
      if (![totalBytes, usedBytes, freeBytes].every((n) => Number.isFinite(n) && n >= 0)) return null;
      return { usedBytes, totalBytes, freeBytes };
    } catch {
      return null;
    }
  }
}

async function hostingerFetch<T>(path: string, token: string): Promise<T | null> {
  const url = `${hostingerBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveVmId(token: string, explicitId: string | null): Promise<{
  vmId: string | null;
  info: VmInfo | null;
}> {
  if (explicitId) {
    const info = await hostingerFetch<VmInfo>(`/virtual-machines/${explicitId}`, token);
    return { vmId: explicitId, info };
  }

  const list = await hostingerFetch<VmInfo[] | { data?: VmInfo[] }>(`/virtual-machines`, token);
  const rows = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : [];
  if (!rows.length) return { vmId: null, info: null };

  const preferHost = (process.env.HOSTINGER_HOSTNAME || "").trim().toLowerCase();
  const preferIp = (process.env.HOSTINGER_SERVER_IP || process.env.SERVER_IP || "").trim();

  const matched =
    rows.find((vm) => preferHost && String(vm.hostname || "").toLowerCase() === preferHost) ||
    rows.find((vm) =>
      preferIp
        ? (vm.ipv4 || []).some((entry) => String(entry.address || "").trim() === preferIp)
        : false,
    ) ||
    rows.find((vm) => String(vm.hostname || "").toLowerCase().includes("srv1850719")) ||
    rows[0];

  return { vmId: matched?.id != null ? String(matched.id) : null, info: matched || null };
}

async function fetchHostingerMetrics(token: string, vmId: string): Promise<{
  diskUsedBytes: number | null;
  bandwidthUsedBytes: number | null;
  info: VmInfo | null;
}> {
  const info = await hostingerFetch<VmInfo>(`/virtual-machines/${vmId}`, token);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const dateFrom = monthStart.toISOString();
  const dateTo = now.toISOString();

  const metrics = await hostingerFetch<MetricsPayload>(
    `/virtual-machines/${vmId}/metrics?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
    token,
  );

  const diskUsed = latestSeriesValue(metrics?.disk_space);
  const inTraffic =
    sumSeriesValues(metrics?.incoming_traffic) ?? latestSeriesValue(metrics?.incoming_traffic);
  const outTraffic =
    sumSeriesValues(metrics?.outgoing_traffic) ?? latestSeriesValue(metrics?.outgoing_traffic);

  let bandwidthUsedBytes: number | null = null;
  if (inTraffic != null || outTraffic != null) {
    bandwidthUsedBytes = Math.max(0, (inTraffic || 0) + (outTraffic || 0));
  }

  return {
    diskUsedBytes: diskUsed != null && Number.isFinite(diskUsed) ? Math.max(0, diskUsed) : null,
    bandwidthUsedBytes,
    info,
  };
}

function emptyMetrics(notes: string[]): HostingerVpsLiveMetrics {
  return {
    source: "unavailable",
    hostname: null,
    vmId: null,
    plan: null,
    diskUsedBytes: 0,
    diskTotalBytes: 0,
    diskFreeBytes: 0,
    diskUsedPct: 0,
    bandwidthUsedBytes: null,
    bandwidthLimitBytes: bandwidthLimitBytesFromEnv(),
    bandwidthUsedPct: null,
    sampledAt: new Date().toISOString(),
    notes,
  };
}

/**
 * Live Hostinger / VPS storage + bandwidth for Master Admin Storage Manager.
 * Prefers Hostinger API when configured; always falls back to real `df` disk on Linux VPS.
 */
export async function getHostingerVpsLiveMetrics(options?: {
  force?: boolean;
}): Promise<HostingerVpsLiveMetrics> {
  const now = Date.now();
  if (!options?.force && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const notes: string[] = [];
  const token = (process.env.HOSTINGER_API_TOKEN || "").trim();
  const explicitVmId = (process.env.HOSTINGER_VM_ID || "").trim() || null;
  const bandwidthLimitBytes = bandwidthLimitBytesFromEnv();

  const localDisk = await readLocalDisk("/");
  let result = emptyMetrics(notes);

  if (localDisk) {
    const marketedTotalBytes = normalizeHostingerDiskLimitGb(localDisk.totalBytes) * 1024 ** 3;
    const usedBytes = localDisk.usedBytes;
    const totalBytes = Math.max(marketedTotalBytes, localDisk.totalBytes);
    const freeBytes = Math.max(0, totalBytes - usedBytes);
    result = {
      ...result,
      source: "vps_disk",
      hostname: process.env.HOSTINGER_HOSTNAME || null,
      diskUsedBytes: usedBytes,
      diskTotalBytes: totalBytes,
      diskFreeBytes: freeBytes,
      diskUsedPct:
        totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 1000) / 10) : 0,
      bandwidthLimitBytes,
      notes: [
        "Live Hostinger/VPS disk from server (matches hPanel Disk usage).",
        `Detected disk plan ~${normalizeHostingerDiskLimitGb(localDisk.totalBytes)} GB.`,
      ],
    };
  }

  if (token) {
    const { vmId, info: listedInfo } = await resolveVmId(token, explicitVmId);
    if (!vmId) {
      notes.push("Hostinger API token set but no VPS id found. Set HOSTINGER_VM_ID.");
    } else {
      const remote = await fetchHostingerMetrics(token, vmId);
      const info = remote.info || listedInfo;
      const diskTotalFromPlan =
        info?.disk && Number(info.disk) > 0 ? Math.round(Number(info.disk) * 1024 * 1024) : null;

      const diskTotalBytes = diskTotalFromPlan || result.diskTotalBytes || 0;
      const diskUsedBytes =
        remote.diskUsedBytes != null && remote.diskUsedBytes > 0
          ? remote.diskUsedBytes
          : result.diskUsedBytes;
      const diskFreeBytes = Math.max(0, diskTotalBytes - diskUsedBytes);
      const diskUsedPct =
        diskTotalBytes > 0 ? Math.min(100, Math.round((diskUsedBytes / diskTotalBytes) * 1000) / 10) : 0;

      const bandwidthUsedBytes = remote.bandwidthUsedBytes;
      const bandwidthUsedPct =
        bandwidthUsedBytes != null && bandwidthLimitBytes
          ? Math.min(100, Math.round((bandwidthUsedBytes / bandwidthLimitBytes) * 1000) / 10)
          : null;

      result = {
        source: "hostinger_api",
        hostname: info?.hostname || null,
        vmId,
        plan: info?.plan || null,
        diskUsedBytes,
        diskTotalBytes,
        diskFreeBytes,
        diskUsedPct,
        bandwidthUsedBytes,
        bandwidthLimitBytes,
        bandwidthUsedPct,
        sampledAt: new Date().toISOString(),
        notes: [
          "Live metrics from Hostinger VPS API.",
          localDisk ? "Disk cross-checked with server `df` when API disk sample missing." : "",
        ].filter(Boolean),
      };
    }
  } else if (result.source === "vps_disk") {
    result.notes.push(
      "Set HOSTINGER_API_TOKEN (+ HOSTINGER_VM_ID) for Hostinger panel bandwidth. Disk is already live from VPS.",
    );
  } else {
    result.notes.push(
      "Hostinger live metrics unavailable. Configure HOSTINGER_API_TOKEN on the VPS, or run Storage Manager on the server.",
    );
  }

  if (result.bandwidthLimitBytes == null && bandwidthLimitBytes != null) {
    result.bandwidthLimitBytes = bandwidthLimitBytes;
  }

  cache = { at: now, value: result };
  return result;
}

export type HostingerPlanDetectResult = {
  storageProvider: "Hostinger VPS";
  platformStorageLimitGb: number;
  platformBandwidthLimitGb: number;
  diskUsedGb: number;
  bandwidthUsedGb: number | null;
  hostname: string | null;
  plan: string | null;
  source: LiveMetricsSource;
  notes: string[];
};

/** Detect Hostinger VPS plan limits for Master Admin Storage Settings. */
export async function detectHostingerPlanLimits(): Promise<HostingerPlanDetectResult> {
  const live = await getHostingerVpsLiveMetrics({ force: true });
  const platformStorageLimitGb =
    live.diskTotalBytes > 0
      ? normalizeHostingerDiskLimitGb(live.diskTotalBytes)
      : 50;
  const platformBandwidthLimitGb = normalizeHostingerBandwidthLimitGb(
    live.bandwidthLimitBytes != null ? live.bandwidthLimitBytes / 1024 ** 3 : null,
  );
  return {
    storageProvider: "Hostinger VPS",
    platformStorageLimitGb,
    platformBandwidthLimitGb,
    diskUsedGb: Number((live.diskUsedBytes / 1024 ** 3).toFixed(2)),
    bandwidthUsedGb:
      live.bandwidthUsedBytes != null
        ? Number((live.bandwidthUsedBytes / 1024 ** 3).toFixed(3))
        : null,
    hostname: live.hostname,
    plan: live.plan,
    source: live.source,
    notes: live.notes,
  };
}
