
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
  prompt: `You are an advanced AI specializing in accurately counting distinct individuals in video footage based on their movement direction. Your primary goal is to provide the most precise count possible for 'entering' or 'exiting' movements.

Follow these instructions meticulously:

1.  **Identify Individuals:**
    *   Count only clearly identifiable human figures. A person is considered identifiable if their head and a significant portion of their torso are visible and their movement path is clear for a sustained period.
    *   Distinguish individuals even if they are partially obscured temporarily (e.g., by other people or objects), provided they re-emerge clearly and can be reasonably identified as the same person.
    *   Do NOT count animals, inanimate objects, or indistinct shadows as people.
    *   Focus on adults and children who are walking independently. Do not count infants carried by others unless specifically asked.
    *   If a person is stationary for most of their appearance, do not count them unless their entry or exit path is very clear.

2.  **Directional Movement & Counting Logic:**
    *   If 'Direction to count' is 'entering': Count ONLY unique individuals who are unambiguously and continuously moving in the 'entering' direction across a defined threshold or significant portion of the view.
    *   If 'Direction to count' is 'exiting': Count ONLY unique individuals who are unambiguously and continuously moving in the 'exiting' direction across a defined threshold or significant portion of the view.
    *   Each person should be counted only ONCE within their specified directional pass. For example, if counting 'entering', a person entering is counted once. If they later exit while you are still focused on an 'entering' count, that exit is ignored for the current task.

3.  **What to Exclude (Non-counts):**
    *   Do NOT count individuals who are stationary or loitering for the majority of their appearance without clear, sustained directional movement.
    *   Do NOT count individuals who only briefly appear at the very edge of the frame or whose movement path is too short to confidently determine direction.
    *   Do NOT count individuals whose movement direction is highly ambiguous or erratic (e.g., frequently changing direction in the middle of the frame relative to the specified direction).
    *   Avoid double-counting for the *specified direction*.

4.  **Handling Video Quality & Ambiguity:**
    *   If the video quality is too low (e.g., very blurry, severe motion blur, poor lighting, extreme distance, heavy obstructions) to make a confident count for a significant portion of the video, or if no people are clearly visible and moving as specified, set 'visitorCount' to 0.
    *   Strive for accuracy. If there is significant doubt about whether an individual meets the criteria or about their direction, it is better to be conservative and NOT count them if it compromises overall precision. Precision is more important than capturing every potential person. If a person's path is too complex or unclear, err on the side of not counting.

Video Input:
Video: {{media url=videoDataUri}}
Direction to count: {{{direction}}}

Output Format:
Please provide your response as a JSON object with two keys:
1.  'visitorCount': The total number of distinct people counted, strictly adhering to ALL the above instructions and the specified 'Direction to count'.
2.  'countedDirection': The exact value of the 'Direction to count' parameter you were given (echo this back).

Example for entering: {"visitorCount": 12, "countedDirection": "entering"}
Example for exiting: {"visitorCount": 5, "countedDirection": "exiting"}
If no individuals meet the criteria, or if the video quality is insufficient, output: {"visitorCount": 0, "countedDirection": "your_input_direction_here"}
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
