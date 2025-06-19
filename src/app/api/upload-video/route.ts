
import { NextResponse, type NextRequest } from 'next/server';

// These console.logs at the module level should appear when the module is loaded by Next.js
console.log("--- MODULE LEVEL LOG: /api/upload-video/route.ts loaded (GitHub Deployed Version) ---");
process.stdout.write("--- MODULE LEVEL STDOUT: /api/upload-video/route.ts loaded (GitHub Deployed Version) ---\n");

export async function POST(request: NextRequest) {
  const handlerExecutionTime = new Date().toISOString();
  console.log(`--- MINIMAL POST HANDLER (GitHub Deployed Version): /api/upload-video received request at ${handlerExecutionTime} ---`);
  process.stdout.write(`--- MINIMAL POST STDOUT (GitHub Deployed Version): /api/upload-video received request at ${handlerExecutionTime} ---\n`);

  try {
    const requestTimestamp = new Date().toISOString();
    let bodyContentDescription = "No body processed or body not FormData/JSON.";
    const contentType = request.headers.get('content-type') || '';

    console.log(`Content-Type (GitHub Deployed Version): ${contentType}`);
    process.stdout.write(`Content-Type (GitHub Deployed Version): ${contentType}\n`);

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
        console.error("Error processing FormData in minimal route (GitHub Deployed Version):", e.message);
        process.stderr.write(`Error processing FormData (GitHub Deployed Version): ${e.message}\n`);
        bodyContentDescription = `Error processing FormData: ${e.message}`;
      }
    } else if (contentType.includes('application/json')) {
       try {
          const jsonBody = await request.json();
          console.log("Minimal JSON body received (GitHub Deployed Version):", jsonBody);
          process.stdout.write(`Minimal JSON body received (GitHub Deployed Version): ${JSON.stringify(jsonBody)}\n`);
          bodyContentDescription = "Minimal JSON body processed.";
       } catch (e: any) {
          console.error("Error processing JSON body in minimal route (GitHub Deployed Version):", e.message);
          process.stderr.write(`Error processing JSON body (GitHub Deployed Version): ${e.message}\n`);
          bodyContentDescription = `Error processing JSON body: ${e.message}`;
       }
    }

    console.log(`Body info (GitHub Deployed Version): ${bodyContentDescription}`);
    process.stdout.write(`Body info (GitHub Deployed Version): ${bodyContentDescription}\n`);

    return NextResponse.json({
      message: "Minimal API route (GitHub Deployed Version) processed successfully!",
      timestamp: requestTimestamp,
      bodyInfo: bodyContentDescription,
      status: "ok_minimal_github_deployed"
    }, { status: 200 });

  } catch (error: any) {
    const errorTimestamp = new Date().toISOString();
    console.error(`--- MINIMAL API Error (GitHub Deployed Version) at ${errorTimestamp} ---`);
    process.stderr.write(`--- MINIMAL API Error (GitHub Deployed Version) at ${errorTimestamp} ---\n`);
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
        error: 'Minimal API (GitHub Deployed Version) failed to process.',
        messageFromServer: error instanceof Error ? error.message : 'Unknown error',
        details: 'See server logs for more details from minimal route (GitHub Deployed Version).'
    }, { status: 500 });
  }
}

// Ensure the route is treated as dynamic and not statically rendered or cached aggressively.
export const dynamic = 'force-dynamic';
