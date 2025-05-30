
'use server';
/**
 * @fileOverview Counts the number of visitors in a video.
 *
 * - countVisitors - A function that handles the visitor counting process.
 * - CountVisitorsInput - The input type for the countVisitors function.
 * - CountVisitorsOutput - The return type for the countVisitors function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CountVisitorsInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video of people entering a museum, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type CountVisitorsInput = z.infer<typeof CountVisitorsInputSchema>;

const CountVisitorsOutputSchema = z.object({
  visitorCount: z.number().describe('The number of visitors counted in the video.'),
});
export type CountVisitorsOutput = z.infer<typeof CountVisitorsOutputSchema>;

export async function countVisitors(input: CountVisitorsInput): Promise<CountVisitorsOutput> {
  return countVisitorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'countVisitorsPrompt',
  input: {schema: CountVisitorsInputSchema},
  output: {schema: CountVisitorsOutputSchema},
  prompt: `You are an AI that counts the number of distinct people in a video.

  You will be given a video, potentially of people entering a museum. Your task is to count the number of unique individuals visible in the video.

  The video is provided as a data URI. Use the following as the primary source of information about the video.

  Video: {{media url=videoDataUri}}

  Please provide your response as a JSON object with a single key 'visitorCount', where the value is the total number of distinct people counted.
  For example: {"visitorCount": 12}
  `,
});

const countVisitorsFlow = ai.defineFlow(
  {
    name: 'countVisitorsFlow',
    inputSchema: CountVisitorsInputSchema,
    outputSchema: CountVisitorsOutputSchema,
  },
  async input => {
    const response = await prompt(input);
    const structuredOutput = response.output;

    if (!structuredOutput) {
      let errorMessage = "LLM did not return valid structured output or was blocked.";
      const candidate = response.candidates?.[0];
      if (candidate) {
        errorMessage += ` Finish reason: ${candidate.finishReason}.`;
        if (candidate.message?.content && String(candidate.message.content).length > 0) {
          let messageContent = candidate.message.content;
          if (Array.isArray(messageContent)) {
             // Handle potential array content (e.g., multimodal parts)
            messageContent = messageContent.map(part => (part as any).text || JSON.stringify(part)).join('; ');
          }
          errorMessage += ` Message content: ${messageContent}.`;
        }
        const safetyRatings = (candidate as any).safetyRatings; // Specific to Google AI plugin
        if (safetyRatings && safetyRatings.length > 0) {
          errorMessage += ` Safety Ratings: ${JSON.stringify(safetyRatings)}.`;
        }
      }
      throw new Error(errorMessage);
    }

    // Genkit validates `structuredOutput` against `CountVisitorsOutputSchema`.
    // So, `structuredOutput.visitorCount` should be a number.
    // For extra safety, especially if schema enforcement could be bypassed or partial:
    if (typeof structuredOutput.visitorCount !== 'number') {
      throw new Error(
        `LLM output error: 'visitorCount' is not a number. Received: ${JSON.stringify(
          structuredOutput
        )}`
      );
    }
    
    return structuredOutput; // This is { visitorCount: number }
  }
);
