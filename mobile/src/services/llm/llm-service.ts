/**
 * LLM Service Client
 *
 * React Native client for communicating with Cloudflare Worker LLM gateway.
 *
 * Features:
 * - Natural language decision parsing
 * - Anonymous user ID management
 * - Request caching
 * - Error handling with retry
 * - Rate limit detection
 *
 * Usage:
 * ```typescript
 * const llmService = new LLMService();
 * const result = await llmService.parseDecision("Should I take the new job offer?");
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomBytes } from 'react-native-quick-crypto';

export interface ParsedDecision {
  title: string;
  options: Array<{
    name: string;
    description?: string;
  }>;
  factors: Array<{
    name: string;
    weight: number;
    description?: string;
  }>;
}

export interface ParseDecisionResponse {
  decision: ParsedDecision;
  source: 'llm' | 'cache';
}

export interface LLMError {
  type: 'rate_limit' | 'network' | 'validation' | 'server' | 'unknown';
  message: string;
  retryAfter?: number; // seconds
}

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://quantum-decisions-llm.workers.dev';
const ANONYMOUS_USER_ID_KEY = 'anonymous_user_id';
const REQUEST_TIMEOUT_MS = 15000; // 15 seconds

export class LLMService {
  private anonymousUserId: string | null = null;

  /**
   * Initialize service (call on app start)
   */
  async initialize(): Promise<void> {
    console.log('[LLM] Initializing LLM service...');

    // Get or create anonymous user ID
    this.anonymousUserId = await this.getOrCreateAnonymousUserId();

    console.log('[LLM] Service initialized with user ID:', this.anonymousUserId?.substring(0, 8) + '...');
  }

  /**
   * Parse natural language decision description
   */
  async parseDecision(description: string): Promise<ParseDecisionResponse> {
    if (!description || description.trim().length < 10) {
      throw this.createError(
        'validation',
        'Decision description must be at least 10 characters'
      );
    }

    if (!this.anonymousUserId) {
      await this.initialize();
    }

    console.log('[LLM] Parsing decision:', description.substring(0, 50) + '...');

    try {
      const response = await this.makeRequest({
        description,
        anonymous_user_id: this.anonymousUserId!,
      });

      console.log('[LLM] ✅ Decision parsed successfully');
      return response;
    } catch (error) {
      console.error('[LLM] ❌ Parse failed:', error);
      throw error;
    }
  }

  /**
   * Make HTTP request to Cloudflare Worker
   */
  private async makeRequest(
    payload: { description: string; anonymous_user_id: string }
  ): Promise<ParseDecisionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${WORKER_URL}/parse-decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-200 responses
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data: ParseDecisionResponse = await response.json();

      // Validate response
      this.validateParsedDecision(data.decision);

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        throw this.createError(
          'network',
          'Request timed out. Please check your internet connection.'
        );
      }

      // Handle network errors
      if (error.message?.includes('Network request failed')) {
        throw this.createError(
          'network',
          'Network error. Please check your internet connection.'
        );
      }

      // Re-throw if already an LLMError
      if (error.type) {
        throw error;
      }

      // Unknown error
      throw this.createError('unknown', error.message || 'An unexpected error occurred');
    }
  }

  /**
   * Handle HTTP error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any;

    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }

    // Rate limit
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '3600', 10);
      throw this.createError(
        'rate_limit',
        errorData.error || 'Rate limit exceeded. Please try again later.',
        retryAfter
      );
    }

    // Service unavailable (daily budget exceeded)
    if (response.status === 503) {
      throw this.createError(
        'server',
        errorData.error || 'Service temporarily unavailable. Please try again tomorrow.'
      );
    }

    // Validation error
    if (response.status === 400) {
      throw this.createError(
        'validation',
        errorData.error || 'Invalid request. Please try rephrasing your decision.'
      );
    }

    // Server error
    if (response.status >= 500) {
      throw this.createError(
        'server',
        errorData.error || 'Server error. Please try again later.'
      );
    }

    // Unknown error
    throw this.createError('unknown', errorData.error || `HTTP ${response.status}`);
  }

  /**
   * Validate parsed decision structure
   */
  private validateParsedDecision(decision: ParsedDecision): void {
    const errors: string[] = [];

    // Title
    if (!decision.title || decision.title.trim().length === 0) {
      errors.push('Missing decision title');
    }

    // Options
    if (!decision.options || decision.options.length < 2) {
      errors.push('Must have at least 2 options');
    }

    if (decision.options?.length > 10) {
      errors.push('Too many options (max 10)');
    }

    // Factors
    if (!decision.factors || decision.factors.length < 1) {
      errors.push('Must have at least 1 factor');
    }

    if (decision.factors?.length > 10) {
      errors.push('Too many factors (max 10)');
    }

    // Factor weights
    if (decision.factors) {
      const totalWeight = decision.factors.reduce((sum, f) => sum + f.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        errors.push(`Factor weights must sum to 1.0 (got ${totalWeight.toFixed(2)})`);
      }
    }

    if (errors.length > 0) {
      throw this.createError('validation', `Invalid parsed decision: ${errors.join(', ')}`);
    }
  }

  /**
   * Get or create anonymous user ID
   */
  private async getOrCreateAnonymousUserId(): Promise<string> {
    try {
      // Try to load existing ID
      const existingId = await AsyncStorage.getItem(ANONYMOUS_USER_ID_KEY);

      if (existingId) {
        console.log('[LLM] Loaded existing user ID');
        return existingId;
      }

      // Generate new ID
      const newId = this.generateAnonymousUserId();
      await AsyncStorage.setItem(ANONYMOUS_USER_ID_KEY, newId);

      console.log('[LLM] Generated new user ID');
      return newId;
    } catch (error) {
      console.error('[LLM] Failed to manage user ID:', error);
      // Fallback: generate temporary ID (won't persist)
      return this.generateAnonymousUserId();
    }
  }

  /**
   * Generate anonymous user ID
   */
  private generateAnonymousUserId(): string {
    // Format: anon_<16 hex chars>_<timestamp>
    const randomHex = randomBytes(8).toString('hex');
    const timestamp = Date.now().toString(36);
    return `anon_${randomHex}_${timestamp}`;
  }

  /**
   * Get current anonymous user ID
   */
  async getAnonymousUserId(): Promise<string> {
    if (!this.anonymousUserId) {
      this.anonymousUserId = await this.getOrCreateAnonymousUserId();
    }
    return this.anonymousUserId;
  }

  /**
   * Reset anonymous user ID (for testing)
   */
  async resetAnonymousUserId(): Promise<void> {
    await AsyncStorage.removeItem(ANONYMOUS_USER_ID_KEY);
    this.anonymousUserId = await this.getOrCreateAnonymousUserId();
    console.log('[LLM] User ID reset');
  }

  /**
   * Check if rate limited
   */
  async checkRateLimit(): Promise<{
    limited: boolean;
    callsRemaining?: number;
    resetAt?: Date;
  }> {
    // This would require tracking on the client side
    // For Phase 1, we'll let the server handle it
    // TODO: Implement client-side rate limit tracking

    return {
      limited: false,
    };
  }

  /**
   * Create typed error
   */
  private createError(
    type: LLMError['type'],
    message: string,
    retryAfter?: number
  ): LLMError {
    return {
      type,
      message,
      retryAfter,
    };
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyErrorMessage(error: LLMError): string {
    switch (error.type) {
      case 'rate_limit':
        return `You've reached the daily limit (5 decisions). Try again ${
          error.retryAfter ? `in ${Math.ceil(error.retryAfter / 3600)} hours` : 'tomorrow'
        }.`;

      case 'network':
        return 'Network error. Please check your internet connection and try again.';

      case 'validation':
        return error.message;

      case 'server':
        return 'Service temporarily unavailable. Please try again later.';

      default:
        return 'Something went wrong. Please try again.';
    }
  }

  /**
   * Test connection to LLM service
   */
  async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      const testDescription = 'Should I test the LLM service?';
      await this.parseDecision(testDescription);

      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
      };
    } catch (error: any) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
  }
}
