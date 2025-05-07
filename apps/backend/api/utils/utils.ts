import { VercelResponse } from '@vercel/node';

export const addCorsHeaders = (res: VercelResponse, req: { headers?: { origin?: string } }) => {
  // Get the request origin
  const origin = req.headers?.origin;

  // Use the request origin if it exists, otherwise use the configured allowed origin
  // Never fall back to '*' for WebAuthn operations
  const allowedOrigin = process.env.ALLOWED_ORIGIN || origin || 'https://libtrack.vercel.app';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
};

export const handleCors = (
  req: { method?: string; headers?: { origin?: string } },
  res: VercelResponse
) => {
  addCorsHeaders(res, req);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
};
