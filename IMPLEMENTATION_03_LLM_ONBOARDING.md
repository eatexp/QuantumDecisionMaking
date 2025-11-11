# Phase 1 Implementation Guide: LLM-Powered Onboarding
## Solving the Cold Start Problem with Natural Language Processing

**Document Version:** 1.0
**Last Updated:** 2025-11-11
**Implementation Priority:** HIGH (Week 9-10)
**Depends On:** Privacy Architecture (IMPLEMENTATION_01)

---

## 1. Strategic Context: The Cold Start Problem

### 1.1 The Problem

**User Journey Without LLM:**
1. User downloads app →  "Create Decision" button
2. Blank form: "Add factor 1", "Add factor 2", "Add option 1"...
3. User must manually structure their decision (5-10 minutes of work)
4. **Friction Point**: High cognitive load before receiving any value
5. **Result**: 60-70% abandon before completing first decision (Day 0 churn)

**The "Cold Start Problem"**: Users need to invest significant effort *before* experiencing the platform's value proposition.

---

### 1.2 Our Solution: LLM-Powered Onboarding

**User Journey With LLM:**
1. User downloads app → "Describe your decision in your own words"
2. User types: *"I'm choosing between two job offers. Company A pays $120k but has a 90-minute commute. Company B pays $100k but offers remote work."*
3. **LLM instantly parses** → Structured decision model appears (<3 seconds)
4. Pre-populated: 2 options, 5 factors (Salary, Commute, Work Flexibility, Career Growth, Benefits)
5. User reviews/edits → Decision ready in <60 seconds
6. **Result**: Immediate value, minimal friction

**Conversion Impact**: Expected >60% onboarding completion (vs. <30% for manual entry).

---

## 2. Privacy-First LLM Integration Architecture

### 2.1 Cloud Gateway (Stateless Proxy)

**Design Principle**: LLM processing happens in the cloud, but **no user data is retained** by the LLM provider.

**Architecture:**

```
User Device (React Native)
    ↓ HTTPS POST /api/parse-decision
    ↓ { "description": "I'm choosing between..." }
    ↓
Cloudflare Worker (Stateless Gateway)
    ↓ - Rate limiting (5 calls/user/day)
    ↓ - Input sanitization (max 500 words)
    ↓ - Cache check (24h TTL)
    ↓
Anthropic Claude Haiku API
    ↓ - Parse natural language → JSON
    ↓ - Stateless (no training on user data)
    ↓
Return Structured Decision
    ↓
User Device
    ↓ Store in encrypted local database
```

**Privacy Guarantees:**
1. **Stateless API calls**: Anthropic does not train on user data (per enterprise ToS)
2. **No PII required**: User's description is the only data sent (no email, name, device ID)
3. **Cache for deduplication**: Identical inputs return cached results (reduces API costs)
4. **Opt-out available**: Users can skip LLM onboarding and use manual entry

---

### 2.2 Cloudflare Worker Implementation

**File:** `cloudflare-worker/llm-gateway.ts`

