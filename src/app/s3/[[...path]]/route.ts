import { proxyS3Request } from '../proxy';

export const runtime = 'nodejs';

export const GET = proxyS3Request;
export const POST = proxyS3Request;
export const PUT = proxyS3Request;
export const PATCH = proxyS3Request;
export const DELETE = proxyS3Request;
export const HEAD = proxyS3Request;
export const OPTIONS = proxyS3Request;
