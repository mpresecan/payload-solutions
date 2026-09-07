/**
 * Media storage adapters the CLI offers: every adapter Payload ships for Node hosts
 * (https://payloadcms.com/docs/upload/storage-adapters). `@payloadcms/storage-r2` is left out on
 * purpose: it needs a Cloudflare Workers bucket binding, and the template runs Next.js on Node.
 * Cloudflare R2 is offered through its S3-compatible API instead, as Payload documents.
 *
 * Every adapter is written into payload.config.ts behind an `if (env.<VAR>)` guard, so a project
 * without the variables keeps writing uploads to local disk (./media). Nothing is added to the
 * database schema either way, so switching adapters needs no migration.
 */
export type StorageAdapterKey = 'vercel-blob' | 's3' | 'r2' | 'azure' | 'gcs' | 'uploadthing'
/** `none` keeps uploads on local disk. */
export type StorageKey = StorageAdapterKey | 'none'

export interface StorageChoice {
  key: StorageAdapterKey
  label: string
  hint?: string
  /** npm package of the Payload adapter. */
  packageName: string
  /** Named export of the adapter factory. */
  importName: string
  /** Whether the rendered config calls `requireEnv` from '@/lib/env' (imported alongside `env`). */
  usesRequireEnv: boolean
  /** Variables the user has to set in .env before uploads leave local disk. Shown in "next steps". */
  envVars: string[]
  /** Top-level statements written between the storage-adapter markers of payload.config.ts. */
  config: string
}

/** What the markers hold when no adapter is chosen. Identical to the template so the swap is repeatable. */
export const LOCAL_STORAGE_CONFIG = `// Local disk (./media): fine for development, lost on redeploy on Vercel and other ephemeral hosts.
// Move uploads to Vercel Blob, S3, R2, Azure, GCS or Uploadthing: https://payload.solutions/docs/payload-stack/storage`