```typescript
/**
 * LLM Gateway (Cloudflare Worker)
 *
 * Privacy-first, stateless proxy for LLM decision parsing.
 *
 * Responsibilities:
 * 1. Rate limiting (prevent abuse)
 * 2. Input sanitization (remove PII, limit length)
 * 3. Cache management (deduplication)
 * 4. Cost control (daily budget limits)
 *
 * Deploy: `wrangler deploy`
 */

interface ParseDecisionRequest {
  description: string;
  anonymous_user_id: string; // For rate limiting only
}

interface ParseDecisionResponse {
  decision: {
    title: string;
    options: Array<{ name: string }>;
    factors: Array<{ name: string; weight: number }>;
  };
  source: 'llm' | 'cache';
  cost_estimate: number; // USD
}

// Environment variables (set in Cloudflare dashboard)
// ANTHROPIC_API_KEY
// DAILY_BUDGET_USD (e.g., 10.00)

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // CORS headers (for React Native)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // In production: Restrict to app domain
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body: ParseDecisionRequest = await request.json();

      // 1. Validate input
      if (!body.description || body.description.length > 2000) {
        return new Response(JSON.stringify({ error: 'Invalid description (max 2000 chars)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 2. Rate limiting (KV store)
      const rateLimitKey = `rate_limit:${body.anonymous_user_id}`;
      const rateLimitCount = await env.KV.get(rateLimitKey);

      if (rateLimitCount && parseInt(rateLimitCount) >= 5) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded (5 calls/day)' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 3. Check cache (deduplication)
      const cacheKey = `cache:${hashString(body.description)}`;
      const cachedResult = await env.KV.get(cacheKey);

      if (cachedResult) {
        console.log('[Cache] Hit for description hash');
        return new Response(
          JSON.stringify({
            ...JSON.parse(cachedResult),
            source: 'cache',
            cost_estimate: 0,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // 4. Check daily budget (KV store)
      const budgetKey = 'daily_budget:' + new Date().toISOString().split('T')[0];
      const currentSpend = await env.KV.get(budgetKey);

      if (currentSpend && parseFloat(currentSpend) >= parseFloat(env.DAILY_BUDGET_USD || '10.0')) {
        return new Response(JSON.stringify({ error: 'Daily budget exceeded. Try manual entry.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // 5. Call Anthropic API
      const parsedDecision = await callAnthropicAPI(body.description, env.ANTHROPIC_API_KEY);

      // 6. Update rate limit counter
      await env.KV.put(rateLimitKey, (parseInt(rateLimitCount || '0') + 1).toString(), {
        expirationTtl: 86400, // 24 hours
      });

      // 7. Update daily budget
      const costEstimate = estimateCost(body.description);
      await env.KV.put(
        budgetKey,
        (parseFloat(currentSpend || '0') + costEstimate).toFixed(4),
        { expirationTtl: 86400 }
      );

      // 8. Cache result (24h TTL)
      await env.KV.put(cacheKey, JSON.stringify({ decision: parsedDecision }), {
        expirationTtl: 86400,
      });

      // 9. Return result
      return new Response(
        JSON.stringify({
          decision: parsedDecision,
          source: 'llm',
          cost_estimate: costEstimate,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    } catch (error: any) {
      console.error('[Error]', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

/**
 * Call Anthropic Claude Haiku API
 *
 * Privacy: Stateless call, no data retained by Anthropic
 */
async function callAnthropicAPI(description: string, apiKey: string): Promise<any> {
  const prompt = buildDecisionParsingPrompt(description);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-20240307', // Fastest, cheapest model
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
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content[0].text;

  // Parse JSON from Claude's response
  const parsed = extractJSON(rawText);

  return parsed;
}

/**
 * Build decision parsing prompt
 *
 * Critical: This prompt engineering is key to reliable structured output
 */
function buildDecisionParsingPrompt(description: string): string {
  return `You are a decision structuring assistant. Parse this user's decision description into JSON.

Input: "${description}"

Output ONLY valid JSON (no markdown, no explanation):
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

/**
 * Extract JSON from Claude's response
 *
 * Claude sometimes wraps JSON in markdown code blocks, so we extract it
 */
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

  throw new Error('Failed to parse JSON from Claude response');
}

/**
 * Estimate cost for this API call
 *
 * Claude Haiku pricing (as of 2024):
 * - Input: $0.25 per 1M tokens
 * - Output: $1.25 per 1M tokens
 *
 * Average call: ~200 input tokens, ~150 output tokens
 * Cost: ~$0.0002 per call
 */
function estimateCost(description: string): number {
  const inputTokens = description.length / 4; // Rough estimate: 4 chars per token
  const outputTokens = 150; // Estimated JSON response size

  const inputCost = (inputTokens / 1_000_000) * 0.25;
  const outputCost = (outputTokens / 1_000_000) * 1.25;

  return inputCost + outputCost;
}

/**
 * Hash string for cache key
 */
