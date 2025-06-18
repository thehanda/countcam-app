
"use client";

import { useState, type ChangeEvent, type FormEvent, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, CalendarDays, UploadCloud, FileVideo, AlertCircle, CheckCircle2, ListChecks, Download, Video, Files, DatabaseZap } from "lucide-react";
import { type Direction } from "@/ai/types";
import { format, parseISO, isValid as isValidDate, parse as dateParseFn } from "date-fns";
import Header from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp, type DocumentData } from "firebase/firestore";


interface StatisticsData {
  id: string;
  visitorCount: number;
  countedDirection: Direction;
  timestamp: Date; // Processing timestamp from Firestore (converted from Timestamp)
  videoFileName: string;
  recordingStartDateTime: Date; // Actual recording start time from Firestore (converted from Timestamp)
}

interface BatchFile {
  file: File;
  parsedDate?: string;
  parsedTime?: string;
}

interface HourlyAggregatedData {
  [date: string]: {
    [timeSlot: string]: {
      entering: number;
      exiting: number;
    };
  };
}


export default function CountCamPage() {
  const [selectedFiles, setSelectedFiles] = useState<BatchFile[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [currentBatchFileIndex, setCurrentBatchFileIndex] = useState(0);
  const [lastProcessedResult, setLastProcessedResult] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StatisticsData[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<Direction>("entering");
  
  const defaultRecordingDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const defaultRecordingTime = useMemo(() => format(new Date(), "HH:mm"), []);
  
  const [formRecordingDate, setFormRecordingDate] = useState<string>(defaultRecordingDate);
  const [formRecordingTime, setFormRecordingTime] = useState<string>(defaultRecordingTime);
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "visitor_logs"), orderBy("processingTimestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedHistory: StatisticsData[] = [];
      querySnapshot.forEach((doc: DocumentData) => {
        const data = doc.data();
        const recordingStartDateTime = data.recordingStartDateTime instanceof Timestamp 
                                       ? data.recordingStartDateTime.toDate()
                                       : (data.recordingStartDateTime ? parseISO(data.recordingStartDateTime) : new Date(0)); // Fallback for old string data or null
        
        const processingTimestamp = data.processingTimestamp instanceof Timestamp 
                                  ? data.processingTimestamp.toDate() 
                                  : new Date(); // Fallback if not a Timestamp

        fetchedHistory.push({
          id: doc.id,
          visitorCount: data.visitorCount,
          countedDirection: data.countedDirection,
          videoFileName: data.videoFileName || 'N/A',
          recordingStartDateTime: isValidDate(recordingStartDateTime) ? recordingStartDateTime : new Date(0), // Ensure valid date
          timestamp: isValidDate(processingTimestamp) ? processingTimestamp : new Date(), // Ensure valid date
        });
      });
      setHistory(fetchedHistory);
    }, (err) => {
      console.error("Error fetching history from Firestore:", err);
      setError("Failed to load processing history from the database.");
      toast({
        variant: "destructive",
        title: "Database Error",
        description: "Could not load processing history from the database.",
      });
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [toast]);

  const parseDateTimeFromFilename = (filename: string): { date?: string; time?: string } => {
    const patterns = [
      /(?<year>\d{4})[-_]?(\d{2})[-_]?(\d{2})[-_ ]?(\d{2})[-_:]?(\d{2})[-_:]?(\d{2})/,
      /(?<year>\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
      /(?<year>\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/,
    ];

    for (const pattern of patterns) {
        const match = filename.match(pattern);
        if (match && match.groups) {
            const { year, groups } = match;
            if (match.length >= 7) {
                let month, day, hour, minute;
                if (groups && groups.year) {
                     month = match[2]; day = match[3]; hour = match[4]; minute = match[5];
                } else {
                     month = match[2]; day = match[3]; hour = match[4]; minute = match[5];
                }
                const parsedDate = dateParseFn(`${year}-${month}-${day} ${hour}:${minute}`, 'yyyy-MM-dd HH:mm', new Date());
                if (isValidDate(parsedDate)) {
                    return {
                        date: format(parsedDate, "yyyy-MM-dd"),
                        time: format(parsedDate, "HH:mm"),
                    };
                }
            }
        } else if (match) {
            const year = match[1]; const month = match[2]; const day = match[3];
            const hour = match[4]; const minute = match[5];
            const parsedDateObj = dateParseFn(`${year}-${month}-${day} ${hour}:${minute}`, 'yyyy-MM-dd HH:mm', new Date());
             if (isValidDate(parsedDateObj)) {
                return {
                    date: format(parsedDateObj, "yyyy-MM-dd"),
                    time: format(parsedDateObj, "HH:mm"),
                };
            }
        }
    }
    return {};
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setLastProcessedResult(null);
    const files = event.target.files;
    if (files && files.length > 0) {
      const newBatchFiles: BatchFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
          setError(`File "${file.name}" is too large (max 50MB). It will be skipped.`);
          continue; 
        }
        if (!file.type.startsWith("video/")) {
          setError(`File "${file.name}" is not a valid video type. It will be skipped. Recommended: MP4, MOV, AVI.`);
          continue;
        }
        const { date: parsedDate, time: parsedTime } = parseDateTimeFromFilename(file.name);
        newBatchFiles.push({ file, parsedDate, parsedTime });
      }
      setSelectedFiles(newBatchFiles);
      if (newBatchFiles.length === 0 && files.length > 0) {
        toast({ variant: "destructive", title: "No valid files selected", description: "All selected files were skipped due to size or type errors."});
      } else if (newBatchFiles.length < files.length) {
        toast({ variant: "default", title: "Some files skipped", description: "Some files were skipped due to size or type errors. Check error messages."});
      }
    } else {
      setSelectedFiles([]);
    }
  };

  const processSingleFileViaAPI = async (batchFile: BatchFile, recordingDateToUse: string, recordingTimeToUse: string) => {
    setProcessing(true);
    setError(null);
    setLastProcessedResult(null);

    const formData = new FormData();
    formData.append("videoFile", batchFile.file);
    formData.append("direction", selectedDirection);
    formData.append("recordingDate", recordingDateToUse);
    formData.append("recordingTime", recordingTimeToUse);

    try {
      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      const resultData = await response.json();

      if (!response.ok) {
        throw new Error(resultData.error || `API request failed with status ${response.status}`);
      }
      
      const apiRecordingStartDateTime = resultData.recordingStartDateTime ? parseISO(resultData.recordingStartDateTime) : new Date(0);
      const apiProcessingTimestamp = resultData.processingTimestamp ? parseISO(resultData.processingTimestamp) : new Date();

      const newEntry: StatisticsData = {
        id: resultData.id || Date.now().toString(), // ID might not come from API if not saved to DB by then, or use Firestore ID
        visitorCount: resultData.visitorCount,
        countedDirection: resultData.countedDirection,
        videoFileName: resultData.videoFileName || batchFile.file.name,
        recordingStartDateTime: isValidDate(apiRecordingStartDateTime) ? apiRecordingStartDateTime : new Date(0),
        timestamp: isValidDate(apiProcessingTimestamp) ? apiProcessingTimestamp : new Date(),
      };
      setLastProcessedResult(newEntry); // Show stats for the currently processed file
      
      toast({
        title: "Processing Complete",
        description: `Visitor count for ${newEntry.videoFileName} (Recorded: ${format(newEntry.recordingStartDateTime, "PP p")}, Direction: ${getDirectionLabel(newEntry.countedDirection, false)}) is ${newEntry.visitorCount}. Data saved to database.`,
        variant: "default"
      });
      return true;
    } catch (err) {
      console.error(`Error processing video ${batchFile.file.name} via API:`, err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to count visitors for ${batchFile.file.name}: ${errorMessage}.`);
      toast({
        variant: "destructive",
        title: `Error: ${batchFile.file.name}`,
        description: `Failed to count visitors. ${errorMessage}`,
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setError("Please select video files to upload.");
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress(0);
    setCurrentBatchFileIndex(0);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      setCurrentBatchFileIndex(i);
      const batchFile = selectedFiles[i];
      const recordingDateToUse = batchFile.parsedDate || formRecordingDate;
      const recordingTimeToUse = batchFile.parsedTime || formRecordingTime;
      
      const success = await processSingleFileViaAPI(batchFile, recordingDateToUse, recordingTimeToUse);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
      setBatchProgress(((i + 1) / selectedFiles.length) * 100);
    }
    
    setIsBatchProcessing(false);
    setSelectedFiles([]); 
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    toast({
        title: "Batch Processing Finished",
        description: `${successCount} file(s) processed successfully, ${errorCount} file(s) failed. Results saved to database.`,
        variant: successCount > 0 && errorCount === 0 ? "default" : (errorCount > 0 ? "destructive" : "default")
    });
  };

  const memoizedHistory = useMemo(() => history, [history]); // Already sorted by Firestore query

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
      if (!entry.recordingStartDateTime || !isValidDate(entry.recordingStartDateTime) || entry.recordingStartDateTime.getFullYear() < 1971) return; // Ignore invalid or fallback dates
      const entryDate = format(entry.recordingStartDateTime, "yyyy-MM-dd");
      const hour = entry.recordingStartDateTime.getHours();
      const timeSlot = `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59`;

      if (!aggregated[entryDate]) aggregated[entryDate] = {};
      if (!aggregated[entryDate][timeSlot]) aggregated[entryDate][timeSlot] = { entering: 0, exiting: 0 };

      if (entry.countedDirection === 'entering') aggregated[entryDate][timeSlot].entering += entry.visitorCount;
      else if (entry.countedDirection === 'exiting') aggregated[entryDate][timeSlot].exiting += entry.visitorCount;
    });
    return aggregated;
  };

  const handleDownloadCSV = () => {
    if (history.length === 0) {
      toast({ variant: "default", title: "No Data", description: "There is no history data to export." });
      return;
    }

    const aggregatedData = aggregateHourlyData(history);
    if (Object.keys(aggregatedData).length === 0) {
         toast({ variant: "default", title: "No Data for Report", description: "No entries with valid recording start times found to generate the report." });
        return;
    }
    const csvRows = ["Date,Time Slot,Entering Visitors,Exiting Visitors"];
    const sortedDates = Object.keys(aggregatedData).sort((a,b) => dateParseFn(a, "yyyy-MM-dd", new Date()).getTime() - dateParseFn(b, "yyyy-MM-dd", new Date()).getTime());

    for (const date of sortedDates) {
      const hourlyData = aggregatedData[date];
      const sortedTimeSlots = Object.keys(hourlyData).sort((a, b) => parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]));
      for (const timeSlot of sortedTimeSlots) {
        const counts = hourlyData[timeSlot];
        csvRows.push(`${date},"${timeSlot}",${counts.entering},${counts.exiting}`);
      }
    }

    const csvString = csvRows.join("\\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const reportDateStr = format(new Date(), "yyyyMMdd");
    link.setAttribute("download", `CountCam_HourlyVisitorReport_${reportDateStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "CSV Downloaded", description: "Hourly visitor report has been downloaded." });
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
                Select video file(s). Max 50MB. Results saved to a central database.
                Recording date/time extracted from filename (e.g., YYYYMMDD_HHMMSS) or use fallback below.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleBatchSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="videoFile">Video File(s)</Label>
                  <Input id="videoFile" type="file" accept="video/*" multiple onChange={handleFileChange} disabled={processing || isBatchProcessing} ref={fileInputRef} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                  {selectedFiles.length > 0 && !error && ( <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 border rounded-md bg-secondary/50"> <Files className="w-5 h-5 text-primary" /> <span>Selected: {selectedFiles.length} file(s)</span> </div> )}
                  {selectedFiles.map((batchFile, index) => ( <div key={index} className="text-xs text-muted-foreground ml-2"> - {batchFile.file.name} {batchFile.parsedDate && batchFile.parsedTime && ` (Parsed: ${batchFile.parsedDate} ${batchFile.parsedTime})`} </div> ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"> <Label htmlFor="recordingDate">Fallback Recording Start Date</Label> <Input id="recordingDate" type="date" value={formRecordingDate} onChange={(e) => setFormRecordingDate(e.target.value)} disabled={processing || isBatchProcessing} required /> </div>
                  <div className="space-y-2"> <Label htmlFor="recordingTime">Fallback Recording Start Time</Label> <Input id="recordingTime" type="time" value={formRecordingTime} onChange={(e) => setFormRecordingTime(e.target.value)} disabled={processing || isBatchProcessing} required /> </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-medium">Counting Direction (for all files in batch)</Label>
                  <RadioGroup value={selectedDirection} onValueChange={(value) => setSelectedDirection(value as Direction)} className="grid grid-cols-1 sm:grid-cols-2 gap-4" disabled={processing || isBatchProcessing}>
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent/5 has-[input:checked]:bg-primary/10 has-[input:checked]:border-primary transition-all"> <RadioGroupItem value="entering" id="dir-entering" /> <Label htmlFor="dir-entering" className="flex items-center gap-2 cursor-pointer text-sm sm:text-base"> <DatabaseZap className="w-5 h-5 text-green-500" /> R→L (Entering) </Label> </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent/5 has-[input:checked]:bg-primary/10 has-[input:checked]:border-primary transition-all"> <RadioGroupItem value="exiting" id="dir-exiting" /> <Label htmlFor="dir-exiting" className="flex items-center gap-2 cursor-pointer text-sm sm:text-base"> <DatabaseZap className="w-5 h-5 text-red-500" /> L→R (Exiting) </Label> </div>
                  </RadioGroup>
                </div>
                {isBatchProcessing && ( <div className="space-y-2"> <Label>Batch Progress (File {currentBatchFileIndex + 1} of {selectedFiles.length}): {selectedFiles[currentBatchFileIndex]?.file.name}</Label> <Progress value={batchProgress} className="w-full" /> </div> )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={processing || isBatchProcessing || selectedFiles.length === 0} className="w-full">
                  {isBatchProcessing ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Batch... </> ) : processing ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing File... </> ) : ( <> <Users className="mr-2 h-4 w-4" /> {selectedFiles.length > 1 ? `Process ${selectedFiles.length} Files` : (selectedFiles.length === 1 ? "Process Selected File" : "Count Visitors (Select Files)") } </> )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {error && ( <Alert variant="destructive" className="shadow-md"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle> <AlertDescription>{error}</AlertDescription> </Alert> )}
          
          <div className="py-4 text-center">
             <Button variant="outline" size="lg" onClick={handleDownloadCSV} disabled={isBatchProcessing || history.length === 0} aria-label="Download hourly visitor report CSV">
               <Download className="mr-2 h-5 w-5" />
               Hourly Visitor Report (CSV)
             </Button>
          </div>

          {lastProcessedResult && !processing && !isBatchProcessing && (
            <Card className="shadow-lg bg-gradient-to-br from-card to-secondary/30">
              <CardHeader> <CardTitle className="text-2xl flex items-center text-accent-foreground gap-2"> <CheckCircle2 className="text-accent" /> Last Processed Result (UI Upload) </CardTitle> <CardDescription className="text-accent-foreground/80"> Analysis complete for: <strong>{lastProcessedResult.videoFileName}</strong> </CardDescription> </CardHeader>
              <CardContent className="space-y-4 text-lg">
                 <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <Users className="h-6 w-6 text-accent" /> <span className="font-medium text-foreground">Total Visitors:</span> </div> <span className="font-bold text-3xl text-accent">{lastProcessedResult.visitorCount}</span> </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> {lastProcessedResult.countedDirection === 'entering' && <DatabaseZap className="h-6 w-6 text-primary" />} {lastProcessedResult.countedDirection === 'exiting' && <DatabaseZap className="h-6 w-6 text-primary" />} <span className="font-medium text-foreground">Counted Direction:</span> </div> <span className="font-semibold text-primary">{getDirectionLabel(lastProcessedResult.countedDirection, false)}</span> </div>
                 <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <Video className="h-6 w-6 text-primary" /> <span className="font-medium text-foreground">Recording Started:</span> </div> <span className="font-semibold text-primary">{lastProcessedResult.recordingStartDateTime && isValidDate(lastProcessedResult.recordingStartDateTime) && lastProcessedResult.recordingStartDateTime.getFullYear() > 1970 ? format(lastProcessedResult.recordingStartDateTime, "PP p") : 'N/A'}</span> </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <CalendarDays className="h-6 w-6 text-primary" /> <span className="font-medium text-foreground">Processed On:</span> </div> <span className="font-semibold text-primary">{format(lastProcessedResult.timestamp, "PP p")}</span> </div>
              </CardContent>
            </Card>
          )}

          {memoizedHistory.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-grow"> <CardTitle className="text-2xl flex items-center gap-2"> <ListChecks className="text-primary" /> Processing History (from Database) </CardTitle> <CardDescription> All processed video counts from API and UI uploads. </CardDescription> </div>
                {/* Clear History button removed for now
                 <Button variant="outline" size="sm" onClick={() => {toast({title: "Clear History Disabled", description:"This feature is currently not available."})}} disabled={isBatchProcessing} aria-label="Clear history" className="flex-1 sm:flex-none">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear History
                  </Button> 
                */}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader> <TableRow> <TableHead>Video File</TableHead> <TableHead className="text-center">Direction</TableHead> <TableHead className="text-center">Visitors</TableHead> <TableHead>Recording Started</TableHead> <TableHead className="text-right">Processed On</TableHead> </TableRow> </TableHeader>
                  <TableBody>
                    {memoizedHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium truncate max-w-[150px] sm:max-w-[180px]">{entry.videoFileName}</TableCell>
                        <TableCell className="text-center">{getDirectionLabel(entry.countedDirection)}</TableCell>
                        <TableCell className="text-center font-semibold text-accent">{entry.visitorCount}</TableCell>
                        <TableCell>{entry.recordingStartDateTime && isValidDate(entry.recordingStartDateTime) && entry.recordingStartDateTime.getFullYear() > 1970 ? format(entry.recordingStartDateTime, "PP p") : 'N/A'}</TableCell>
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
