
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log("--- SIMPLIFIED /api/upload-video POST request received ---");
  try {
    const requestTimestamp = new Date().toISOString();
    console.log(`Simplified handler executed at: ${requestTimestamp}`);

    // Log request headers (optional, for more context if needed)
    // const headersObject: Record<string, string> = {};
    // request.headers.forEach((value, key) => {
    //   headersObject[key] = value;
    // });
    // console.log("Request Headers:", JSON.stringify(headersObject, null, 2));

    // Attempt to read the body if it's form-data, just to see if it errors
    let bodyContentDescription = "No body processed or body is not FormData.";
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        const file = formData.get('videoFile');
        if (file) {
          bodyContentDescription = `FormData processed, videoFile field found: ${(file as File).name}`;
        } else {
          bodyContentDescription = "FormData processed, videoFile field NOT found.";
        }
        console.log(bodyContentDescription);
      } catch (e: any) {
        console.error("Error processing FormData in simplified route:", e.message);
        bodyContentDescription = `Error processing FormData: ${e.message}`;
      }
    } else if (contentType.includes('application/json')) {
         try {
            const jsonBody = await request.json();
            console.log("JSON body received:", jsonBody);
            bodyContentDescription = "JSON body processed.";
         } catch (e: any) {
            console.error("Error processing JSON body in simplified route:", e.message);
            bodyContentDescription = `Error processing JSON body: ${e.message}`;
         }
    }


    return NextResponse.json({
      message: "Simplified API route processed successfully!",
      timestamp: requestTimestamp,
      bodyInfo: bodyContentDescription,
      status: "ok_simplified"
    }, { status: 200 });

  } catch (error: any) {
    const errorTimestamp = new Date().toISOString();
    console.error(`--- SIMPLIFIED API Error at ${errorTimestamp} ---`);
    if (error instanceof Error) {
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
    } else {
        console.error("Raw Error Object/Value:", error);
    }
    return NextResponse.json({
        error: 'Simplified API failed to process.',
        messageFromServer: error instanceof Error ? error.message : 'Unknown error',
        details: 'See server logs for more details from simplified route.'
    }, { status: 500 });
  }
}
