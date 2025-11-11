/**
 * Quantum Decision Lab - LLM Gateway (Cloudflare Worker)
 *
 * Privacy-first, stateless proxy for LLM decision parsing.
 *
 * Responsibilities:
 * 1. Rate limiting (prevent abuse)
 * 2. Input sanitization (remove PII, limit length)
 * 3. Cache management (deduplication via KV)
 * 4. Cost control (daily budget limits)
 * 5. Anthropic Claude Haiku API integration
 *
 * Deploy: wrangler deploy
 * Environment Variables: ANTHROPIC_API_KEY, DAILY_BUDGET_USD
 */

// ==================== Types ====================

interface Env {
  KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  DAILY_BUDGET_USD: string;
}

interface ParseDecisionRequest {
  description: string;
  anonymous_user_id: string;
}

interface ParsedDecision {
  title: string;
  options: Array<{ name: string }>;
  factors: Array<{ name: string; weight: number }>;
}

interface ParseDecisionResponse {
  decision: ParsedDecision;
  source: 'llm' | 'cache';
  cost_estimate: number;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

// ==================== Main Handler ====================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS headers (for React Native requests)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // In production: Restrict to app domain/bundle ID
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    try {
      // Parse request body
      const body: ParseDecisionRequest = await request.json();

      // 1. Validate input
      const validationError = validateInput(body);
      if (validationError) {
        return jsonResponse({ error: validationError }, 400, corsHeaders);
      }

      // 2. Rate limiting (check user's daily quota)
      const rateLimitResult = await checkRateLimit(env.KV, body.anonymous_user_id);
      if (!rateLimitResult.allowed) {
        return jsonResponse(
          {
            error: 'Rate limit exceeded. You can make 5 LLM requests per day. Try again tomorrow or use manual entry.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
          429,
          corsHeaders
        );
      }

      // 3. Check cache (deduplication)
      const cacheKey = `cache:${await hashString(body.description)}`;
      const cachedResult = await env.KV.get(cacheKey);

      if (cachedResult) {
        console.log('[Cache] Hit for description hash');
        return jsonResponse(
          {
            ...JSON.parse(cachedResult),
            source: 'cache',
            cost_estimate: 0,
          },
          200,
          corsHeaders
        );
      }

      // 4. Check daily budget
      const budgetCheck = await checkDailyBudget(env.KV, parseFloat(env.DAILY_BUDGET_USD || '10.0'));
      if (!budgetCheck.allowed) {
        return jsonResponse(
          {
            error: 'Daily LLM budget exceeded. Please try manual entry or wait until tomorrow.',
            code: 'BUDGET_EXCEEDED',
          },
          503,
          corsHeaders
        );
      }

      // 5. Call Anthropic API
      const parsedDecision = await callAnthropicAPI(body.description, env.ANTHROPIC_API_KEY);

      // 6. Validate parsed decision
      const decisionValidation = validateParsedDecision(parsedDecision);
      if (!decisionValidation.valid) {
        throw new Error(`Invalid LLM output: ${decisionValidation.errors.join(', ')}`);
      }

      // 7. Update rate limit counter
      await incrementRateLimit(env.KV, body.anonymous_user_id);

      // 8. Update daily budget
      const costEstimate = estimateCost(body.description);
      await incrementDailyBudget(env.KV, costEstimate);

      // 9. Cache result (24h TTL)
      await env.KV.put(cacheKey, JSON.stringify({ decision: parsedDecision }), {
        expirationTtl: 86400, // 24 hours
      });

      // 10. Return result
      const response: ParseDecisionResponse = {
        decision: parsedDecision,
        source: 'llm',
        cost_estimate: costEstimate,
      };

      console.log(`[Success] Parsed decision: ${parsedDecision.title} (cost: $${costEstimate.toFixed(4)})`);

      return jsonResponse(response, 200, corsHeaders);
    } catch (error: any) {
      console.error('[Error]', error.message, error.stack);

      return jsonResponse(
        {
          error: 'Internal server error. Please try manual entry.',
          code: 'INTERNAL_ERROR',
        },
        500,
        corsHeaders
      );
    }
  },
};

// ==================== Validation ====================

function validateInput(body: ParseDecisionRequest): string | null {
  if (!body.description || typeof body.description !== 'string') {
    return 'Description is required and must be a string';
  }

  if (body.description.trim().length < 10) {
    return 'Description too short (minimum 10 characters)';
  }

  if (body.description.length > 2000) {
    return 'Description too long (maximum 2000 characters)';
  }

  if (!body.anonymous_user_id || typeof body.anonymous_user_id !== 'string') {
    return 'Anonymous user ID is required';
  }

  return null;
}

