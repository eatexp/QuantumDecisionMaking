/**
 * Decision Parser Service
 *
 * Converts LLM-parsed decisions into WatermelonDB models.
 *
 * Flow:
 * 1. LLM returns ParsedDecision JSON
 * 2. Parser validates and normalizes data
 * 3. Creates Decision, Options, Factors in database
 * 4. Returns created decision for navigation
 *
 * Usage:
 * ```typescript
 * const parser = new DecisionParser(database);
 * const decision = await parser.createDecisionFromParsed(parsedData);
 * ```
 */

import { Database } from '@nozbe/watermelondb';
import { Decision, Option, Factor } from '@database';
import type { ParsedDecision } from './llm-service';

export interface CreateDecisionResult {
  decision: Decision;
  options: Option[];
  factors: Factor[];
  warnings: string[];
}

export class DecisionParser {
  constructor(private database: Database) {}

  /**
   * Create decision from LLM-parsed data
   */
  async createDecisionFromParsed(parsed: ParsedDecision): Promise<CreateDecisionResult> {
    console.log('[Parser] Creating decision from parsed data...');

    const warnings: string[] = [];

    // Validate and normalize
    const normalized = this.normalizeAndValidate(parsed, warnings);

    try {
      const result = await this.database.write(async () => {
        // 1. Create Decision
        const decision = await this.database.collections.get<Decision>('decisions').create(d => {
          d.title = normalized.title;
          d.status = 'active';
          d.source = 'llm_onboarding';
          d.createdAt = new Date();
        });

        // 2. Create Factors
        const factors: Factor[] = [];
        for (const factorData of normalized.factors) {
          const factor = await this.database.collections.get<Factor>('factors').create(f => {
            f.decisionId = decision.id;
            f.name = factorData.name;
            f.description = factorData.description;
            f.weight = factorData.weight;
            f.preference = 'higher_is_better'; // Default
            f.createdAt = new Date();
          });
          factors.push(factor);
        }

        // 3. Create Options
        const options: Option[] = [];
        for (const optionData of normalized.options) {
          const option = await this.database.collections.get<Option>('options').create(o => {
            o.decisionId = decision.id;
            o.name = optionData.name;
            o.description = optionData.description;
            o.isSelected = false;
            o.createdAt = new Date();
          });
          options.push(option);
        }

        return { decision, options, factors };
      });

      console.log('[Parser] ✅ Decision created:', result.decision.id);

      return {
        ...result,
        warnings,
      };
    } catch (error) {
      console.error('[Parser] ❌ Failed to create decision:', error);
      throw new Error('Failed to save decision to database');
    }
  }

  /**
   * Normalize and validate parsed data
   */
  private normalizeAndValidate(
    parsed: ParsedDecision,
    warnings: string[]
  ): {
    title: string;
    options: Array<{ name: string; description?: string }>;
    factors: Array<{ name: string; weight: number; description?: string }>;
  } {
    // Title
    let title = parsed.title.trim();
    if (title.length > 100) {
      title = title.substring(0, 100);
      warnings.push('Decision title was truncated to 100 characters');
    }

    // Options
    let options = parsed.options.slice(0, 10); // Max 10
    if (parsed.options.length > 10) {
      warnings.push(`Only the first 10 options were imported (${parsed.options.length} provided)`);
    }

    options = options.map(opt => ({
      name: opt.name.trim().substring(0, 100),
      description: opt.description?.trim().substring(0, 500),
    }));

    // Factors
    let factors = parsed.factors.slice(0, 10); // Max 10
    if (parsed.factors.length > 10) {
      warnings.push(`Only the first 10 factors were imported (${parsed.factors.length} provided)`);
    }

    // Normalize weights to sum to 1.0
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.log('[Parser] Normalizing factor weights...');
      factors = factors.map(f => ({
        ...f,
        weight: f.weight / totalWeight,
      }));
      warnings.push('Factor weights were normalized to sum to 1.0');
    }

