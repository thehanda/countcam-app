
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, CalendarDays, Clock, UploadCloud, FileVideo, AlertCircle, CheckCircle2, ListChecks, Trash2 } from "lucide-react";
import { countVisitors, type CountVisitorsOutput } from "@/ai/flows/count-visitors";
import { format } from "date-fns";
import Header from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";


interface StatisticsData extends CountVisitorsOutput {
  id: string; // For unique key in history
  timestamp: Date;
  videoFileName: string;
}

const LOCAL_STORAGE_KEY = "visitorCountHistory";

export default function CountCamPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [currentStatistics, setCurrentStatistics] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [history, setHistory] = useState<StatisticsData[]>([]);
  const { toast } = useToast();

  // Load history from localStorage on component mount
  useEffect(() => {
    const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedHistory) {
      try {
        const parsedHistory: StatisticsData[] = JSON.parse(storedHistory).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp), // Ensure timestamp is a Date object
        }));
        setHistory(parsedHistory);
      } catch (e) {
        console.error("Failed to parse history from localStorage", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
        toast({
          variant: "destructive",
          title: "History Error",
          description: "Could not load processing history. It might have been corrupted.",
        });
      }
    }
  }, [toast]);

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
    setCurrentStatistics(null);
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        setError("File is too large. Please upload a video under 50MB.");
        setVideoFile(null);
        event.target.value = ""; 
        return;
      }
      if (!file.type.startsWith("video/")) {
        setError("Invalid file type. Please upload a video file.");
        setVideoFile(null);
        event.target.value = "";
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
    setCurrentStatistics(null);

    try {
      const videoDataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(videoFile);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      const result = await countVisitors({ videoDataUri });
      
      const newEntry: StatisticsData = {
        ...result,
        id: Date.now().toString() + Math.random().toString(36).substring(2,9), // Simple unique ID
        timestamp: new Date(),
        videoFileName: videoFile.name,
      };

      setCurrentStatistics(newEntry);

      // Update history
      const updatedHistory = [newEntry, ...history];
      setHistory(updatedHistory);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
      toast({
        title: "Processing Complete",
        description: `Visitor count for ${newEntry.videoFileName} is ${newEntry.visitorCount}.`,
        variant: "default"
      });

    } catch (err) {
      console.error("Error processing video:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during processing.";
      setError(`Failed to count visitors: ${errorMessage}. Please try a different video or check the video format.`);
       toast({
        variant: "destructive",
        title: "Processing Error",
        description: `Failed to count visitors. ${errorMessage}`,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({
      title: "History Cleared",
      description: "All processing history has been removed.",
    });
  };
  
  const memoizedHistory = useMemo(() => history, [history]);


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

          {currentStatistics && !processing && (
            <Card className="shadow-lg bg-gradient-to-br from-card to-secondary/30">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center text-accent-foreground gap-2">
                   <CheckCircle2 className="text-accent" />
                   Visitor Count Results
                </CardTitle>
                <CardDescription className="text-accent-foreground/80">
                  Analysis complete for: <strong>{currentStatistics.videoFileName}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-lg">
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                  <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-accent" />
                    <span className="font-medium text-foreground">Total Visitors:</span>
                  </div>
                  <span className="font-bold text-3xl text-accent">{currentStatistics.visitorCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                   <div className="flex items-center gap-3">
                    <CalendarDays className="h-6 w-6 text-primary" />
                    <span className="font-medium text-foreground">Date Processed:</span>
                  </div>
                  <span className="font-semibold text-primary">{format(currentStatistics.timestamp, "PPP")}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                  <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-primary" />
                    <span className="font-medium text-foreground">Time Processed:</span>
                  </div>
                  <span className="font-semibold text-primary">{format(currentStatistics.timestamp, "p")}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {memoizedHistory.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <ListChecks className="text-primary" />
                    Processing History
                  </CardTitle>
                  <CardDescription>
                    Previously processed video counts.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearHistory} aria-label="Clear history">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear History
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Video File</TableHead>
                      <TableHead className="text-center">Visitors</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memoizedHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium truncate max-w-xs">{entry.videoFileName}</TableCell>
                        <TableCell className="text-center font-semibold text-accent">{entry.visitorCount}</TableCell>
                        <TableCell className="text-right">{format(entry.timestamp, "PPP")}</TableCell>
                        <TableCell className="text-right">{format(entry.timestamp, "p")}</td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

    

    