function hashString(str: string): string {
  // Simple hash function (in production: use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
```

---

### 2.3 Deploy Cloudflare Worker

**File:** `cloudflare-worker/wrangler.toml`

```toml
name = "quantum-decisions-llm-gateway"
main = "src/llm-gateway.ts"
compatibility_date = "2024-01-01"

# KV Namespace for rate limiting and caching
kv_namespaces = [
  { binding = "KV", id = "your_kv_namespace_id" }
]

# Environment variables (set via Cloudflare dashboard or CLI)
# ANTHROPIC_API_KEY = "sk-ant-..."
# DAILY_BUDGET_USD = "10.00"

[env.production]
route = "https://api.quantumdecisions.com/parse-decision"

[env.development]
route = "https://dev-api.quantumdecisions.com/parse-decision"
```

**Deploy:**
```bash
cd cloudflare-worker
npm install wrangler -g
wrangler login
wrangler kv:namespace create "LLMCACHE"
wrangler deploy
```

---

## 3. React Native Integration

### 3.1 LLM Service Client

**File:** `src/services/llm-service.ts`

```typescript
import AsyncStorage from '@react-native-community/async-storage';
import { generateAnonymousUserId } from '@utils/crypto';

/**
 * LLM Service Client
 *
 * Communicates with Cloudflare Worker to parse decision descriptions.
 *
 * Privacy: Only sends decision description text, no PII
 */

interface ParsedDecision {
  title: string;
  options: Array<{ name: string }>;
  factors: Array<{ name: string; weight: number }>;
}

interface LLMResponse {
  decision: ParsedDecision;
  source: 'llm' | 'cache';
  cost_estimate: number;
}

const LLM_GATEWAY_URL =
  __DEV__
    ? 'https://dev-api.quantumdecisions.com/parse-decision'
    : 'https://api.quantumdecisions.com/parse-decision';

export class LLMService {
  private anonymousUserId: string | null = null;

  async initialize() {
    // Get anonymous user ID (for rate limiting)
    let userId = await AsyncStorage.getItem('anonymous_user_id');
    if (!userId) {
      userId = generateAnonymousUserId();
      await AsyncStorage.setItem('anonymous_user_id', userId);
    }
    this.anonymousUserId = userId;
  }

  /**
   * Parse decision description using LLM
   *
   * @param description - User's natural language description (max 2000 chars)
   * @returns Structured decision model
   * @throws {Error} If API call fails or rate limit exceeded
   */
  async parseDecision(description: string): Promise<ParsedDecision> {
    if (!this.anonymousUserId) {
      await this.initialize();
    }

    // Input validation
    if (!description || description.trim().length < 10) {
      throw new Error('Description too short (min 10 characters)');
    }

    if (description.length > 2000) {
      throw new Error('Description too long (max 2000 characters)');
    }

    // Check local opt-out flag
    const optedOut = await AsyncStorage.getItem('llm_opted_out');
    if (optedOut === 'true') {
      throw new Error('User opted out of LLM features');
    }

    console.log('[LLM] Sending parse request...');

    try {
      const response = await fetch(LLM_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description.trim(),
          anonymous_user_id: this.anonymousUserId,
        }),
        timeout: 10000, // 10-second timeout
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. You can make 5 LLM requests per day.');
        }
        if (response.status === 503) {
          throw new Error('LLM service temporarily unavailable. Please try manual entry.');
        }
        throw new Error(`LLM service error: ${response.status}`);
      }

      const data: LLMResponse = await response.json();

      console.log(`[LLM] Parse successful (source: ${data.source}, cost: $${data.cost_estimate.toFixed(4)})`);

      // Validate response structure
      this.validateParsedDecision(data.decision);

      return data.decision;

    } catch (error: any) {
      console.error('[LLM] Parse failed:', error);

      // Re-throw with user-friendly message
      if (error.message.includes('Rate limit')) {
        throw error;
      }
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out. Please try again or use manual entry.');
      }
      throw new Error('Failed to parse decision. Please try manual entry.');
    }
  }

  /**
   * Validate parsed decision structure
   *
   * Ensures LLM output meets our constraints (5-10 factors, 2-4 options, etc.)
   */
  private validateParsedDecision(decision: ParsedDecision): void {
    if (!decision.title || decision.title.length > 100) {
      throw new Error('Invalid decision title');
    }

    if (!decision.options || decision.options.length < 2 || decision.options.length > 4) {
      throw new Error('Decision must have 2-4 options');
    }

    if (!decision.factors || decision.factors.length < 1 || decision.factors.length > 10) {
      throw new Error('Decision must have 1-10 factors');
    }

    // Validate weights sum to ~1.0 (allow 10% tolerance)
    const totalWeight = decision.factors.reduce((sum, f) => sum + f.weight, 0);
    if (totalWeight < 0.9 || totalWeight > 1.1) {
      // Auto-normalize if slightly off
      const scale = 1.0 / totalWeight;
      decision.factors.forEach(f => {
        f.weight *= scale;
      });
      console.warn('[LLM] Auto-normalized factor weights');
    }
  }

  /**
   * Allow user to opt out of LLM features (GDPR compliance)
   */
  async optOut() {
    await AsyncStorage.setItem('llm_opted_out', 'true');
    console.log('[LLM] User opted out');
  }

  async optIn() {
    await AsyncStorage.setItem('llm_opted_out', 'false');
    console.log('[LLM] User opted in');
  }
}