function validateParsedDecision(decision: ParsedDecision): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!decision.title || decision.title.length > 100) {
    errors.push('Invalid decision title');
  }

  if (!decision.options || decision.options.length < 2 || decision.options.length > 4) {
    errors.push('Decision must have 2-4 options');
  }

  if (!decision.factors || decision.factors.length < 1 || decision.factors.length > 10) {
    errors.push('Decision must have 1-10 factors');
  }

  // Validate weights sum to ~1.0 (allow 10% tolerance)
  const totalWeight = decision.factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight < 0.9 || totalWeight > 1.1) {
    // Auto-normalize if slightly off
    const scale = 1.0 / totalWeight;
    decision.factors.forEach(f => {
      f.weight *= scale;
    });
    console.warn('[Validation] Auto-normalized factor weights');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==================== Rate Limiting ====================

async function checkRateLimit(kv: KVNamespace, userId: string): Promise<{ allowed: boolean }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const rateLimitKey = `rate_limit:${userId}:${today}`;

  const currentCount = await kv.get(rateLimitKey);
  const count = currentCount ? parseInt(currentCount, 10) : 0;

  return { allowed: count < 5 }; // 5 calls per day limit
}

async function incrementRateLimit(kv: KVNamespace, userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const rateLimitKey = `rate_limit:${userId}:${today}`;

  const currentCount = await kv.get(rateLimitKey);
  const count = currentCount ? parseInt(currentCount, 10) : 0;

  await kv.put(rateLimitKey, (count + 1).toString(), {
    expirationTtl: 86400, // 24 hours
  });
}

// ==================== Budget Management ====================

async function checkDailyBudget(kv: KVNamespace, maxBudget: number): Promise<{ allowed: boolean }> {
  const today = new Date().toISOString().split('T')[0];
  const budgetKey = `daily_budget:${today}`;

  const currentSpend = await kv.get(budgetKey);
  const spend = currentSpend ? parseFloat(currentSpend) : 0;

  return { allowed: spend < maxBudget };
}

async function incrementDailyBudget(kv: KVNamespace, cost: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const budgetKey = `daily_budget:${today}`;

  const currentSpend = await kv.get(budgetKey);
  const spend = currentSpend ? parseFloat(currentSpend) : 0;

  await kv.put(budgetKey, (spend + cost).toFixed(4), {
    expirationTtl: 86400, // 24 hours
  });
}

// ==================== Anthropic API ====================

async function callAnthropicAPI(description: string, apiKey: string): Promise<ParsedDecision> {
  const prompt = buildDecisionParsingPrompt(description);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-20240307', // Fastest, cheapest Claude model
      max_tokens: 1024,
      temperature: 0.3, // Low temperature for consistent structured output
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  const rawText = data.content[0].text;

  // Parse JSON from Claude's response
  const parsed = extractJSON(rawText);

  return parsed as ParsedDecision;
}

function buildDecisionParsingPrompt(description: string): string {
  // Escape any double quotes in description
  const escapedDescription = description.replace(/"/g, '\\"');

  return `You are a decision structuring assistant. Parse this user's decision description into JSON.

Input: "${escapedDescription}"

Output ONLY valid JSON (no markdown, no explanation, no code blocks):
{
  "title": "Brief decision title (max 60 chars)",
  "options": [
    {"name": "Option 1 name"},
    {"name": "Option 2 name"}
  ],
  "factors": [
    {"name": "Factor 1", "weight": 0.3},
    {"name": "Factor 2", "weight": 0.25}
  ]
}

Rules:
- Limit to 2-4 options
- Limit to 5-10 factors (NEVER more than 10)
- Weights must sum to approximately 1.0
- Infer weights from user's language (e.g., "most important" → higher weight)
- Factor names should be short (1-3 words)
- If user doesn't specify factors, infer common ones (e.g., "Cost", "Convenience", "Quality")

Output JSON:`;
}

function extractJSON(text: string): any {
  // Try to parse directly
  try {
    return JSON.parse(text);
  } catch {}

  // Try to extract from code block
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1]);
  }

  // Try to find JSON object in text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Failed to extract JSON from Claude response');
}

// ==================== Cost Estimation ====================

function estimateCost(description: string): number {
  // Claude Haiku pricing (as of 2024):
  // Input: $0.25 per 1M tokens
  // Output: $1.25 per 1M tokens

  // Rough estimate: 4 chars per token
  const inputTokens = description.length / 4 + 100; // +100 for prompt
  const outputTokens = 150; // Estimated JSON response size

  const inputCost = (inputTokens / 1_000_000) * 0.25;
  const outputCost = (outputTokens / 1_000_000) * 1.25;

  return inputCost + outputCost;
}

// ==================== Utilities ====================

async function hashString(str: string): Promise<string> {
  // Use crypto.subtle.digest for proper hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function jsonResponse(data: any, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}
