import { VercelResponse } from '@vercel/node';

export const addCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export const handleCors = (req: { method?: string }, res: VercelResponse) => {
  if (req.method === 'OPTIONS') {
    addCorsHeaders(res);
    res.status(200).end();
    return true;
  }
  addCorsHeaders(res);
  return false;
}; 
