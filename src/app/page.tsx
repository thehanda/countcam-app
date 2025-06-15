
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Users, CalendarDays, Clock, UploadCloud, FileVideo, AlertCircle, CheckCircle2, ListChecks, Trash2, CornerRightDown, CornerRightUp, Download, Video } from "lucide-react";
import { countVisitors, type CountVisitorsOutput } from "@/ai/flows/count-visitors";
import { type Direction } from "@/ai/types";
import { format, parse } from "date-fns";
import Header from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";


interface StatisticsData extends CountVisitorsOutput {
  id: string;
  timestamp: Date; // Processing timestamp
  videoFileName: string;
  recordingStartDateTime: Date; // Actual recording start time
}

const LOCAL_STORAGE_KEY = "visitorCountHistory";

interface HourlyAggregatedData {
  [date: string]: {
    [timeSlot: string]: {
      entering: number;
      exiting: number;
    };
  };
}


export default function CountCamPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [currentStatistics, setCurrentStatistics] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [history, setHistory] = useState<StatisticsData[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<Direction>("entering");
  
  const defaultRecordingDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const defaultRecordingTime = useMemo(() => format(new Date(), "HH:mm"), []);
  
  const [recordingDate, setRecordingDate] = useState<string>(defaultRecordingDate);
  const [recordingTime, setRecordingTime] = useState<string>(defaultRecordingTime);
  
  const { toast } = useToast();

  useEffect(() => {
    const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedHistory) {
      try {
        const parsedHistory: StatisticsData[] = JSON.parse(storedHistory).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
          recordingStartDateTime: item.recordingStartDateTime ? new Date(item.recordingStartDateTime) : new Date(item.timestamp), // Fallback for old data
        }));
        setHistory(parsedHistory);
      } catch (e) {
        console.error("Failed to parse history from localStorage", e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
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
       // Reset recording date/time to current when a new file is selected, or keep existing?
      // For now, let's keep the user's potentially modified date/time or the initial default.
      // If we want to reset:
      // setRecordingDate(format(new Date(), "yyyy-MM-dd"));
      // setRecordingTime(format(new Date(), "HH:mm"));
    } else {
      setFilePreview(null);
    }
  }, [videoFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setCurrentStatistics(null);
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError("File is too large. Please upload a video under 50MB.");
        setVideoFile(null);
        if (event.target) event.target.value = "";
        return;
      }
      if (!file.type.startsWith("video/")) {
        setError("Invalid file type. Please upload a video file. Recommended: MP4, MOV, AVI. MKV files or other less common formats may not be processed correctly by the AI.");
        setVideoFile(null);
        if (event.target) event.target.value = "";
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
    if (!recordingDate || !recordingTime) {
      setError("Please set the recording start date and time.");
      return;
    }

    let startDateTime;
    try {
      startDateTime = parse(`${recordingDate} ${recordingTime}`, 'yyyy-MM-dd HH:mm', new Date());
      if (isNaN(startDateTime.getTime())) {
        throw new Error("Invalid date or time format.");
      }
    } catch (parseError) {
      setError("Invalid recording start date or time. Please use YYYY-MM-DD and HH:MM format.");
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please check the recording start date and time.",
      });
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

      const result = await countVisitors({ videoDataUri, direction: selectedDirection });

      const newEntry: StatisticsData = {
        ...result,
        id: Date.now().toString() + Math.random().toString(36).substring(2,9),
        timestamp: new Date(), // Processing time
        recordingStartDateTime: startDateTime, // User-provided recording start time
        videoFileName: videoFile.name,
      };

      setCurrentStatistics(newEntry);

      const updatedHistory = [newEntry, ...history];
      setHistory(updatedHistory);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
      toast({
        title: "Processing Complete",
        description: `Visitor count for ${newEntry.videoFileName} (Recorded: ${format(newEntry.recordingStartDateTime, "PP p")}, Direction: ${getDirectionLabel(newEntry.countedDirection, false)}) is ${newEntry.visitorCount}.`,
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

  const memoizedHistory = useMemo(() => history.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()), [history]);

  const getDirectionLabel = (direction: Direction | string | undefined, useIconText: boolean = true) => {
    if (!direction) return "N/A";
    const iconTextEntering = useIconText ? "R→L" : "Entering";
    const iconTextExiting = useIconText ? "L→R" : "Exiting";
    
    switch (direction) {
      case "entering": return iconTextEntering;
      case "exiting": return iconTextExiting;
      default: return direction;
    }
  };
  
  const aggregateHourlyData = (historyData: StatisticsData[]): HourlyAggregatedData => {
    const aggregated: HourlyAggregatedData = {};

    historyData.forEach(entry => {
      if (!entry.recordingStartDateTime) return; // Skip if no recording start time

      const entryDate = format(entry.recordingStartDateTime, "yyyy-MM-dd");
      const hour = entry.recordingStartDateTime.getHours();
      const timeSlot = `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59`;

      if (!aggregated[entryDate]) {
        aggregated[entryDate] = {};
      }
      if (!aggregated[entryDate][timeSlot]) {
        aggregated[entryDate][timeSlot] = { entering: 0, exiting: 0 };
      }

      if (entry.countedDirection === 'entering') {
        aggregated[entryDate][timeSlot].entering += entry.visitorCount;
      } else if (entry.countedDirection === 'exiting') {
        aggregated[entryDate][timeSlot].exiting += entry.visitorCount;
      }
    });
    return aggregated;
  };

  const handleDownloadCSV = () => {
    if (history.length === 0) {
      toast({
        variant: "default",
        title: "No Data",
        description: "There is no history data to export.",
      });
      return;
    }

    const aggregatedData = aggregateHourlyData(history);
    if (Object.keys(aggregatedData).length === 0) {
         toast({
            variant: "default",
            title: "No Data for Report",
            description: "No entries with valid recording start times found to generate the report.",
        });
        return;
    }
    const csvRows = ["Date,Time Slot,Entering Visitors,Exiting Visitors"];
    const sortedDates = Object.keys(aggregatedData).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    for (const date of sortedDates) {
      const hourlyData = aggregatedData[date];
      const sortedTimeSlots = Object.keys(hourlyData).sort((a, b) => {
        const hourA = parseInt(a.split(':')[0]);
        const hourB = parseInt(b.split(':')[0]);
        return hourA - hourB;
      });

      for (const timeSlot of sortedTimeSlots) {
        const counts = hourlyData[timeSlot];
        csvRows.push(`${date},"${timeSlot}",${counts.entering},${counts.exiting}`);
      }
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const reportDateStr = format(new Date(), "yyyyMMdd");
    link.setAttribute("download", `CountCam_HourlyReport_${reportDateStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "CSV Downloaded",
      description: "Hourly visitor report has been downloaded.",
    });
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
                Select a video file. Recommended: MP4, MOV, AVI (using H.264 codec). Max file size: 50MB.
                MKV files or other less common formats/codecs may not be processed correctly by the AI.
                Set the actual recording start date and time for accurate hourly reports.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="videoFile">Video File</Label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recordingDate">Recording Start Date</Label>
                    <Input
                      id="recordingDate"
                      type="date"
                      value={recordingDate}
                      onChange={(e) => setRecordingDate(e.target.value)}
                      disabled={processing}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recordingTime">Recording Start Time</Label>
                    <Input
                      id="recordingTime"
                      type="time"
                      value={recordingTime}
                      onChange={(e) => setRecordingTime(e.target.value)}
                      disabled={processing}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">Counting Direction</Label>
                  <RadioGroup
                    value={selectedDirection}
                    onValueChange={(value) => setSelectedDirection(value as Direction)}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    disabled={processing}
                  >
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent/5 has-[input:checked]:bg-primary/10 has-[input:checked]:border-primary transition-all">
                      <RadioGroupItem value="entering" id="dir-entering" />
                      <Label htmlFor="dir-entering" className="flex items-center gap-2 cursor-pointer text-sm sm:text-base">
                        <CornerRightDown className="w-5 h-5 text-green-500" />
                        R→L (Entering)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent/5 has-[input:checked]:bg-primary/10 has-[input:checked]:border-primary transition-all">
                      <RadioGroupItem value="exiting" id="dir-exiting" />
                      <Label htmlFor="dir-exiting" className="flex items-center gap-2 cursor-pointer text-sm sm:text-base">
                        <CornerRightUp className="w-5 h-5 text-red-500" />
                        L→R (Exiting)
                      </Label>
                    </div>
                  </RadioGroup>
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
                    {currentStatistics.countedDirection === 'entering' && <CornerRightDown className="h-6 w-6 text-primary" />}
                    {currentStatistics.countedDirection === 'exiting' && <CornerRightUp className="h-6 w-6 text-primary" />}
                    <span className="font-medium text-foreground">Counted Direction:</span>
                  </div>
                  <span className="font-semibold text-primary">{getDirectionLabel(currentStatistics.countedDirection, false)}</span>
                </div>
                 <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                   <div className="flex items-center gap-3">
                    <Video className="h-6 w-6 text-primary" />
                    <span className="font-medium text-foreground">Recording Started:</span>
                  </div>
                  <span className="font-semibold text-primary">{format(currentStatistics.recordingStartDateTime, "PP p")}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm">
                   <div className="flex items-center gap-3">
                    <CalendarDays className="h-6 w-6 text-primary" />
                    <span className="font-medium text-foreground">Processed On:</span>
                  </div>
                  <span className="font-semibold text-primary">{format(currentStatistics.timestamp, "PP p")}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {memoizedHistory.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-grow">
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <ListChecks className="text-primary" />
                    Processing History
                  </CardTitle>
                  <CardDescription>
                    Previously processed video counts. Hourly report uses recording start time.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                   <Button variant="outline" size="sm" onClick={handleDownloadCSV} aria-label="Download hourly report CSV" className="flex-1 sm:flex-none">
                    <Download className="mr-2 h-4 w-4" />
                    Download Report (CSV)
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearHistory} aria-label="Clear history" className="flex-1 sm:flex-none">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear History
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Video File</TableHead>
                      <TableHead className="text-center">Direction</TableHead>
                      <TableHead className="text-center">Visitors</TableHead>
                      <TableHead>Recording Started</TableHead>
                      <TableHead className="text-right">Processed On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memoizedHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium truncate max-w-[150px] sm:max-w-[180px]">{entry.videoFileName}</TableCell>
                        <TableCell className="text-center">{getDirectionLabel(entry.countedDirection)}</TableCell>
                        <TableCell className="text-center font-semibold text-accent">{entry.visitorCount}</TableCell>
                        <TableCell>{format(entry.recordingStartDateTime, "PP p")}</TableCell>
                        <TableCell className="text-right">{format(entry.timestamp, "PP p")}</TableCell>
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