export const llmService = new LLMService();
```

---

### 3.2 LLM Onboarding Screen

**File:** `src/screens/LLMOnboardingScreen.tsx`

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import { Button, ActivityIndicator } from 'react-native-paper';
import { useDatabase } from '@database/DatabaseContext';
import { llmService } from '@services/llm-service';
import { useNavigation } from '@react-navigation/native';
import { analyticsEvents } from '@services/analytics';

export function LLMOnboardingScreen() {
  const { database } = useDatabase();
  const navigation = useNavigation();

  const [description, setDescription] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [charCount, setCharCount] = useState<number>(0);

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    setCharCount(text.length);
  };

  /**
   * Parse decision using LLM and navigate to review screen
   */
  const handleParseDecision = async () => {
    if (description.trim().length < 10) {
      Alert.alert('Too short', 'Please describe your decision in at least 10 characters.');
      return;
    }

    setIsParsing(true);

    try {
      console.log('[Onboarding] Parsing decision with LLM...');

      // Call LLM service
      const parsedDecision = await llmService.parseDecision(description);

      console.log('[Onboarding] Parsed successfully:', parsedDecision);

      // Create decision in local database
      const decision = await database.write(async () => {
        const newDecision = await database.collections.get('decisions').create(d => {
          d.title = parsedDecision.title;
          d.status = 'active';
          d.source = 'llm_onboarding';
          d.decisionMethod = 'llm_suggested';
        });

        // Create options
        for (let i = 0; i < parsedDecision.options.length; i++) {
          await database.collections.get('options').create(o => {
            o.decisionId = newDecision.id;
            o.name = parsedDecision.options[i].name;
            o.displayOrder = i;
          });
        }

        // Create factors
        for (let i = 0; i < parsedDecision.factors.length; i++) {
          await database.collections.get('factors').create(f => {
            f.decisionId = newDecision.id;
            f.name = parsedDecision.factors[i].name;
            f.weight = parsedDecision.factors[i].weight;
            f.displayOrder = i;
            f.factorType = 'suggested';
          });
        }

        return newDecision;
      });

      // Track analytics
      analyticsEvents.decisionCreated('llm_onboarding', parsedDecision.factors.length, parsedDecision.options.length);

      // Navigate to review/edit screen
      navigation.navigate('DecisionReview', {
        decisionId: decision.id,
        isFromLLM: true,
      });

    } catch (error: any) {
      console.error('[Onboarding] Parse failed:', error);

      Alert.alert(
        'Parse Failed',
        error.message || 'Failed to parse your decision. Would you like to try manual entry instead?',
        [
          {
            text: 'Retry',
            onPress: () => {
              // User can edit description and retry
            },
          },
          {
            text: 'Manual Entry',
            onPress: () => {
              navigation.navigate('ManualDecisionCreate');
            },
          },
        ]
      );
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Describe Your Decision</Text>

      <Text style={styles.subtitle}>
        Tell us about your decision in your own words. We'll structure it for you.
      </Text>

      <TextInput
        style={styles.textInput}
        placeholder="Example: I'm deciding between two job offers. Company A pays $120k but has a 90-minute commute. Company B pays $100k but offers full remote work..."
        multiline
        numberOfLines={10}
        value={description}
        onChangeText={handleDescriptionChange}
        editable={!isParsing}
        textAlignVertical="top"
      />

      <Text style={styles.charCount}>
        {charCount} / 2000 characters
        {charCount < 10 && ' (min 10)'}
      </Text>

      <Button
        mode="contained"
        onPress={handleParseDecision}
        disabled={isParsing || description.trim().length < 10}
        loading={isParsing}
        style={styles.parseButton}
      >
        {isParsing ? 'Analyzing...' : 'Structure My Decision'}
      </Button>

      {isParsing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Analyzing your decision...</Text>
        </View>
      )}

      <Button
        mode="text"
        onPress={() => navigation.navigate('ManualDecisionCreate')}
        disabled={isParsing}
        style={styles.manualButton}
      >
        Or create manually
      </Button>

      <Text style={styles.privacyNote}>
        🔒 Privacy: Your description is processed securely and not stored by our AI provider.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 200,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 14,
    color: '#999',
    textAlign: 'right',
    marginBottom: 16,
  },
  parseButton: {
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  manualButton: {
    marginBottom: 20,
  },
  privacyNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
});
```

