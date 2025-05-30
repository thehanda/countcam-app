"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Users, CalendarDays, Clock, UploadCloud, FileVideo, AlertCircle, CheckCircle2 } from "lucide-react";
import { countVisitors, type CountVisitorsOutput } from "@/ai/flows/count-visitors";
import { format } from "date-fns";
import Header from "@/components/layout/Header"; // Assuming Header is in src/components/layout/Header.tsx

interface StatisticsData extends CountVisitorsOutput {
  timestamp: Date;
  videoFileName: string;
}

export default function CountCamPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    if (videoFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(videoFile);
    } else {
      setFilePreview(null);
    }
  }, [videoFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setStatistics(null);
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit for example
        setError("File is too large. Please upload a video under 50MB.");
        setVideoFile(null);
        event.target.value = ""; // Reset file input
        return;
      }
      if (!file.type.startsWith("video/")) {
        setError("Invalid file type. Please upload a video file.");
        setVideoFile(null);
        event.target.value = ""; // Reset file input
        return;
      }
      setVideoFile(file);
    } else {
      setVideoFile(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!videoFile) {
      setError("Please select a video file to upload.");
      return;
    }

    setProcessing(true);
    setError(null);
    setStatistics(null);

    try {
      const videoDataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(videoFile);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      const result = await countVisitors({ videoDataUri });
      setStatistics({
        ...result,
        timestamp: new Date(),
        videoFileName: videoFile.name,
      });
    } catch (err) {
      console.error("Error processing video:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during processing.";
      setError(`Failed to count visitors: ${errorMessage}. Please try a different video or check the video format.`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <UploadCloud className="text-primary" />
                Upload Video Footage
              </CardTitle>
              <CardDescription>
                Select a video file to count the number of visitors. Max file size: 50MB.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    id="videoFile"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    disabled={processing}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  {videoFile && !error && (
                     <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 border rounded-md bg-secondary/50">
                        <FileVideo className="w-5 h-5 text-primary" />
                        <span>Selected: {videoFile.name} ({(videoFile.size / (1024*1024)).toFixed(2)} MB)</span>
                    </div>
                  )}
                </div>
                {filePreview && videoFile && !error && (
                  <div className="mt-4 border rounded-md overflow-hidden">
                     <video controls src={filePreview} className="w-full max-h-60 aspect-video object-contain bg-muted"></video>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={processing || !videoFile} className="w-full">
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      Count Visitors
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {error && (
            <Alert variant="destructive" className="shadow-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {statistics && !processing && (
            <Card className="shadow-lg bg-gradient-to-br from-card to-secondary/30">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center text-accent-foreground gap-2">
                   <CheckCircle2 className="text-accent" />
                   Visitor Count Results
                </CardTitle>
                <CardDescription className="text-accent-foreground/80">
                  Analysis complete for: <strong>{statistics.videoFileName}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-lg">
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                  <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-accent" />
                    <span className="font-medium text-foreground">Total Visitors:</span>
                  </div>
                  <span className="font-bold text-3xl text-accent">{statistics.visitorCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                   <div className="flex items-center gap-3">
                    <CalendarDays className="h-6 w-6 text-primary" />
                    <span className="font-medium text-foreground">Date Processed:</span>
                  </div>
                  <span className="font-semibold text-primary">{format(statistics.timestamp, "PPP")}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                  <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-primary" />
                    <span className="font-medium text-foreground">Time Processed:</span>
                  </div>
                  <span className="font-semibold text-primary">{format(statistics.timestamp, "p")}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <footer className="text-center py-4 border-t text-sm text-muted-foreground">
        CountCam &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
