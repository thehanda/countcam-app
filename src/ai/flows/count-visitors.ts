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
  prompt: `You are an AI that counts the number of people in a video.

  You will be given a video of people entering a museum, and you will count the number of people in the video.

  The video is provided as a data URI. Use the following as the primary source of information about the video.

  Video: {{media url=videoDataUri}}

  Return only a number, representing the number of people.
  `,
});

const countVisitorsFlow = ai.defineFlow(
  {
    name: 'countVisitorsFlow',
    inputSchema: CountVisitorsInputSchema,
    outputSchema: CountVisitorsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Attempt to parse the output as a number.
    const visitorCount = Number(output);
    if (isNaN(visitorCount)) {
      throw new Error(`Could not parse visitor count from LLM output: ${output}`);
    }
    return {visitorCount};
  }
);
