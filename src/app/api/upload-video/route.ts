
import { NextResponse, type NextRequest } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import type { Direction } from '@/ai/types';
import { dbAdmin } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { parse as dateParseFn, isValid as isValidDateFn, formatISO } from 'date-fns';

console.log("--- MODULE LEVEL LOG: /api/upload-video/route.ts loaded (AI Processing Version with Full Logging) ---");

export async function POST(request: NextRequest) {
  const handlerStartTime = new Date().toISOString();
  console.log(`--- API POST /api/upload-video (AI Processing Version) received request at ${handlerStartTime} ---`);

  try {
    const formData = await request.formData();
    const videoFile = formData.get('videoFile') as File | null;
    const direction = formData.get('direction') as Direction | null;
    const recordingDateStr = formData.get('recordingDate') as string | null;
    const recordingTimeStr = formData.get('recordingTime') as string | null;
    const uploadSource = (formData.get('uploadSource') as 'ui' | 'api' | null) || 'api';
    const locationName = formData.get('locationName') as string | null;

    console.log(`[API] FormData received: videoFile=${videoFile?.name}, direction=${direction}, recordingDate=${recordingDateStr}, recordingTime=${recordingTimeStr}, uploadSource=${uploadSource}, locationName=${locationName || 'N/A'}`);

    if (!videoFile) {
      console.error("[API] Error: Video file is missing from FormData.");
      return NextResponse.json({ error: 'Video file is required.' }, { status: 400 });
    }
    if (!direction || (direction !== 'entering' && direction !== 'exiting')) {
      console.error(`[API] Error: Invalid or missing direction: ${direction}. Must be 'entering' or 'exiting'.`);
      return NextResponse.json({ error: 'Valid direction (entering/exiting) is required.' }, { status: 400 });
    }
    if (!recordingDateStr || !recordingTimeStr) {
        console.warn(`[API] Warning: Recording date or time string is missing from FormData. recordingStartDateTime will be null. Date: ${recordingDateStr}, Time: ${recordingTimeStr}`);
    }

    console.log("[API] Reading video file into buffer...");
    const videoBuffer = await videoFile.arrayBuffer();
    const videoDataUri = `data:${videoFile.type};base64,${Buffer.from(videoBuffer).toString('base64')}`;
    console.log(`[API] Video file converted to data URI. Type: ${videoFile.type}, Data URI length (approx): ${videoDataUri.length}`);

    const aiInput: CountVisitorsInput = { videoDataUri, direction };
    console.log("[API] Calling Genkit flow 'countVisitors' with input:", { direction: aiInput.direction }); // Avoid logging full data URI

    const aiResponse: CountVisitorsOutput = await countVisitors(aiInput);
    console.log("[API] Genkit flow 'countVisitors' responded:", JSON.stringify(aiResponse));

    if (!aiResponse || typeof aiResponse.visitorCount !== 'number' || !aiResponse.countedDirection) {
        const errorMessage = "[API] Error: Invalid or incomplete response from AI flow.";
        console.error(errorMessage, "Received AI Response:", JSON.stringify(aiResponse));
        throw new Error("Invalid or incomplete response from AI processing flow.");
    }
    
    let recordingStartDateTimeForFirestore: Timestamp | null = null;
    if (recordingDateStr && recordingTimeStr) {
        const dateTimeString = `${recordingDateStr} ${recordingTimeStr}`;
        const parsedDate = dateParseFn(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());
        if (isValidDateFn(parsedDate)) {
            recordingStartDateTimeForFirestore = Timestamp.fromDate(parsedDate);
            console.log(`[API] Parsed recordingStartDateTime for Firestore: ${formatISO(parsedDate)}`);
        } else {
            console.warn(`[API] Warning: Could not parse recording date/time string: "${dateTimeString}". recordingStartDateTime will be null.`);
        }
    } else {
        console.log("[API] No recordingDateStr or recordingTimeStr provided, recordingStartDateTime will be null.");
    }

    const processingTimestampForFirestore = Timestamp.now();
    console.log(`[API] Processing timestamp for Firestore: ${processingTimestampForFirestore.toDate().toISOString()}`);

    const dataToSave = {
      visitorCount: aiResponse.visitorCount,
      countedDirection: aiResponse.countedDirection,
      processingTimestamp: processingTimestampForFirestore,
      videoFileName: videoFile.name,
      recordingStartDateTime: recordingStartDateTimeForFirestore,
      uploadSource: uploadSource,
      locationName: locationName || "N/A",
    };

    console.log("[API] Preparing to save data to Firestore 'visitor_logs':", {
        visitorCount: dataToSave.visitorCount,
        countedDirection: dataToSave.countedDirection,
        videoFileName: dataToSave.videoFileName,
        uploadSource: dataToSave.uploadSource,
        locationName: dataToSave.locationName,
        // Timestamps are logged above or will be logged by Firestore itself
    });

    if (!dbAdmin) {
      console.error("[API] CRITICAL: dbAdmin (Firestore Admin instance) is not initialized. Firestore save operation will fail.");
      throw new Error("Firestore admin instance is not available. Check server logs for firebaseAdmin.ts initialization.");
    }
    
    const docRef = await dbAdmin.collection('visitor_logs').add(dataToSave);
    console.log(`[API] Data successfully saved to Firestore with document ID: ${docRef.id}`);

    const responsePayload = {
      id: docRef.id,
      visitorCount: dataToSave.visitorCount,
      countedDirection: dataToSave.countedDirection,
      videoFileName: dataToSave.videoFileName,
      processingTimestamp: processingTimestampForFirestore.toDate().toISOString(),
      recordingStartDateTime: recordingStartDateTimeForFirestore ? recordingStartDateTimeForFirestore.toDate().toISOString() : null,
      uploadSource: dataToSave.uploadSource,
      locationName: dataToSave.locationName,
    };
    
    console.log("[API] Sending success response to client with payload:", JSON.stringify(responsePayload));
    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error: any) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[API] --- UNHANDLED ERROR CAUGHT at ${errorTimestamp} ---`);
    console.error("[API] Error Name:", error.name);
    console.error("[API] Error Message:", error.message);
    console.error("[API] Error Stack:", error.stack);
    
    let clientErrorMessage = 'An unexpected error occurred while processing the video.';
    if (error.message) {
        clientErrorMessage += ` Server detail: ${error.message}`;
    }

    return NextResponse.json({
        error: 'Failed to process video due to an internal server error.',
        messageFromServer: clientErrorMessage,
        details: 'Check server logs for more specific error information.'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
