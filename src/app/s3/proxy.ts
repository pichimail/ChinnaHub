import { Readable } from 'node:stream';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { fileEnv } from '@/envs/file';
import { getBrowserReachableS3Endpoint } from '@/server/modules/S3';

const DEFAULT_S3_REGION = 'us-east-1';

const toWebReadable = (body: Readable | null | undefined) => (body ? Readable.toWeb(body) : null);

const buildS3Client = (endpoint: string) => {
  if (!fileEnv.S3_ACCESS_KEY_ID || !fileEnv.S3_SECRET_ACCESS_KEY || !fileEnv.S3_BUCKET) {
    throw new Error('S3 environment variables are not set completely, please check your env');
  }

  return new S3Client({
    credentials: {
      accessKeyId: fileEnv.S3_ACCESS_KEY_ID,
      secretAccessKey: fileEnv.S3_SECRET_ACCESS_KEY,
    },
    endpoint,
    forcePathStyle: fileEnv.S3_ENABLE_PATH_STYLE,
    region: fileEnv.S3_REGION || DEFAULT_S3_REGION,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
};

const parseAmzDate = (value: string | null) => {
  if (!value) return null;

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

const getPresignMetadata = (url: URL) => {
  const signingDate = parseAmzDate(url.searchParams.get('X-Amz-Date'));
  const expiresIn = Number(url.searchParams.get('X-Amz-Expires') || '0');

  if (!signingDate || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Invalid S3 presigned URL metadata');
  }

  return { expiresIn, signingDate };
};

const getBucketAndKey = (path?: string[]) => {
  if (!path?.length) {
    throw new Error('Missing S3 object path');
  }

  const [bucket, ...keyParts] = path;
  const key = keyParts.join('/');

  if (!bucket || bucket !== fileEnv.S3_BUCKET) {
    throw new Error(`Unexpected S3 bucket: ${bucket || '(missing)'}`);
  }

  return { bucket, key };
};

const buildCommand = (method: string, bucket: string, key: string, contentType?: string) => {
  const upperMethod = method.toUpperCase();
  const acl = fileEnv.S3_SET_ACL ? 'public-read' : undefined;

  switch (upperMethod) {
    case 'PUT': {
      return new PutObjectCommand({
        ACL: acl,
        Bucket: bucket,
        ContentType: contentType || 'application/octet-stream',
        Key: key,
      });
    }
    case 'GET': {
      return new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
    }
    case 'HEAD': {
      return new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
    }
    case 'DELETE': {
      return new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
    }
    default: {
      throw new Error(`Unsupported S3 method: ${upperMethod}`);
    }
  }
};

const createSignedUrl = async (
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand | HeadObjectCommand | DeleteObjectCommand,
  signingDate: Date,
  expiresIn: number,
) =>
  getSignedUrl(client, command, {
    expiresIn,
    signingDate,
  });

const verifyIncomingSignature = async (request: Request, path?: string[], contentType?: string) => {
  const requestUrl = new URL(request.url);
  const { bucket, key } = getBucketAndKey(path);
  const { expiresIn, signingDate } = getPresignMetadata(requestUrl);
  const publicEndpoint = getBrowserReachableS3Endpoint();

  if (!publicEndpoint) {
    throw new Error('Browser reachable S3 endpoint is not configured');
  }

  const publicClient = buildS3Client(publicEndpoint);
  const command = buildCommand(request.method, bucket, key, contentType);
  const expectedPublicUrl = new URL(
    await createSignedUrl(publicClient, command, signingDate, expiresIn),
  );
  const incomingSignature = requestUrl.searchParams.get('X-Amz-Signature');
  const expectedSignature = expectedPublicUrl.searchParams.get('X-Amz-Signature');

  if (!incomingSignature || incomingSignature !== expectedSignature) {
    throw new Error('SignatureDoesNotMatch');
  }

  return { bucket, key, expiresIn, signingDate };
};

const setS3ResponseHeaders = (
  headers: Headers,
  metadata: {
    CacheControl?: string;
    ContentLength?: number;
    ContentType?: string;
    ETag?: string;
    LastModified?: Date;
  },
) => {
  if (metadata.ContentType) headers.set('content-type', metadata.ContentType);
  if (metadata.ContentLength !== undefined)
    headers.set('content-length', String(metadata.ContentLength));
  if (metadata.ETag) headers.set('etag', metadata.ETag);
  if (metadata.CacheControl) headers.set('cache-control', metadata.CacheControl);
  if (metadata.LastModified) headers.set('last-modified', metadata.LastModified.toUTCString());
};

const forwardToInternalS3 = async (request: Request, path?: string[], contentType?: string) => {
  const { bucket, key } = await verifyIncomingSignature(request, path, contentType);

  if (!fileEnv.S3_ENDPOINT) {
    throw new Error('S3 endpoint is not configured');
  }

  const internalClient = buildS3Client(fileEnv.S3_ENDPOINT);
  const method = request.method.toUpperCase();

  switch (method) {
    case 'PUT': {
      const acl = fileEnv.S3_SET_ACL ? 'public-read' : undefined;
      const contentLengthHeader = request.headers.get('content-length');
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
      const hasValidContentLength =
        contentLength !== undefined && Number.isFinite(contentLength) && contentLength >= 0;
      const bufferedBody =
        !hasValidContentLength && request.body
          ? Buffer.from(await request.arrayBuffer())
          : undefined;
      const requestBody =
        hasValidContentLength && request.body ? Readable.fromWeb(request.body) : bufferedBody;
      const result = await internalClient.send(
        new PutObjectCommand({
          ACL: acl,
          Body: requestBody,
          Bucket: bucket,
          ContentLength: hasValidContentLength ? contentLength : bufferedBody?.byteLength,
          ContentType: contentType || 'application/octet-stream',
          Key: key,
        }),
      );
      const headers = new Headers();
      setS3ResponseHeaders(headers, { ETag: result.ETag });

      return new Response(null, { headers, status: 200 });
    }

    case 'GET': {
      const result = await internalClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const headers = new Headers();
      setS3ResponseHeaders(headers, result);

      return new Response(toWebReadable(result.Body as Readable | null | undefined), {
        headers,
        status: 200,
      });
    }

    case 'HEAD': {
      const result = await internalClient.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      const headers = new Headers();
      setS3ResponseHeaders(headers, result);

      return new Response(null, { headers, status: 200 });
    }

    case 'DELETE': {
      await internalClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

      return new Response(null, { status: 204 });
    }

    default: {
      throw new Error(`Unsupported S3 method: ${method}`);
    }
  }
};

export const proxyS3Request = async (
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) => {
  const { path } = await params;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        Allow: 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      },
      status: 204,
    });
  }

  const contentType = request.headers.get('content-type') || undefined;

  try {
    return await forwardToInternalS3(request, path, contentType);
  } catch (error) {
    const message = (error as Error)?.message || 'S3 request failed';
    const status = message === 'SignatureDoesNotMatch' ? 403 : 500;

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
        status,
      },
    );
  }
};
