import type { MissionOutcome } from '../types';

export interface ParsedIntent {
  type: 'mission' | 'promote' | 'demote' | 'status' | 'chat' | 'clarify';
  params?: Record<string, unknown>;
  clarification?: string;
}

export class IntentParser {
  static parse(message: string, npcId: string): ParsedIntent {
    const lower = message.toLowerCase().trim();

    // Explicit commands
    if (lower.startsWith('/')) {
      return this.parseCommand(message.substring(1), npcId);
    }

    // Natural language intent detection
    return this.classifyIntent(lower, npcId);
  }

  private static parseCommand(command: string, npcId: string): ParsedIntent {
    const parts = command.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case 'mission': {
        if (parts.length < 2) {
          return { type: 'clarify', clarification: 'What kind of mission would you like me to undertake? Please specify the type and target.' };
        }
        const objective = parts.slice(1).join(' ');
        return {
          type: 'mission',
          params: { npcId, objective, difficulty: this.estimateDifficulty(objective) }
        };
      }

      case 'promote': {
        if (parts.length < 2) {
          return { type: 'clarify', clarification: 'Who would you like to promote? Please specify the name.' };
        }
        const target = parts.slice(1).join(' ');
        return {
          type: 'promote',
          params: { target }
        };
      }

      case 'demote': {
        if (parts.length < 2) {
          return { type: 'clarify', clarification: 'Who would you like to demote? Please specify the name.' };
        }
        const target = parts.slice(1).join(' ');
        return {
          type: 'demote',
          params: { target }
        };
      }

      case 'status': {
        return { type: 'status' };
      }

      default: {
        return { type: 'clarify', clarification: `I don't recognize the command "${cmd}". Available commands: /mission, /promote, /demote, /status` };
      }
    }
  }

  private static classifyIntent(message: string, npcId: string): ParsedIntent {
    // Mission keywords
    if (/\b(steal|rob|hit|kill|protect|negotiate|collect|extort|smuggle)\b/.test(message)) {
      const objective = message;
      return {
        type: 'mission',
        params: { npcId, objective, difficulty: this.estimateDifficulty(objective) }
      };
    }

    // Status/family info keywords
    if (/\b(how.*family|status|money|territor|loyal|health)\b/.test(message)) {
      return { type: 'status' };
    }

    // Promotion keywords
    if (/\b(promote|advance|raise|give.*position)\b/.test(message)) {
      return { type: 'promote', params: { target: this.extractTarget(message) } };
    }

    // Demotion keywords
    if (/\b(demote|punish|lower|remove.*position)\b/.test(message)) {
      return { type: 'demote', params: { target: this.extractTarget(message) } };
    }

    // If confidence is low, clarify
    return { type: 'clarify', clarification: 'I\'m not sure what you mean. Could you be more specific about what you\'d like me to do?' };
  }

  private static estimateDifficulty(objective: string): number {
    const lower = objective.toLowerCase();
    let difficulty = 5; // base

    if (/\b(hit|kill|assassin)\b/.test(lower)) difficulty += 3;
    if (/\b(bank|casino|police)\b/.test(lower)) difficulty += 2;
    if (/\b(negotiate|talk|persuade)\b/.test(lower)) difficulty -= 1;
    if (/\b(steal|rob|smuggle)\b/.test(lower)) difficulty += 1;

    return Math.max(1, Math.min(10, difficulty));
  }

  private static extractTarget(message: string): string {
    // Simple extraction - in real implementation, might use NLP
    const words = message.split(/\s+/);
    // Assume last noun-like word is target
    for (let i = words.length - 1; i >= 0; i--) {
      if (words[i].length > 2 && !/\b(the|a|to|for|with)\b/.test(words[i])) {
        return words[i];
      }
    }
    return 'unknown';
  }
}

export class IntentValidator {
  static validate(intent: ParsedIntent, familyId: string): { valid: boolean; error?: string } {
    switch (intent.type) {
      case 'mission': {
        const params = intent.params as any;
        if (!params?.objective) {
          return { valid: false, error: 'Mission requires an objective' };
        }
        // Could check if NPC exists, but for now basic
        return { valid: true };
      }

      case 'promote':
      case 'demote': {
        const params = intent.params as any;
        if (!params?.target) {
          return { valid: false, error: 'Must specify who to promote/demote' };
        }
        return { valid: true };
      }

      case 'status':
        return { valid: true };

      case 'chat':
        return { valid: true };

      case 'clarify':
        return { valid: true };

      default:
        return { valid: false, error: 'Unknown intent type' };
    }
  }
}