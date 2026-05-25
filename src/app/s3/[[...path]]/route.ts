import { Readable } from 'node:stream';

import { request as undiciRequest } from 'undici';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const toWebReadable = (body: Readable | null | undefined) => (body ? Readable.toWeb(body) : null);

const buildTargetUrl = (request: Request, path?: string[]) => {
  const url = new URL(request.url);
  url.protocol = 'http:';
  url.host = 'chinnahub-rustfs:9000';
  url.pathname = path?.length ? `/${path.join('/')}` : '/';
  return url;
};

const proxyRequest = async (
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) => {
  const { path } = await params;
  const targetUrl = buildTargetUrl(request, path);
  const headers = new Headers(request.headers);
  const incomingHost = request.headers.get('host');

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  if (incomingHost) {
    headers.set('host', incomingHost);
  }

  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const requestBody = hasBody && request.body ? Readable.fromWeb(request.body) : undefined;

  const upstream = await undiciRequest(targetUrl, {
    body: requestBody,
    headers: Object.fromEntries(headers.entries()),
    method,
    maxRedirections: 0,
  });

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(upstream.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) responseHeaders.append(key, item);
    } else {
      responseHeaders.set(key, value.toString());
    }
  }

  for (const header of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header);
  }

  return new Response(toWebReadable(upstream.body as Readable | null | undefined), {
    headers: responseHeaders,
    status: upstream.statusCode,
  });
};

export const runtime = 'nodejs';

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