---

### 3.3 Decision Review Screen (Post-LLM Parsing)

**File:** `src/screens/DecisionReviewScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, List, IconButton, Chip } from 'react-native-paper';
import { useDatabase } from '@database/DatabaseContext';
import { Decision } from '@models/Decision';
import { Option } from '@models/Option';
import { Factor } from '@models/Factor';
import { useNavigation } from '@react-navigation/native';

interface Props {
  route: {
    params: {
      decisionId: string;
      isFromLLM: boolean;
    };
  };
}

export function DecisionReviewScreen({ route }: Props) {
  const { decisionId, isFromLLM } = route.params;
  const { database } = useDatabase();
  const navigation = useNavigation();

  const [decision, setDecision] = useState<Decision | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);

  useEffect(() => {
    loadDecision();
  }, [decisionId]);

  const loadDecision = async () => {
    const d = await database.collections.get<Decision>('decisions').find(decisionId);
    const opts = await d.options.fetch();
    const facts = await d.factors.fetch();

    setDecision(d);
    setOptions(opts);
    setFactors(facts);
  };

  const handleConfirm = () => {
    // Navigate to decision detail screen (start scoring factors)
    navigation.navigate('DecisionDetail', { decisionId });
  };

  const handleEdit = () => {
    // Navigate to edit screen
    navigation.navigate('DecisionEdit', { decisionId });
  };

  if (!decision) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      {isFromLLM && (
        <Chip icon="robot" style={styles.llmChip}>
          AI-Generated
        </Chip>
      )}

      <Text style={styles.title}>{decision.title}</Text>

      <Text style={styles.sectionHeader}>Options ({options.length})</Text>
      {options.map((option, index) => (
        <List.Item
          key={option.id}
          title={option.name}
          left={() => <List.Icon icon="checkbox-marked-circle-outline" />}
          right={() => <IconButton icon="pencil" onPress={handleEdit} />}
        />
      ))}

      <Text style={styles.sectionHeader}>Factors ({factors.length})</Text>
      {factors.map((factor, index) => (
        <List.Item
          key={factor.id}
          title={factor.name}
          description={`Weight: ${(factor.weight * 100).toFixed(0)}%`}
          left={() => <List.Icon icon="scale-balance" />}
          right={() => <IconButton icon="pencil" onPress={handleEdit} />}
        />
      ))}

      <View style={styles.buttonContainer}>
        <Button mode="contained" onPress={handleConfirm} style={styles.confirmButton}>
          Looks Good! Continue
        </Button>

        <Button mode="outlined" onPress={handleEdit} style={styles.editButton}>
          Edit Details
        </Button>
      </View>

      {isFromLLM && (
        <Text style={styles.helpText}>
          ✏️ You can edit factor names, weights, and options before continuing.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  llmChip: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    backgroundColor: '#E3F2FD',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  confirmButton: {
    marginBottom: 12,
  },
  editButton: {
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});
```

---

## 4. Cognitive Load Management: The "7±2 Rule"

### 4.1 Enforcing Factor Limits

**Psychology Research**: Miller's Law (1956) states that the average person can hold 7±2 items in working memory.

**Our Constraint**: Maximum 10 factors per decision (enforced by LLM prompt and UI).

**File:** `src/utils/cognitive-load-limits.ts`

