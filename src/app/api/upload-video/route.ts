
import { NextResponse, type NextRequest } from 'next/server';

console.log("--- MODULE LEVEL LOG: /api/upload-video/route.ts loaded ---");
process.stdout.write("--- MODULE LEVEL STDOUT: /api/upload-video/route.ts loaded ---\n");

export async function POST(request: NextRequest) {
  console.log("--- MINIMAL POST HANDLER: /api/upload-video received request ---");
  process.stdout.write("--- MINIMAL POST STDOUT: /api/upload-video received request ---\n");

  try {
    const requestTimestamp = new Date().toISOString();
    let bodyContentDescription = "No body processed or body not FormData/JSON.";
    const contentType = request.headers.get('content-type') || '';

    console.log(`Content-Type: ${contentType}`);
    process.stdout.write(`Content-Type: ${contentType}\n`);

    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        const file = formData.get('videoFile');
        if (file) {
          bodyContentDescription = `FormData processed, videoFile field found: ${(file as File).name}`;
        } else {
          bodyContentDescription = "FormData processed, videoFile field NOT found.";
        }
      } catch (e: any) {
        console.error("Error processing FormData in minimal route:", e.message);
        process.stderr.write(`Error processing FormData: ${e.message}\n`);
        bodyContentDescription = `Error processing FormData: ${e.message}`;
      }
    } else if (contentType.includes('application/json')) {
       try {
          const jsonBody = await request.json();
          console.log("Minimal JSON body received:", jsonBody);
          process.stdout.write(`Minimal JSON body received: ${JSON.stringify(jsonBody)}\n`);
          bodyContentDescription = "Minimal JSON body processed.";
       } catch (e: any) {
          console.error("Error processing JSON body in minimal route:", e.message);
          process.stderr.write(`Error processing JSON body: ${e.message}\n`);
          bodyContentDescription = `Error processing JSON body: ${e.message}`;
       }
    }

    console.log(`Body info: ${bodyContentDescription}`);
    process.stdout.write(`Body info: ${bodyContentDescription}\n`);

    return NextResponse.json({
      message: "Minimal API route processed successfully!",
      timestamp: requestTimestamp,
      bodyInfo: bodyContentDescription,
      status: "ok_minimal"
    }, { status: 200 });

  } catch (error: any) {
    const errorTimestamp = new Date().toISOString();
    console.error(`--- MINIMAL API Error at ${errorTimestamp} ---`);
    process.stderr.write(`--- MINIMAL API Error at ${errorTimestamp} ---\n`);
    if (error instanceof Error) {
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        process.stderr.write(`Error Name: ${error.name}, Message: ${error.message}\n`);
    } else {
        console.error("Raw Error Object/Value:", error);
        process.stderr.write(`Raw Error: ${JSON.stringify(error)}\n`);
    }
    return NextResponse.json({
        error: 'Minimal API failed to process.',
        messageFromServer: error instanceof Error ? error.message : 'Unknown error',
        details: 'See server logs for more details from minimal route.'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
