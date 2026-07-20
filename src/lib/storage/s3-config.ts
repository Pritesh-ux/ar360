export type S3ClientConfig = {
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
};

export function resolveS3Config() {
  const bucket = process.env.AWS_S3_BUCKET?.trim() || "";
  const region = process.env.AWS_REGION?.trim() || "ap-south-1";
  const endpoint = process.env.AWS_ENDPOINT_URL?.trim() || process.env.AWS_S3_ENDPOINT?.trim() || "";
  const forcePathStyle =
    String(process.env.AWS_S3_FORCE_PATH_STYLE || "").toLowerCase() === "true" || Boolean(endpoint);

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() || "";

  const clientConfig: S3ClientConfig = {
    region,
    ...(endpoint ? { endpoint, forcePathStyle } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  };

  return { bucket, region, clientConfig };
}

export async function createS3Client() {
  const { clientConfig } = resolveS3Config();
  const s3Module = await import("@aws-sdk/client-s3");
  return new s3Module.S3Client(clientConfig);
}

export async function verifyS3BucketAccess(): Promise<{ ok: boolean; detail?: string }> {
  const { bucket } = resolveS3Config();
  if (!bucket) {
    return { ok: false, detail: "AWS_S3_BUCKET missing" };
  }

  try {
    const s3Module = await import("@aws-sdk/client-s3");
    const client = await createS3Client();
    await client.send(new s3Module.HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, detail: bucket };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "S3 head bucket failed",
    };
  }
}