export const STORAGE_CHOICES: Record<StorageAdapterKey, StorageChoice> = {
  'vercel-blob': {
    key: 'vercel-blob',
    label: 'Vercel Blob',
    hint: 'needs BLOB_READ_WRITE_TOKEN',
    packageName: '@payloadcms/storage-vercel-blob',
    importName: 'vercelBlobStorage',
    usesRequireEnv: false,
    envVars: ['BLOB_READ_WRITE_TOKEN'],
    config: `// Vercel Blob. Without BLOB_READ_WRITE_TOKEN uploads stay on local disk (./media).
if (env.BLOB_READ_WRITE_TOKEN) {
  plugins.push(
    vercelBlobStorage({
      collections: { media: true },
      token: env.BLOB_READ_WRITE_TOKEN,
      // Vercel functions accept request bodies up to 4.5 MB. For larger files upload from the
      // browser instead: set clientUploads: true and run pnpm generate:importmap.
      // clientUploads: true,
    }),
  )
}`,
  },
  s3: {
    key: 's3',
    label: 'AWS S3',
    hint: 'or S3-compatible: MinIO, DigitalOcean Spaces, Backblaze B2',
    packageName: '@payloadcms/storage-s3',
    importName: 's3Storage',
    usesRequireEnv: false,
    envVars: ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
    config: `// AWS S3, or any S3-compatible service. Without S3_BUCKET uploads stay on local disk (./media).
if (env.S3_BUCKET) {
  plugins.push(
    s3Storage({
      collections: { media: true },
      bucket: env.S3_BUCKET,
      config: {
        region: env.S3_REGION,
        // Leave the keys unset to use the AWS default credential chain (IAM roles, profiles).
        credentials:
          env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
            ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
            : undefined,
        // MinIO, DigitalOcean Spaces, Backblaze B2 and other S3-compatible services: set S3_ENDPOINT.
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: Boolean(env.S3_ENDPOINT),
      },
    }),
  )
}`,
  },
  r2: {
    key: 'r2',
    label: 'Cloudflare R2',
    hint: 'through the S3 API; needs R2_BUCKET, R2_ENDPOINT and keys',
    packageName: '@payloadcms/storage-s3',
    importName: 's3Storage',
    usesRequireEnv: true,
    envVars: ['R2_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
    config: `// Cloudflare R2 through its S3-compatible API. Without R2_BUCKET uploads stay on local disk (./media).
if (env.R2_BUCKET) {
  plugins.push(
    s3Storage({
      collections: {
        media: env.R2_PUBLIC_URL
          ? {
              // Serve files from the bucket's public URL or custom domain instead of through Payload.
              disablePayloadAccessControl: true,
              generateFileURL: ({ filename, prefix }) =>
                \`\${env.R2_PUBLIC_URL}/\${prefix ? \`\${prefix}/\${filename}\` : filename}\`,
            }
          : true,
      },
      bucket: env.R2_BUCKET,
      config: {
        credentials: {
          accessKeyId: requireEnv('R2_ACCESS_KEY_ID', 'for Cloudflare R2'),
          secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY', 'for Cloudflare R2'),
        },
        // R2 requires region "auto" and path-style addressing.
        region: 'auto',
        endpoint: requireEnv('R2_ENDPOINT', 'for Cloudflare R2'),
        forcePathStyle: true,
      },
    }),
  )
}`,
  },
  azure: {
    key: 'azure',
    label: 'Azure Blob Storage',
    hint: 'needs AZURE_STORAGE_CONNECTION_STRING, container name and base URL',
    packageName: '@payloadcms/storage-azure',
    importName: 'azureStorage',
    usesRequireEnv: true,
    envVars: ['AZURE_STORAGE_CONNECTION_STRING', 'AZURE_STORAGE_CONTAINER_NAME', 'AZURE_STORAGE_ACCOUNT_BASEURL'],
    config: `// Azure Blob Storage. Without AZURE_STORAGE_CONNECTION_STRING uploads stay on local disk (./media).
if (env.AZURE_STORAGE_CONNECTION_STRING) {
  plugins.push(
    azureStorage({
      collections: { media: true },
      connectionString: env.AZURE_STORAGE_CONNECTION_STRING,
      containerName: requireEnv('AZURE_STORAGE_CONTAINER_NAME', 'for Azure Blob Storage'),
      baseURL: requireEnv('AZURE_STORAGE_ACCOUNT_BASEURL', 'for Azure Blob Storage'),
      allowContainerCreate: env.AZURE_STORAGE_ALLOW_CONTAINER_CREATE === 'true',
    }),
  )
}`,
  },
  gcs: {
    key: 'gcs',
    label: 'Google Cloud Storage',
    hint: 'needs GCS_BUCKET and service-account credentials',
    packageName: '@payloadcms/storage-gcs',
    importName: 'gcsStorage',
    usesRequireEnv: false,
    envVars: ['GCS_BUCKET', 'GCS_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS or GCS_SERVICE_ACCOUNT_KEY'],
    config: `// Google Cloud Storage. Without GCS_BUCKET uploads stay on local disk (./media).
if (env.GCS_BUCKET) {
  plugins.push(
    gcsStorage({
      collections: { media: true },
      bucket: env.GCS_BUCKET,
      options: {
        projectId: env.GCS_PROJECT_ID,
        // Locally, point GOOGLE_APPLICATION_CREDENTIALS at a service-account key file. On hosts
        // without a filesystem, paste the key's JSON into GCS_SERVICE_ACCOUNT_KEY instead.
        credentials: env.GCS_SERVICE_ACCOUNT_KEY ? JSON.parse(env.GCS_SERVICE_ACCOUNT_KEY) : undefined,
      },
    }),
  )
}`,
  },
  uploadthing: {
    key: 'uploadthing',
    label: 'Uploadthing',
    hint: 'needs UPLOADTHING_TOKEN',
    packageName: '@payloadcms/storage-uploadthing',
    importName: 'uploadthingStorage',
    usesRequireEnv: false,
    envVars: ['UPLOADTHING_TOKEN'],
    config: `// Uploadthing. Without UPLOADTHING_TOKEN uploads stay on local disk (./media).
if (env.UPLOADTHING_TOKEN) {
  plugins.push(
    uploadthingStorage({
      collections: { media: true },
      options: {
        token: env.UPLOADTHING_TOKEN,
        acl: 'public-read',
      },
    }),
  )
}`,
  },
}

export const STORAGE_ADAPTER_KEYS = Object.keys(STORAGE_CHOICES) as StorageAdapterKey[]
export const STORAGE_KEYS: StorageKey[] = ['none', ...STORAGE_ADAPTER_KEYS]

/** Storage packages the CLI knows about, so a swap can remove the previous one. */
export const STORAGE_PACKAGES = [...new Set(Object.values(STORAGE_CHOICES).map((c) => c.packageName))]
