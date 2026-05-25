import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { appEnv } from '@/envs/app';
import { fileEnv } from '@/envs/file';
import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { FileS3 } from '@/server/modules/S3';

// Supported file types for upload
const SUPPORTED_FILE_TYPES = {
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm'],
  document: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
};

const ALL_SUPPORTED_TYPES = Object.values(SUPPORTED_FILE_TYPES).flat();

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  audio: 100 * 1024 * 1024, // 100MB
  document: 100 * 1024 * 1024, // 100MB
  image: 50 * 1024 * 1024, // 50MB
  video: 500 * 1024 * 1024, // 500MB
};

const getFileCategory = (mimeType: string): keyof typeof FILE_SIZE_LIMITS | null => {
  for (const [category, types] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if (types.includes(mimeType)) {
      return category as keyof typeof FILE_SIZE_LIMITS;
    }
  }
  return null;
};

const privateHostPatterns = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

const getBrowserReachableS3Endpoint = () =>
  fileEnv.S3_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_S3_DOMAIN || fileEnv.S3_ENDPOINT;

const getBrowserUploadEndpointIssues = () => {
  const issues: string[] = [];
  const endpoint = getBrowserReachableS3Endpoint();

  if (!endpoint) return ['S3_ENDPOINT is missing.'];

  try {
    const endpointUrl = new URL(endpoint);
    const appUrl = new URL(appEnv.APP_URL);
    const productionLike = process.env.NODE_ENV === 'production' || appUrl.protocol === 'https:';

    if (productionLike && endpointUrl.protocol !== 'https:') {
      issues.push('S3_ENDPOINT must be HTTPS when the app is served over HTTPS.');
    }

    if (
      productionLike &&
      (privateHostPatterns.some((pattern) => pattern.test(endpointUrl.hostname)) ||
        !endpointUrl.hostname.includes('.'))
    ) {
      issues.push(
        'S3_ENDPOINT must be a public browser-reachable host, not an internal service name.',
      );
    }
  } catch {
    issues.push('S3_ENDPOINT must be a valid absolute URL.');
  }

  return issues;
};

export const uploadRouter = router({
  createS3PreSignedUrl: authedProcedure
    .input(
      z.object({
        contentType: z.string().optional(),
        fileSize: z.number().optional(),
        pathname: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const endpointIssues = getBrowserUploadEndpointIssues();
      if (endpointIssues.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Upload storage is not browser reachable: ${endpointIssues.join(' ')}`,
        });
      }

      const s3 = new FileS3();

      const { pathname, contentType = 'application/octet-stream', fileSize } = input;

      // Validate content type if provided
      if (contentType && !ALL_SUPPORTED_TYPES.includes(contentType)) {
        throw new Error(
          `Unsupported file type: ${contentType}. Supported types: images, videos, audio, and documents.`,
        );
      }

      // Validate file size if provided
      if (fileSize) {
        const category = getFileCategory(contentType);
        if (category) {
          const limit = FILE_SIZE_LIMITS[category];
          if (fileSize > limit) {
            throw new Error(
              `File size exceeds limit. Maximum ${category} size is ${limit / (1024 * 1024)}MB.`,
            );
          }
        }
      }

      try {
        return await s3.createPreSignedUrl(pathname, contentType);
      } catch (error) {
        console.error('[Upload] Failed to create presigned URL:', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate upload URL. Please check S3 configuration.',
        });
      }
    }),

  // Diagnostic endpoint to test S3 connectivity
  testS3Connection: publicProcedure.query(async () => {
    const endpointIssues = getBrowserUploadEndpointIssues();
    const checks = {
      hasAccessKey: !!fileEnv.S3_ACCESS_KEY_ID,
      hasBucket: !!fileEnv.S3_BUCKET,
      hasEndpoint: !!getBrowserReachableS3Endpoint(),
      hasPublicDomain: !!fileEnv.S3_PUBLIC_DOMAIN,
      hasSecretKey: !!fileEnv.S3_SECRET_ACCESS_KEY,
      isConfigComplete: !!(
        fileEnv.S3_ACCESS_KEY_ID &&
        fileEnv.S3_SECRET_ACCESS_KEY &&
        fileEnv.S3_BUCKET &&
        getBrowserReachableS3Endpoint()
      ),
    };

    if (!checks.isConfigComplete || endpointIssues.length > 0) {
      return {
        checks,
        endpoint: getBrowserReachableS3Endpoint(),
        error: !checks.isConfigComplete
          ? 'S3 configuration is incomplete. Please check your environment variables.'
          : endpointIssues.join(' '),
        publicDomain: fileEnv.S3_PUBLIC_DOMAIN,
        success: false,
      };
    }

    try {
      const s3 = new FileS3();
      // Try to generate a test presigned URL
      const testUrl = await s3.createPreSignedUrl('test-connection.txt', 'text/plain');
      return {
        checks,
        endpoint: getBrowserReachableS3Endpoint(),
        publicDomain: fileEnv.S3_PUBLIC_DOMAIN,
        success: true,
        testUrl: testUrl ? 'Generated successfully' : 'Failed to generate',
      };
    } catch (error) {
      return {
        checks,
        error: (error as Error)?.message || 'Unknown error',
        success: false,
      };
    }
  }),
});

export type FileRouter = typeof uploadRouter;