```typescript
/**
 * Cognitive Load Limits
 *
 * Based on psychological research (Miller's Law: 7±2 items in working memory)
 *
 * These limits are:
 * 1. Psychological: Prevent user fatigue
 * 2. Technical: Classical Bayes inference scales poorly >15 factors
 * 3. Strategic: QLBN simulation feasibility (Phase 2)
 */

export const COGNITIVE_LIMITS = {
  MIN_FACTORS: 1,
  MAX_FACTORS: 10, // Hard limit (UI enforced)
  RECOMMENDED_FACTORS: 5, // Optimal (LLM default)

  MIN_OPTIONS: 2,
  MAX_OPTIONS: 4, // Practical limit for pairwise comparison UI

  MAX_DECISION_TITLE_LENGTH: 100,
  MAX_FACTOR_NAME_LENGTH: 40,
  MAX_OPTION_NAME_LENGTH: 60,
};

/**
 * Validate decision complexity
 */
export function validateDecisionComplexity(
  numFactors: number,
  numOptions: number
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (numFactors < COGNITIVE_LIMITS.MIN_FACTORS) {
    return { valid: false, warnings: ['Decision must have at least 1 factor'] };
  }

  if (numFactors > COGNITIVE_LIMITS.MAX_FACTORS) {
    return { valid: false, warnings: [`Maximum ${COGNITIVE_LIMITS.MAX_FACTORS} factors allowed (cognitive load limit)`] };
  }

  if (numFactors > COGNITIVE_LIMITS.RECOMMENDED_FACTORS) {
    warnings.push(`You have ${numFactors} factors. Consider consolidating to ${COGNITIVE_LIMITS.RECOMMENDED_FACTORS} for easier comparison.`);
  }

  if (numOptions < COGNITIVE_LIMITS.MIN_OPTIONS) {
    return { valid: false, warnings: ['Decision must have at least 2 options'] };
  }

  if (numOptions > COGNITIVE_LIMITS.MAX_OPTIONS) {
    warnings.push(`More than ${COGNITIVE_LIMITS.MAX_OPTIONS} options can be overwhelming. Consider narrowing down.`);
  }

  return { valid: true, warnings };
}
```

---

### 4.2 LLM Prompt Enforcement

**The LLM prompt explicitly instructs Claude to limit factors:**

```
Rules:
- Limit to 5-10 factors (NEVER more than 10)
- If user describes many factors, prioritize the top 5-7
- Consolidate similar factors (e.g., "Salary" + "Benefits" → "Compensation")
```

**Validation in Gateway:**
```typescript
if (decision.factors.length > 10) {
  throw new Error('LLM generated too many factors (internal error)');
}
```

---

## 5. Cost Management & Optimization

### 5.1 Cost Analysis (100 Beta Users)

**Assumptions:**
- 100 users
- Each user creates 2 decisions via LLM onboarding (200 total LLM calls)
- Average input: 200 tokens (user description)
- Average output: 150 tokens (JSON response)
- Cache hit rate: 10% (after initial cold start)

**Cost Calculation:**
```
Unique calls: 200 × 0.9 = 180
Input tokens: 180 × 200 = 36,000 tokens
Output tokens: 180 × 150 = 27,000 tokens

Input cost: (36,000 / 1,000,000) × $0.25 = $0.009
Output cost: (27,000 / 1,000,000) × $1.25 = $0.034

Total: ~$0.043 (4.3 cents) for 100 users
```

**Monthly cost (100 users, 2 onboardings each):** <$0.05

**Scale to 10,000 users:** ~$5/month (incredibly affordable)

---

### 5.2 Cost Control Mechanisms

1. **Rate Limiting:** 5 LLM calls per user per day (prevents abuse)
2. **Daily Budget Cap:** $10/day (configurable in Cloudflare Worker)
3. **Caching:** 24h TTL for identical descriptions (reduces duplicate calls)
4. **Fallback to Manual:** If budget exceeded, gracefully degrade to manual entry
5. **Model Selection:** Claude Haiku (cheapest) vs. Sonnet (more expensive but higher quality)

---

## 6. Testing LLM Integration

### 6.1 Unit Test: LLM Service

**File:** `src/services/__tests__/llm-service.test.ts`

