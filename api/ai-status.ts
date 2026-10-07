import { setCorsHeaders } from '../lib/cors.js';

// Shows which AI provider this deployment will use. Never returns key values.
export default function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);

  return res.status(200).json({
    activeProvider: hasDeepSeek ? 'deepseek' : hasGemini ? 'gemini' : 'none',
    deepseekKeyConfigured: hasDeepSeek,
    geminiKeyConfigured: hasGemini,
    deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    vercelEnv: process.env.VERCEL_ENV || null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
  });
}
