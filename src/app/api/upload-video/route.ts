
import { type NextRequest, NextResponse } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import { z } from 'zod';

// Helper function to convert ArrayBuffer to Base64 string using Node.js Buffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let videoDataUri: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('videoFile') as File | null; // Expect 'videoFile' as the field name

      if (!file) {
        return NextResponse.json({ error: 'No video file found in form data. Please use field name "videoFile".' }, { status: 400 });
      }

      if (!file.type.startsWith('video/')) {
        return NextResponse.json({ error: 'Uploaded file is not a video.' }, { status: 400 });
      }
      // Optional: Add file size validation here
      // e.g., if (file.size > 50 * 1024 * 1024) { /* 50MB limit */ ... }


      const arrayBuffer = await file.arrayBuffer();
      const base64String = arrayBufferToBase64(arrayBuffer);
      videoDataUri = `data:${file.type};base64,${base64String}`;

    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      const ApiUploadSchema = z.object({
        videoDataUri: z.string().refine(s => s.startsWith('data:video/') && s.includes(';base64,'), {
          message: "videoDataUri must be a valid video data URI with base64 encoding."
        }),
      });
      const parsedBody = ApiUploadSchema.safeParse(body);

      if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid JSON request body.', details: parsedBody.error.format() }, { status: 400 });
      }
      videoDataUri = parsedBody.data.videoDataUri;
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Please use multipart/form-data or application/json.' }, { status: 415 });
    }

    const input: CountVisitorsInput = {
      videoDataUri: videoDataUri,
    };

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