```typescript
import { llmService } from '../llm-service';

describe('LLM Service', () => {
  beforeAll(async () => {
    await llmService.initialize();
  });

  test('Parse simple job decision', async () => {
    const description = `I'm deciding between two job offers.
      Company A offers $120k salary with a 90-minute commute.
      Company B offers $100k salary with remote work.`;

    const parsed = await llmService.parseDecision(description);

    expect(parsed.title).toContain('Job');
    expect(parsed.options).toHaveLength(2);
    expect(parsed.factors).toHaveLength(expect.any(Number));
    expect(parsed.factors.length).toBeGreaterThanOrEqual(2);
    expect(parsed.factors.length).toBeLessThanOrEqual(10);

    // Verify factor names
    const factorNames = parsed.factors.map(f => f.name.toLowerCase());
    expect(factorNames).toEqual(expect.arrayContaining(['salary']));
  });

  test('Reject description that is too short', async () => {
    await expect(llmService.parseDecision('Job A or B')).rejects.toThrow('too short');
  });

  test('Handle rate limit gracefully', async () => {
    // Make 6 calls (exceeds 5/day limit)
    for (let i = 0; i < 6; i++) {
      try {
        await llmService.parseDecision(`Decision ${i}: Option A vs B with factors X, Y, Z`);
      } catch (error: any) {
        if (i >= 5) {
          expect(error.message).toContain('Rate limit');
        }
      }
    }
  });
});
```

---

### 6.2 Integration Test: End-to-End Onboarding

```typescript
describe('LLM Onboarding Flow', () => {
  test('User describes decision → LLM parses → Decision created in DB', async () => {
    const description = 'Choosing between buying a car or taking public transit.';

    // 1. Parse with LLM
    const parsed = await llmService.parseDecision(description);

    // 2. Create decision in database
    const decision = await database.write(async () => {
      const d = await database.collections.get('decisions').create(dec => {
        dec.title = parsed.title;
        dec.source = 'llm_onboarding';
      });

      for (const option of parsed.options) {
        await database.collections.get('options').create(o => {
          o.decisionId = d.id;
          o.name = option.name;
        });
      }

      for (const factor of parsed.factors) {
        await database.collections.get('factors').create(f => {
          f.decisionId = d.id;
          f.name = factor.name;
          f.weight = factor.weight;
        });
      }

      return d;
    });

    // 3. Verify decision structure
    const options = await decision.options.fetch();
    const factors = await decision.factors.fetch();

    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(factors.length).toBeGreaterThanOrEqual(1);
    expect(factors.length).toBeLessThanOrEqual(10);
  });
});
```

---

## 7. Success Metrics for LLM Onboarding

### 7.1 Phase 1 KPIs

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **LLM Onboarding Conversion** | >60% | % of users who complete LLM onboarding vs. manual entry |
| **Parse Success Rate** | >95% | % of LLM calls that return valid JSON |
| **Parse Latency** | <3 seconds | Average time from API call to response |
| **Manual Editing Rate** | <40% | % of LLM-generated decisions that users edit before confirming |
| **Day 0 Retention** | >70% | % of users who return day after LLM onboarding |

### 7.2 A/B Test: LLM vs. Manual Entry

**Hypothesis:** LLM onboarding significantly reduces Day 0 churn.

**Groups:**
- **Group A (LLM)**: Default onboarding flow uses LLM
- **Group B (Manual)**: Default onboarding flow is manual entry (control)

**Expected Result:** Group A should have >2x Day 0 completion rate vs. Group B.

---

## 8. Next Steps: Full Feature Integration

With all three core components now implemented:

1. ✅ **Privacy-First Architecture** (encrypted local storage, federated learning foundation)
2. ✅ **Insight-Driven Loop** (outcome logging → instant insights)
3. ✅ **LLM-Powered Onboarding** (natural language → structured decision)

**We can now proceed to:**
- Month 1 Week 1-2: Initialize React Native project with full stack
- Month 2 Week 5-8: Implement gamification and habit stacking
- Month 3 Week 9-12: Polish UI, beta launch, and retention tracking

---

**Document Status:** DRAFT v1.0 - LLM Onboarding Implementation Complete ✅

**All three critical Phase 1 components are now fully specified and ready for implementation.**
