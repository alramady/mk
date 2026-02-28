/**
 * Storage Abstraction Layer
 * Supports two backends:
 *   1. S3-compatible (Cloudflare R2, AWS S3, MinIO, etc.) — RECOMMENDED for production
 *   2. Local filesystem — fallback with admin warning on Railway
 *
 * Backend is auto-selected based on environment variables.
 * If S3_BUCKET + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY are set → S3 mode
 * Otherwise → Local mode with warning
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ENV } from "./_core/env";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// ─── Configuration ──────────────────────────────────────────────────────────

interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  publicBaseUrl: string; // CDN or public R2 URL
}

function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint: process.env.S3_ENDPOINT || "",
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION || "auto",
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
  };
}

let _s3Client: S3Client | null = null;
let _s3Config: S3Config | null = null;
let _storageMode: "s3" | "local" | null = null;

function getS3Client(): S3Client | null {
  if (_storageMode === "local") return null;

  if (_s3Client) return _s3Client;

  const config = getS3Config();
  if (!config) {
    _storageMode = "local";
    return null;
  }

  try {
    const clientConfig: any = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = true; // Required for R2/MinIO
    }

    _s3Client = new S3Client(clientConfig);
    _s3Config = config;
    _storageMode = "s3";
    console.log(`[Storage] S3 mode active → bucket: ${config.bucket}, endpoint: ${config.endpoint || "AWS default"}`);
    return _s3Client;
  } catch (err) {
    console.error("[Storage] Failed to initialize S3 client:", err);
    _storageMode = "local";
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the current storage mode: "s3" or "local"
 */
export function getStorageMode(): "s3" | "local" {
  if (_storageMode) return _storageMode;
  getS3Client(); // triggers detection
  return _storageMode || "local";
}

/**
 * Returns true if S3 is configured and active
 */
export function isS3Configured(): boolean {
  return getStorageMode() === "s3";
}

/**
 * Returns storage health info for admin display
 */
export function getStorageInfo(): {
  mode: "s3" | "local";
  configured: boolean;
  bucket?: string;
  endpoint?: string;
  publicBaseUrl?: string;
  warning?: string;
} {
  const mode = getStorageMode();
  if (mode === "s3" && _s3Config) {
    return {
      mode: "s3",
      configured: true,
      bucket: _s3Config.bucket,
      endpoint: _s3Config.endpoint || "AWS S3",
      publicBaseUrl: _s3Config.publicBaseUrl || "(auto)",
    };
  }
  return {
    mode: "local",
    configured: false,
    warning:
      "التخزين المحلي نشط. الملفات المرفوعة لن تبقى بعد إعادة نشر Railway. يرجى تكوين S3/R2 في التكاملات. | Local storage active. Uploaded files will NOT persist after Railway redeploy. Please configure S3/R2 in Integrations.",
  };
}

/**
 * Test S3 connection by writing and deleting a test object
 */
export async function testS3Connection(config?: {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}): Promise<{ success: boolean; message: string }> {
  const cfg = config || getS3Config();
  if (!cfg) {
    return { success: false, message: "S3 credentials not configured" };
  }

  try {
    const clientConfig: any = {
      region: cfg.region || "auto",
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    };
    if (cfg.endpoint) {
      clientConfig.endpoint = cfg.endpoint;
      clientConfig.forcePathStyle = true;
    }

    const testClient = new S3Client(clientConfig);
    const testKey = `_mk-connection-test-${Date.now()}.txt`;

    // Write test object
    await testClient.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: testKey,
        Body: "MK Storage Connection Test",
        ContentType: "text/plain",
      })
    );

    // Delete test object
    await testClient.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: testKey,
      })
    );

    return { success: true, message: `Connected to bucket "${cfg.bucket}" successfully` };
  } catch (err: any) {
    return {
      success: false,
      message: `S3 connection failed: ${err.message || String(err)}`,
    };
  }
}

/**
 * Reload S3 client (call after admin updates credentials)
 */
export function reloadS3Client(): void {
  _s3Client = null;
  _s3Config = null;
  _storageMode = null;
  console.log("[Storage] S3 client reset — will re-detect on next operation");
}

// ─── Core Storage Operations ────────────────────────────────────────────────

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

// Local filesystem helpers
function getUploadDir(): string {
  const dir = path.resolve(ENV.uploadDir || "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getPublicBaseUrl(): string {
  if (ENV.publicUrl) return ENV.publicUrl.replace(/\/+$/, "");
  return "";
}

/**
 * Store a file and return its public URL
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  const s3 = getS3Client();

  if (s3 && _s3Config) {
    // ─── S3 Mode ──────────────────────────────────────────────────────
    await s3.send(
      new PutObjectCommand({
        Bucket: _s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    let url: string;
    if (_s3Config.publicBaseUrl) {
      url = `${_s3Config.publicBaseUrl}/${key}`;
    } else {
      // Construct URL from endpoint + bucket
      url = _s3Config.endpoint
        ? `${_s3Config.endpoint}/${_s3Config.bucket}/${key}`
        : `https://${_s3Config.bucket}.s3.${_s3Config.region}.amazonaws.com/${key}`;
    }

    console.log(`[Storage:S3] Uploaded: ${key} (${buffer.length} bytes)`);
    return { key, url };
  }

  // ─── Local Mode ───────────────────────────────────────────────────
  const uploadDir = getUploadDir();
  const fullPath = path.join(uploadDir, key);
  const dirPath = path.dirname(fullPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(fullPath, buffer);

  // Always use relative URL for local mode — avoids domain mismatch after Railway redeploys
  const url = `/uploads/${key}`;

  console.log(`[Storage:Local] Saved: ${key} (${buffer.length} bytes) ⚠️ EPHEMERAL`);
  return { key, url };
}

/**
 * Get a file's public URL
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (_storageMode === "s3" && _s3Config) {
    let url: string;
    if (_s3Config.publicBaseUrl) {
      url = `${_s3Config.publicBaseUrl}/${key}`;
    } else {
      url = _s3Config.endpoint
        ? `${_s3Config.endpoint}/${_s3Config.bucket}/${key}`
        : `https://${_s3Config.bucket}.s3.${_s3Config.region}.amazonaws.com/${key}`;
    }
    return { key, url };
  }

  // Always use relative URL for local mode — avoids domain mismatch after Railway redeploys
  const url = `/uploads/${key}`;
  return { key, url };
}

/**
 * Delete a file from storage
 */
export async function storageDelete(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);

  try {
    const s3 = getS3Client();
    if (s3 && _s3Config) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: _s3Config.bucket,
          Key: key,
        })
      );
      console.log(`[Storage:S3] Deleted: ${key}`);
      return true;
    }

    // Local fallback
    const uploadDir = getUploadDir();
    const fullPath = path.join(uploadDir, key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`[Storage:Local] Deleted: ${key}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("[Storage] Delete error:", error);
    return false;
  }
}

/**
 * Check if a file exists in storage
 */
export async function storageExists(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);

  try {
    const s3 = getS3Client();
    if (s3 && _s3Config) {
      await s3.send(
        new HeadObjectCommand({
          Bucket: _s3Config.bucket,
          Key: key,
        })
      );
      return true;
    }

    const uploadDir = getUploadDir();
    const fullPath = path.join(uploadDir, key);
    return fs.existsSync(fullPath);
  } catch {
    return false;
  }
}

/**
 * Generate a unique filename
 */
export function generateUniqueKey(prefix: string, extension: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `${prefix}/${timestamp}-${random}.${extension.replace(/^\./, "")}`;
}
