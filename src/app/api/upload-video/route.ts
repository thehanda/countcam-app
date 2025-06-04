
import { type NextRequest, NextResponse } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import { DirectionEnum, type Direction } from '@/ai/types';
import { z } from 'zod';

// Helper function to convert ArrayBuffer to Base64 string using Node.js Buffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ApiJsonInputSchema = z.object({
  videoDataUri: z.string().refine(s => s.startsWith('data:video/') && s.includes(';base64,'), {
    message: "videoDataUri must be a valid video data URI with base64 encoding."
  }),
  direction: DirectionEnum,
});

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let videoDataUri: string;
    let direction: Direction;
    let videoFileName: string | undefined = 'uploaded_video'; 

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('videoFile') as File | null;
      const directionString = formData.get('direction') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No video file found in form data. Please use field name "videoFile".' }, { status: 400 });
      }
      if (!directionString) {
        return NextResponse.json({ error: 'No direction specified in form data. Please use field name "direction".' }, { status: 400 });
      }

      const parsedDirection = DirectionEnum.safeParse(directionString);
      if (!parsedDirection.success) {
        return NextResponse.json({ error: `Invalid direction value: ${directionString}. Must be one of 'entering', 'exiting', 'both'.` , details: parsedDirection.error.format() }, { status: 400 });
      }
      direction = parsedDirection.data;
      
      videoFileName = file.name;

      // Prioritize type from curl if available (e.g., videoFile=@file.mp4;type=video/mp4)
      let mimeType = file.type;
      const fieldNameKeys = Array.from(formData.keys()) as string[];
      const videoFileFieldKey = fieldNameKeys.find(key => key.startsWith('videoFile') && key.includes(';type='));
      
      if (videoFileFieldKey) {
          const extractedType = videoFileFieldKey.split(';type=')[1];
          if (extractedType.startsWith('video/')) {
              mimeType = extractedType;
          }
      }


      if (!mimeType || !mimeType.startsWith('video/')) {
         return NextResponse.json({ error: 'Uploaded file is not a video or MIME type could not be determined as video. Ensure "type" is set for "videoFile" field if using curl (e.g., videoFile=@file.mp4;type=video/mp4) or that the browser sends a video type.' }, { status: 400 });
      }
      
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` }, { status: 413 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64String = arrayBufferToBase64(arrayBuffer);
      videoDataUri = `data:${mimeType};base64,${base64String}`;

    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      const parsedBody = ApiJsonInputSchema.safeParse(body);

      if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid JSON request body.', details: parsedBody.error.format() }, { status: 400 });
      }
      videoDataUri = parsedBody.data.videoDataUri;
      direction = parsedBody.data.direction;

    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Please use multipart/form-data or application/json.' }, { status: 415 });
    }

    const input: CountVisitorsInput = {
      videoDataUri: videoDataUri,
      direction: direction,
    };

    const result: CountVisitorsOutput = await countVisitors(input);
    return NextResponse.json({ ...result, videoFileName }, { status: 200 });

  } catch (error: any) {
    console.error('API Error processing video:', error);
    let errorMessage = 'Failed to process video.';
    if (error instanceof z.ZodError) {
        errorMessage = 'Invalid request body format.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage, details: error instanceof z.ZodError ? error.format() : undefined }, { status: 500 });
  }
}
