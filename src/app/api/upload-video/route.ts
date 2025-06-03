
import { type NextRequest, NextResponse } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import { z } from 'zod';

// Helper function to convert ArrayBuffer to Base64 string using Node.js Buffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let videoDataUri: string;
    let videoFileName: string | undefined = 'uploaded_video'; // Default filename

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('videoFile') as File | null; // Expect 'videoFile' as the field name

      if (!file) {
        return NextResponse.json({ error: 'No video file found in form data. Please use field name "videoFile".' }, { status: 400 });
      }
      videoFileName = file.name;

      if (!file.type.startsWith('video/')) {
        return NextResponse.json({ error: 'Uploaded file is not a video.' }, { status: 400 });
      }
      
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` }, { status: 413 }); // 413 Payload Too Large
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64String = arrayBufferToBase64(arrayBuffer);
      videoDataUri = `data:${file.type};base64,${base64String}`;

    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      const ApiUploadSchema = z.object({
        videoDataUri: z.string().refine(s => s.startsWith('data:video/') && s.includes(';base64,'), {
          message: "videoDataUri must be a valid video data URI with base64 encoding."
        }),
        // Optionally, you could require a filename in JSON requests too if needed
        // videoFileName: z.string().optional(), 
      });
      const parsedBody = ApiUploadSchema.safeParse(body);

      if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid JSON request body.', details: parsedBody.error.format() }, { status: 400 });
      }
      videoDataUri = parsedBody.data.videoDataUri;
      // videoFileName = parsedBody.data.videoFileName || videoFileName; // If filename passed in JSON

      // Note: For JSON requests with data URI, size check is harder without decoding.
      // The primary size check is for multipart/form-data.
      // If large JSON payloads are a concern, more complex validation would be needed.

    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Please use multipart/form-data or application/json.' }, { status: 415 });
    }

    const input: CountVisitorsInput = {
      videoDataUri: videoDataUri,
      // videoFileName: videoFileName // If you decide to pass filename to the flow
    };

    const result: CountVisitorsOutput = await countVisitors(input);
    // You might want to include the filename in the response if it's useful
    return NextResponse.json({ ...result /* , videoFileName */ }, { status: 200 });

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
