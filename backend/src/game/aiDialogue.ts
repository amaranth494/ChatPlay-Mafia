import OpenAI from 'openai';
import { getNpcLLMContext, getNpcMemories } from '../db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting: NPC can respond once per 5 seconds
const lastResponseTimes = new Map<string, number>();

export class AIDialogueService {
  static async generateResponse(
    npcId: string,
    playerMessage: string,
    simulationContext?: string
  ): Promise<string> {
    // Rate limiting
    const now = Date.now();
    const lastTime = lastResponseTimes.get(npcId) || 0;
    if (now - lastTime < 5000) {
      return "I'm still processing your previous request. Give me a moment.";
    }
    lastResponseTimes.set(npcId, now);

    try {
      // Get NPC context
      const npcContext = await getNpcLLMContext(npcId);
      const memories = await getNpcMemories(npcId);
      const recentEvents = memories.slice(0, 3).map(m => m.description).join('; ');

      // Build prompt
      const systemPrompt = `You are ${npcContext || 'an NPC in a mafia family simulation'}.

Recent events: ${recentEvents || 'None'}

${simulationContext ? `Current situation: ${simulationContext}` : ''}

Respond in character, keeping your personality and speech patterns. Keep responses concise and immersive - no breaking the fourth wall or referencing game mechanics directly.`;

      const response = await openai.responses.create({
        model: 'gpt-4o-mini',
        instructions: systemPrompt,
        input: playerMessage,
        max_output_tokens: 150,
      });

      return (response as any).output_text || 'I understand.';
    } catch (error) {
      console.error('OpenAI API error:', error);
      return 'Something went wrong with communication.';
    }
  }
}