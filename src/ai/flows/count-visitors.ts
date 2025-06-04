
'use server';
/**
 * @fileOverview Counts the number of visitors in a video based on their direction of movement.
 *
 * - countVisitors - A function that handles the visitor counting process.
 * - CountVisitorsInput - The input type for the countVisitors function.
 * - CountVisitorsOutput - The return type for the countVisitors function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { DirectionEnum, type Direction } from '@/ai/types';

const CountVisitorsInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video of people, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  direction: DirectionEnum.describe(
    "The direction of movement to count: 'entering', 'exiting', or 'both'."
  ),
});
export type CountVisitorsInput = z.infer<typeof CountVisitorsInputSchema>;

const CountVisitorsOutputSchema = z.object({
  visitorCount: z.number().describe('The number of visitors counted based on the specified direction in the video.'),
  countedDirection: DirectionEnum.describe("The direction that was used for counting."),
});
export type CountVisitorsOutput = z.infer<typeof CountVisitorsOutputSchema>;

export async function countVisitors(input: CountVisitorsInput): Promise<CountVisitorsOutput> {
  return countVisitorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'countVisitorsPrompt',
  input: {schema: CountVisitorsInputSchema},
  output: {schema: CountVisitorsOutputSchema},
  prompt: `You are an AI that counts the number of distinct people in a video based on their direction of movement.
  Your primary task is to count only those individuals who are clearly moving in the specified direction.

  You will be given a video and a 'Direction to count' parameter.
  - If 'Direction to count' is 'entering', count ONLY the unique individuals who are clearly ENTERING.
  - If 'Direction to count' is 'exiting', count ONLY the unique individuals who are clearly EXITING.
  - If 'Direction to count' is 'both', count all unique individuals moving clearly in EITHER direction (entering or exiting), but count each person only once even if they change direction or appear multiple times.

  Do not count people who are just passing by without clearly entering or exiting according to the specified 'Direction to count'.
  The video is provided as a data URI.

  Video: {{media url=videoDataUri}}
  Direction to count: {{{direction}}}

  Please provide your response as a JSON object with two keys:
  1. 'visitorCount': The total number of distinct people counted strictly according to the specified 'Direction to count'.
  2. 'countedDirection': The exact value of the 'Direction to count' parameter you were given (echo this back).
  For example: {"visitorCount": 12, "countedDirection": "entering"}
  If the video quality is too low to make a confident count, or if no people are visible, set visitorCount to 0.
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
            messageContent = messageContent.map(part => (part as any).text || JSON.stringify(part)).join('; ');
          }
          errorMessage += ` Message content: ${messageContent}.`;
        }
        const safetyRatings = (candidate as any).safetyRatings;
        if (safetyRatings && safetyRatings.length > 0) {
          errorMessage += ` Safety Ratings: ${JSON.stringify(safetyRatings)}.`;
        }
      }
      throw new Error(errorMessage);
    }

    const parsedOutput = CountVisitorsOutputSchema.safeParse(structuredOutput);
    if (!parsedOutput.success) {
      throw new Error(
        `LLM output validation error: ${parsedOutput.error.format()}. Received: ${JSON.stringify(
          structuredOutput
        )}`
      );
    }
    
    // Ensure the countedDirection matches the input direction
    // This check is useful for debugging but we will trust the LLM to set it correctly based on its processing.
    // If the LLM consistently fails to match, the prompt might need further refinement.
    if (parsedOutput.data.countedDirection !== input.direction) {
      console.warn(`Warning: LLM's countedDirection (${parsedOutput.data.countedDirection}) does not match input direction (${input.direction}). The LLM might have overridden the direction or there's a mismatch in interpretation.`);
    }

    return parsedOutput.data;
  }
);
