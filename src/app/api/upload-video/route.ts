
import { NextResponse, type NextRequest } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import type { Direction } from '@/ai/types';
import { dbAdmin } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { parse as dateParseFn, isValid as isValidDateFn, formatISO } from 'date-fns';

// Add a new, unmistakable version marker to force redeploy and confirm it's running.
console.log("--- MODULE LEVEL: /api/upload-video/route.ts re-loaded (v_FINAL_FIX_0711) ---");

export async function POST(request: NextRequest) {
  const handlerStartTime = new Date().toISOString();
  console.log(`[API] POST /api/upload-video received at ${handlerStartTime}`);

  try {
    const formData = await request.formData();
    const videoFile = formData.get('videoFile') as File | null;
    const direction = formData.get('direction') as Direction | null;
    const uploadSource = (formData.get('uploadSource') as 'ui' | 'api' | null) || 'api';

    const locationNameStr = formData.get('locationName') as string | null;
    const recordingDateStr = formData.get('recordingDate') as string | null;
    const recordingTimeStr = formData.get('recordingTime') as string | null;

    console.log('[API] --- FORM DATA RECEIVED ---');
    console.log(`  - locationName: "${locationNameStr}"`);
    console.log(`  - recordingDate: "${recordingDateStr}" (Type: ${typeof recordingDateStr})`);
    console.log(`  - recordingTime: "${recordingTimeStr}" (Type: ${typeof recordingTimeStr})`);
    console.log(`  - direction: "${direction}"`);
    console.log('-----------------------------');

    if (!videoFile || !direction || !locationNameStr || !recordingDateStr || !recordingTimeStr) {
        const missingFields = [
            !videoFile && "videoFile",
            !direction && "direction",
            !locationNameStr && "locationName",
            !recordingDateStr && "recordingDate",
            !recordingTimeStr && "recordingTime"
        ].filter(Boolean).join(", ");
        
        console.error(`[API] Validation Error: Missing required fields: ${missingFields}.`);
        return NextResponse.json({ error: `Missing required form data fields: ${missingFields}` }, { status: 400 });
    }
    
    // --- ROBUST DATE/TIME PARSING ---
    let recordingStartDateTimeForFirestore: Timestamp;
    const dateTimeString = `${recordingDateStr} ${recordingTimeStr}`;
    const parsingFormat = 'yyyy-MM-dd HH:mm:ss'; // Correct format with seconds
    console.log(`[API] Attempting to parse date/time string: "${dateTimeString}" with format '${parsingFormat}'`);
    
    const parsedDate = dateParseFn(dateTimeString, parsingFormat, new Date());
    
    if (isValidDateFn(parsedDate)) {
        recordingStartDateTimeForFirestore = Timestamp.fromDate(parsedDate);
        console.log(`[API] Date/time parsed SUCCESSFULLY. Firestore Timestamp will be created from: ${formatISO(parsedDate)}`);
    } else {
        // THIS IS THE CRITICAL ERROR HANDLING.
        // If parsing fails, we MUST stop and return a specific server error.
        const errorMessage = `CRITICAL: Date/time parsing FAILED on server. Input string from script was "${dateTimeString}", server tried format "${parsingFormat}". This is a server-side error.`;
        console.error(`[API] ${errorMessage}`);
        
        // Return a 500 Internal Server Error because the server failed to process the data from the script.
        // This will cause the Python script's request to fail, which is the correct behavior.
        return NextResponse.json({
            error: 'Internal Server Error: Failed to parse date/time from upload.',
            details: errorMessage
        }, { status: 500 });
    }
    // --- END DATE/TIME PARSING ---

    const videoBuffer = await videoFile.arrayBuffer();
    const videoDataUri = `data:${videoFile.type};base64,${Buffer.from(videoBuffer).toString('base64')}`;

    const aiInput: CountVisitorsInput = { videoDataUri, direction };
    console.log(`[API] Calling Genkit flow 'countVisitors' for location: ${locationNameStr}`); 
    const aiResponse: CountVisitorsOutput = await countVisitors(aiInput);
    console.log(`[API] Genkit flow 'countVisitors' responded:`, JSON.stringify(aiResponse));

    if (!aiResponse || typeof aiResponse.visitorCount !== 'number') {
        throw new Error("Invalid or incomplete response from AI processing flow.");
    }

    const processingTimestampForFirestore = Timestamp.now();

    const dataToSave = {
      visitorCount: aiResponse.visitorCount,
      countedDirection: aiResponse.countedDirection,
      processingTimestamp: processingTimestampForFirestore,
      videoFileName: videoFile.name, 
      recordingStartDateTime: recordingStartDateTimeForFirestore,
      uploadSource: uploadSource,
      locationName: locationNameStr,
    };

    console.log("[API] Saving to Firestore:", {
        ...dataToSave,
        recordingStartDateTime: formatISO(parsedDate), // Log the ISO string for clarity
    });
    
    const docRef = await dbAdmin.collection('visitor_logs').add(dataToSave);
    console.log(`[API] Saved to Firestore. Doc ID: ${docRef.id}`);

    const responsePayload = {
      id: docRef.id,
      ...dataToSave,
      processingTimestamp: processingTimestampForFirestore.toDate().toISOString(),
      recordingStartDateTime: recordingStartDateTimeForFirestore.toDate().toISOString(),
    };
    
    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error: any) {
    console.error(`[API] --- UNHANDLED ERROR in /api/upload-video ---`);
    console.error("[API] Error Message:", error.message);
    if (error.stack) {
        console.error("[API] Error Stack:", error.stack);
    }
    
    return NextResponse.json({
        error: 'Failed to process video due to an internal server error.',
        messageFromServer: error.message || 'An unknown error occurred.',
    }, { status: 500 });
  }
}