    factors = factors.map(fac => ({
      name: fac.name.trim().substring(0, 80),
      weight: fac.weight,
      description: fac.description?.trim().substring(0, 500),
    }));

    return {
      title,
      options,
      factors,
    };
  }

  /**
   * Update decision from edited parsed data
   * (Used when user edits LLM-generated decision before saving)
   */
  async updateDecisionFromParsed(
    decisionId: string,
    parsed: ParsedDecision
  ): Promise<CreateDecisionResult> {
    console.log('[Parser] Updating decision from edited data...');

    const warnings: string[] = [];
    const normalized = this.normalizeAndValidate(parsed, warnings);

    try {
      const decision = await this.database.collections.get<Decision>('decisions').find(decisionId);

      const result = await this.database.write(async () => {
        // Update decision title
        await decision.update(d => {
          d.title = normalized.title;
        });

        // Delete existing options and factors
        const existingOptions = await decision.options.fetch();
        const existingFactors = await decision.factors.fetch();

        for (const option of existingOptions) {
          await option.markAsDeleted();
        }

        for (const factor of existingFactors) {
          await factor.markAsDeleted();
        }

        // Create new factors
        const factors: Factor[] = [];
        for (const factorData of normalized.factors) {
          const factor = await this.database.collections.get<Factor>('factors').create(f => {
            f.decisionId = decision.id;
            f.name = factorData.name;
            f.description = factorData.description;
            f.weight = factorData.weight;
            f.preference = 'higher_is_better';
            f.createdAt = new Date();
          });
          factors.push(factor);
        }

        // Create new options
        const options: Option[] = [];
        for (const optionData of normalized.options) {
          const option = await this.database.collections.get<Option>('options').create(o => {
            o.decisionId = decision.id;
            o.name = optionData.name;
            o.description = optionData.description;
            o.isSelected = false;
            o.createdAt = new Date();
          });
          options.push(option);
        }

        return { decision, options, factors };
      });

      console.log('[Parser] ✅ Decision updated');

      return {
        ...result,
        warnings,
      };
    } catch (error) {
      console.error('[Parser] ❌ Failed to update decision:', error);
      throw new Error('Failed to update decision in database');
    }
  }

  /**
   * Parse decision from natural language (convenience method)
   */
  static parseFromDescription(description: string): ParsedDecision {
    // This is a fallback parser for offline mode or LLM failure
    // Uses simple heuristics to extract structure

    const lines = description.split('\n').filter(line => line.trim());

    // Try to extract title (first line or first sentence)
    const title = lines[0] || description.substring(0, 100);

    // Try to find options (look for "or", "vs", numbered lists)
    const options: Array<{ name: string }> = [];

    // Look for "X or Y" pattern
    const orPattern = /(.+)\s+or\s+(.+)/i;
    const match = description.match(orPattern);
    if (match) {
      options.push({ name: match[1].trim() });
      options.push({ name: match[2].trim() });
    }

    // If no options found, create generic ones
    if (options.length === 0) {
      options.push({ name: 'Option A' });
      options.push({ name: 'Option B' });
    }

    // Create generic factors
    const factors = [
      { name: 'Importance', weight: 0.4 },
      { name: 'Feasibility', weight: 0.3 },
      { name: 'Long-term impact', weight: 0.3 },
    ];

    return {
      title,
      options,
      factors,
    };
  }

  /**
   * Validate decision completeness
   */
  async validateDecisionCompleteness(decisionId: string): Promise<{
    complete: boolean;
    missing: string[];
  }> {
    const decision = await this.database.collections.get<Decision>('decisions').find(decisionId);
    const options = await decision.options.fetch();
    const factors = await decision.factors.fetch();

    const missing: string[] = [];

    if (options.length < 2) {
      missing.push('At least 2 options required');
    }

    if (factors.length < 1) {
      missing.push('At least 1 factor required');
    }

    // Check factor weights sum to 1.0
    if (factors.length > 0) {
      const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        missing.push('Factor weights must sum to 1.0');
      }
    }

    return {
      complete: missing.length === 0,
      missing,
    };
  }
}
