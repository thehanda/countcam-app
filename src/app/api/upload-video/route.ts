
import { type NextRequest, NextResponse } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import { DirectionEnum, type Direction } from '@/ai/types';
import { z } from 'zod';
import { parse as dateParse, isValid as isValidDate, format } from 'date-fns';

// Helper function to convert ArrayBuffer to Base64 string using Node.js Buffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const IsoDateTimeStringSchema = z.string().datetime({ offset: true }); // Expect ISO 8601 format

const ApiJsonInputSchema = z.object({
  videoDataUri: z.string().refine(s => s.startsWith('data:video/') && s.includes(';base64,'), {
    message: "videoDataUri must be a valid video data URI with base64 encoding."
  }),
  direction: DirectionEnum,
  recordingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "recordingDate must be in YYYY-MM-DD format.").optional(),
  recordingTime: z.string().regex(/^\d{2}:\d{2}$/, "recordingTime must be in HH:MM format.").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let videoDataUri: string;
    let direction: Direction;
    let videoFileName: string | undefined = 'uploaded_video';
    let recordingDateStr: string | undefined;
    let recordingTimeStr: string | undefined;
    let recordingStartDateTime: Date | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('videoFile') as File | null;
      const directionString = formData.get('direction') as string | null;
      const recDate = formData.get('recordingDate') as string | null;
      const recTime = formData.get('recordingTime') as string | null;


      if (!file) {
        return NextResponse.json({ error: 'No video file found in form data. Please use field name "videoFile".' }, { status: 400 });
      }
      if (!directionString) {
        return NextResponse.json({ error: 'No direction specified in form data. Please use field name "direction".' }, { status: 400 });
      }

      const parsedDirection = DirectionEnum.safeParse(directionString);
      if (!parsedDirection.success) {
        return NextResponse.json({ error: `Invalid direction value: ${directionString}. Must be one of 'entering', 'exiting'.` , details: parsedDirection.error.format() }, { status: 400 });
      }
      direction = parsedDirection.data;
      
      videoFileName = file.name;
      if (recDate) recordingDateStr = recDate;
      if (recTime) recordingTimeStr = recTime;


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
      if (parsedBody.data.recordingDate) recordingDateStr = parsedBody.data.recordingDate;
      if (parsedBody.data.recordingTime) recordingTimeStr = parsedBody.data.recordingTime;

    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Please use multipart/form-data or application/json.' }, { status: 415 });
    }

    if (recordingDateStr && recordingTimeStr) {
      // Validate date and time formats before parsing
      if (!/^\d{4}-\d{2}-\d{2}$/.test(recordingDateStr) || !/^\d{2}:\d{2}$/.test(recordingTimeStr)) {
        return NextResponse.json({ error: 'Invalid recordingDate or recordingTime format. Use YYYY-MM-DD and HH:MM.' }, { status: 400 });
      }
      const parsedDateTime = dateParse(`${recordingDateStr} ${recordingTimeStr}`, 'yyyy-MM-dd HH:mm', new Date());
      if (isValidDate(parsedDateTime)) {
        recordingStartDateTime = parsedDateTime;
      } else {
        // Log a warning but proceed without it if parsing fails
        console.warn(`Could not parse recordingDate '${recordingDateStr}' and recordingTime '${recordingTimeStr}' into a valid date.`);
      }
    }


    const input: CountVisitorsInput = {
      videoDataUri: videoDataUri,
      direction: direction,
    };

    const result: CountVisitorsOutput = await countVisitors(input);
    
    const responsePayload: any = {
      ...result,
      videoFileName,
      processingTimestamp: new Date().toISOString(),
    };

    if (recordingStartDateTime) {
      responsePayload.recordingStartDateTime = recordingStartDateTime.toISOString();
    }

    return NextResponse.json(responsePayload, { status: 200 });

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

