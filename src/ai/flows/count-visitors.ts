
'use server';
/**
 * @fileOverview Counts the number of visitors in a video based on their direction of movement (entering or exiting).
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
    "The direction of movement to count: 'entering' or 'exiting'."
  ),
});
export type CountVisitorsInput = z.infer<typeof CountVisitorsInputSchema>;

const CountVisitorsOutputSchema = z.object({
  visitorCount: z.number().describe('The number of visitors counted based on the specified direction in the video.'),
  countedDirection: DirectionEnum.describe("The direction that was used for counting ('entering' or 'exiting')."),
});
export type CountVisitorsOutput = z.infer<typeof CountVisitorsOutputSchema>;

export async function countVisitors(input: CountVisitorsInput): Promise<CountVisitorsOutput> {
  return countVisitorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'countVisitorsPrompt',
  input: {schema: CountVisitorsInputSchema},
  output: {schema: CountVisitorsOutputSchema},
  prompt: `You are an advanced AI specializing in accurately counting distinct individuals in video footage based on their movement direction relative to a defined scene (e.g., an entrance/exit). Your primary goal is to provide the most precise count possible for 'entering' or 'exiting' movements.

Follow these instructions meticulously:

1.  **Identify Individuals:**
    *   Count only clearly identifiable human figures. A person is considered identifiable if their head and a significant portion of their torso are visible and their movement path is clear for a sustained period.
    *   Focus on adults and children who are walking independently. Do not count infants carried by others.
    *   Distinguish individuals even if they are partially obscured temporarily (e.g., by other people or static objects), provided they re-emerge clearly and can be reasonably identified as the same person.
    *   **Crucially, differentiate people from other moving objects.** If non-human moving objects are visible, make your best effort to exclude them from the count.
    *   **Distance and Clarity:** Do NOT count individuals who are very far in the distance, appear very small, or are too blurry/pixelated to be confidently identified as a distinct person making a clear directional movement.

2.  **Directional Movement & Counting Logic (Focus: '{{direction}}'):**
    *   If 'Direction to count' is 'entering': Count ONLY unique individuals who are unambiguously and continuously moving in the 'entering' direction across a defined threshold or significant portion of the view relevant to an entry point.
    *   If 'Direction to count' is 'exiting': Count ONLY unique individuals who are unambiguously and continuously moving in the 'exiting' direction across a defined threshold or significant portion of the view relevant to an exit point.
    *   Each person should be counted only ONCE within their specified directional pass for this specific counting task.

3.  **What to Exclude (Non-counts for the specified '{{direction}}'):**
    *   Do NOT count individuals who are stationary or loitering.
    *   Do NOT count individuals whose movement path is too short or erratic.
    *   Do NOT count individuals whose movement direction is highly ambiguous.
    *   Avoid double-counting for the *specified direction*.
    *   **Reiterate: Ignore non-human moving objects if distinguishable.**
    *   **Reiterate: Ignore very distant, small, or blurry figures.**

4.  **Handling Video Quality & Ambiguity:**
    *   If video quality is too low for a confident count for the '{{{direction}}}' task, or if no people are clearly visible and moving as specified, set 'visitorCount' to 0.
    *   Strive for accuracy. If there is significant doubt, it is better to be conservative and NOT count.

Video Input:
Video: {{media url=videoDataUri}}
Direction to count: {{{direction}}}

Output Format:
Please provide your response as a JSON object with two keys:
1.  'visitorCount': The total number of distinct people counted for the '{{{direction}}}' direction, strictly adhering to ALL the above instructions.
2.  'countedDirection': The exact value of the 'Direction to count' parameter you were given (echo this back, i.e., '{{{direction}}}').

Example for entering: {"visitorCount": 12, "countedDirection": "entering"}
Example for exiting: {"visitorCount": 5, "countedDirection": "exiting"}
If no individuals meet the criteria, or if the video quality is insufficient for the '{{{direction}}}' task, output: {"visitorCount": 0, "countedDirection": "{{{direction}}}"}
`,
});

const countVisitorsFlow = ai.defineFlow(
  {
    name: 'countVisitorsFlow',
    inputSchema: CountVisitorsInputSchema,
    outputSchema: CountVisitorsOutputSchema,
  },
  async input => {
    // Using default model (gemini-2.0-flash via src/ai/genkit.ts)
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
    
    if (parsedOutput.data.countedDirection !== input.direction) {
      console.warn(`Warning: LLM's countedDirection (${parsedOutput.data.countedDirection}) does not match input direction (${input.direction}). The LLM might have overridden the direction or there's a mismatch in interpretation.`);
    }

    return parsedOutput.data;
  }
);
