
import { type NextRequest, NextResponse } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import { z } from 'zod';

// Define the expected request body schema
const ApiUploadSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedBody = ApiUploadSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid request body.', details: parsedBody.error.format() }, { status: 400 });
    }

    const input: CountVisitorsInput = {
      videoDataUri: parsedBody.data.videoDataUri,
    };

    // It's good practice to also validate file size here if possible,
    // though with data URIs it's a bit more complex than direct file uploads.
    // The Genkit model will have its own limits. The frontend limits to 50MB.

    const result: CountVisitorsOutput = await countVisitors(input);
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error('API Error processing video:', error);
    let errorMessage = 'Failed to process video.';
    if (error instanceof z.ZodError) {
        errorMessage = 'Invalid request body format.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
