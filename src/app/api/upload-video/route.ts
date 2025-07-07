
import { NextResponse, type NextRequest } from 'next/server';
import { countVisitors, type CountVisitorsInput, type CountVisitorsOutput } from '@/ai/flows/count-visitors';
import type { Direction } from '@/ai/types';
import { dbAdmin } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { parseISO, isValid as isValidDateFn, formatISO } from 'date-fns';

// Add a new, unmistakable version marker to force redeploy and confirm it's running.
console.log("--- MODULE LEVEL: /api/upload-video/route.ts re-loaded (v_TIMEZONE_FIX_0712) ---");

export async function POST(request: NextRequest) {
  const handlerStartTime = new Date().toISOString();
  console.log(`[API] POST /api/upload-video received at ${handlerStartTime}`);

  try {
    const formData = await request.formData();
    const videoFile = formData.get('videoFile') as File | null;
    const direction = formData.get('direction') as Direction | null;
    const uploadSource = (formData.get('uploadSource') as 'ui' | 'api' | null) || 'api';
    const locationNameStr = formData.get('locationName') as string | null;
    // Get the single, standardized timestamp field from both UI and Python script
    const recordingTimestamp = formData.get('recordingTimestamp') as string | null;

    console.log('[API] --- FORM DATA RECEIVED ---');
    console.log(`  - locationName: "${locationNameStr}"`);
    console.log(`  - direction: "${direction}"`);
    console.log(`  - uploadSource: "${uploadSource}"`);
    console.log(`  - recordingTimestamp: "${recordingTimestamp}"`);
    console.log('-----------------------------');

    if (!videoFile || !direction || !locationNameStr || !recordingTimestamp) {
        const missingFields = [
            !videoFile && "videoFile",
            !direction && "direction",
            !locationNameStr && "locationName",
            !recordingTimestamp && "recordingTimestamp"
        ].filter(Boolean).join(", ");
        
        console.error(`[API] Validation Error: Missing required fields: ${missingFields}.`);
        return NextResponse.json({ error: `Missing required form data fields: ${missingFields}` }, { status: 400 });
    }
    
    // --- ROBUST DATE/TIME PARSING ---
    let recordingStartDateTimeForFirestore: Timestamp;
    console.log(`[API] Attempting to parse ISO date/time string: "${recordingTimestamp}"`);
    
    // parseISO handles ISO 8601 strings with 'Z' (UTC) or '+-HH:mm' offsets correctly.
    // This unifies the logic for both UI and Python script submissions.
    const parsedDate = parseISO(recordingTimestamp);
    
    if (isValidDateFn(parsedDate)) {
        recordingStartDateTimeForFirestore = Timestamp.fromDate(parsedDate);
        console.log(`[API] Date/time parsed SUCCESSFULLY. Firestore Timestamp will be created from: ${formatISO(parsedDate)}`);
    } else {
        const errorMessage = `CRITICAL: Date/time parsing FAILED on server. Input string from client was "${recordingTimestamp}".`;
        console.error(`[API] ${errorMessage}`);
        
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
