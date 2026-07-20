import path from "path";
import { getPublicFileUrl } from "@/lib/storage";
import { toCdnAssetUrl } from "@/lib/billing/asset-url";
import { createS3Client, resolveS3Config } from "@/lib/storage/s3-config";
import type { StorageAdapter, StorageWriteInput } from "@/lib/storage/adapter";

function s3ObjectKey(customerUid: string, productUid: string, fileName: string): string {
  const safeName = path.basename(fileName);
  return `Customers/${customerUid}/Products/${productUid}/${safeName}`;
}

function guessContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".usdz": "model/vnd.usdz+zip",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".json": "application/json",
  };
  return map[ext] || "application/octet-stream";
}

class S3StorageAdapter implements StorageAdapter {
  readonly backend = "s3" as const;

  constructor(
    private bucket: string,
    private s3Module: typeof import("@aws-sdk/client-s3"),
  ) {}

  private client() {
    return createS3Client();
  }

  async write(input: StorageWriteInput): Promise<string> {
    const key = s3ObjectKey(input.customerUid, input.productUid, input.fileName);
    const { PutObjectCommand } = this.s3Module;
    const client = await this.client();

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.data,
        ContentType: guessContentType(input.fileName),
      }),
    );

    const relative = getPublicFileUrl(input.customerUid, input.productUid, input.fileName);
    return toCdnAssetUrl(relative);
  }

  async deleteProductFolder(customerUid: string, productUid: string): Promise<void> {
    const prefix = `Customers/${customerUid}/Products/${productUid}/`;
    const { ListObjectsV2Command, DeleteObjectsCommand } = this.s3Module;
    const client = await this.client();

    let continuationToken: string | undefined;
    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (listed.Contents || [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key));

      if (keys.length) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }
}

export async function createS3StorageAdapter(): Promise<StorageAdapter> {
  const { bucket } = resolveS3Config();

  if (!bucket) {
    throw new Error(
      "STORAGE_BACKEND=s3 requires AWS_S3_BUCKET. Set STORAGE_BACKEND=local for disk storage.",
    );
  }

  let s3Module: typeof import("@aws-sdk/client-s3");
  try {
    s3Module = await import("@aws-sdk/client-s3");
  } catch {
    throw new Error(
      "S3 storage requires @aws-sdk/client-s3. Run: npm install @aws-sdk/client-s3",
    );
  }

  return new S3StorageAdapter(bucket, s3Module);
}
