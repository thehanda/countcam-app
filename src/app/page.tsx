
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
import { Loader2, Users, CalendarDays, UploadCloud, AlertCircle, CheckCircle2, ListChecks, Download, Video, Files, MapPin, ArrowRightLeft } from "lucide-react";
import { type Direction } from "@/ai/types";
import { format, parseISO, isValid as isValidDateFn, parse as dateParseFn } from "date-fns";
import Header from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp, type DocumentData } from "firebase/firestore";


interface StatisticsData {
  id: string;
  visitorCount: number;
  countedDirection: Direction;
  timestamp: Date; // This is actually processingTimestamp
  videoFileName: string;
  recordingStartDateTime: Date | null;
  uploadSource: 'ui' | 'api';
  locationName?: string;
}

interface BatchFile {
  file: File;
  parsedDate?: string;
  parsedTime?: string;
}

export default function CountCamPage() {
  const [selectedFiles, setSelectedFiles] = useState<BatchFile[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [currentBatchFileIndex, setCurrentBatchFileIndex] = useState(0);
  const [lastProcessedResult, setLastProcessedResult] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [allHistory, setAllHistory] = useState<StatisticsData[]>([]);
  const uiHistory = useMemo(() => allHistory.filter(entry => entry.uploadSource === 'ui'), [allHistory]);

  const [selectedDirection, setSelectedDirection] = useState<Direction>("entering");

  const defaultRecordingDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const defaultRecordingTime = useMemo(() => format(new Date(), "HH:mm"), []);

  const [formRecordingDate, setFormRecordingDate] = useState<string>(defaultRecordingDate);
  const [formRecordingTime, setFormRecordingTime] = useState<string>(defaultRecordingTime);
  const [formLocationName, setFormLocationName] = useState<string>("");

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log("Setting up Firestore listener for visitor_logs...");
    if (!db) {
      console.error("Firestore (db) instance is not available in page.tsx. History will not be loaded.");
      setError("Database connection not available. Please check Firebase setup.");
      toast({
        variant: "destructive",
        title: "Database Error",
        description: "Could not connect to the database to load history.",
      });
      return;
    }

    const q = query(collection(db, "visitor_logs"), orderBy("processingTimestamp", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedHistory: StatisticsData[] = [];
      querySnapshot.forEach((doc: DocumentData) => {
        const data = doc.data();
        
        let recordingStartDateTime = null;
        if (data.recordingStartDateTime instanceof Timestamp) {
            recordingStartDateTime = data.recordingStartDateTime.toDate();
        } else if (data.recordingStartDateTime && typeof data.recordingStartDateTime === 'string') {
            const parsedDate = parseISO(data.recordingStartDateTime);
            if (isValidDateFn(parsedDate)) recordingStartDateTime = parsedDate;
        } else if (data.recordingStartDateTime && typeof data.recordingStartDateTime.seconds === 'number' && typeof data.recordingStartDateTime.nanoseconds === 'number') {
            recordingStartDateTime = new Timestamp(data.recordingStartDateTime.seconds, data.recordingStartDateTime.nanoseconds).toDate();
        }


        let processingTimestampVal = new Date(); // Default to now if parsing fails
        if (data.processingTimestamp instanceof Timestamp) {
            processingTimestampVal = data.processingTimestamp.toDate();
        } else if (data.processingTimestamp && typeof data.processingTimestamp === 'string') {
            const parsedTimestamp = parseISO(data.processingTimestamp);
            if (isValidDateFn(parsedTimestamp)) processingTimestampVal = parsedTimestamp;
        } else if (data.processingTimestamp && typeof data.processingTimestamp.seconds === 'number' && typeof data.processingTimestamp.nanoseconds === 'number') {
            processingTimestampVal = new Timestamp(data.processingTimestamp.seconds, data.processingTimestamp.nanoseconds).toDate();
        }


        const uploadSource = data.uploadSource === 'ui' || data.uploadSource === 'api' ? data.uploadSource : 'api';

        fetchedHistory.push({
          id: doc.id,
          visitorCount: data.visitorCount,
          countedDirection: data.countedDirection,
          videoFileName: data.videoFileName || 'N/A',
          recordingStartDateTime: recordingStartDateTime && isValidDateFn(recordingStartDateTime) ? recordingStartDateTime : null,
          timestamp: isValidDateFn(processingTimestampVal) ? processingTimestampVal : new Date(),
          uploadSource: uploadSource,
          locationName: data.locationName || 'N/A',
        });
      });
      console.log("Fetched history from Firestore (page.tsx):", fetchedHistory.length);
      setAllHistory(fetchedHistory);
    }, (err) => {
      console.error("Error fetching history from Firestore (page.tsx):", err);
      setError("Failed to load processing history from the database.");
      toast({
        variant: "destructive",
        title: "Database Error",
        description: "Could not load processing history from the database. Check console for details.",
      });
    });

    return () => {
      console.log("Cleaning up Firestore listener (page.tsx).");
      unsubscribe();
    }
  }, [toast]); 

  const parseDateTimeFromFilename = (filename: string): { date?: string; time?: string } => {
    const patterns = [
      /(?<year>\d{4})[-_]?(\d{2})[-_]?(\d{2})[-_ ]?(\d{2})[-_:]?(\d{2})[-_:]?(\d{2})/, // YYYYMMDDHHMMSS or with separators
      /(?<year>\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, // YYYYMMDD_HHMMSS
      /(?<year>\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/, // YYYY-MM-DD_HH-MM-SS
      /_(\d{4}-\d{2}-\d{2})_(\d{6})/, // _YYYY-MM-DD_HHMMSS format from python script
    ];

    for (const pattern of patterns) {
        const match = filename.match(pattern);
        if (match) {
            let year, month, day, hour, minute, second;
            if (match.groups && match.groups['year']) {
                // Named group patterns
                year = match.groups['year'];
                month = match[2]; 
                day = match[3];
                hour = match[4];
                minute = match[5];
                second = match[6] || '00';
            } else if (match.length >= 4) {
                // Python script format
                const datePart = match[1];
                const timePart = match[2];
                [year, month, day] = datePart.split('-');
                hour = timePart.substring(0,2);
                minute = timePart.substring(2,4);
                second = timePart.substring(4,6);
            }

            if (year && month && day && hour && minute && second) {
                const parsedDate = dateParseFn(`${year}-${month}-${day} ${hour}:${minute}:${second}`, 'yyyy-MM-dd HH:mm:ss', new Date());
                if (isValidDateFn(parsedDate)) {
                    return {
                        date: format(parsedDate, "yyyy-MM-dd"),
                        time: format(parsedDate, "HH:mm:ss"),
                    };
                }
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
          setError(`ファイル "${file.name}" はサイズが大きすぎます (最大50MB)。スキップされます。`);
          toast({ variant: "destructive", title: "ファイルサイズ超過", description: `ファイル "${file.name}" は50MBを超えています。` });
          continue;
        }
        if (!file.type.startsWith("video/")) {
          setError(`ファイル "${file.name}" は有効な動画形式ではありません。スキップされます。推奨: MP4, MOV, AVI, 3GP`);
          toast({ variant: "destructive", title: "無効なファイル形式", description: `ファイル "${file.name}" は動画形式ではありません。推奨: MP4, MOV, AVI, 3GP` });
          continue;
        }
        const { date: parsedDate, time: parsedTime } = parseDateTimeFromFilename(file.name);
        newBatchFiles.push({ file, parsedDate, parsedTime });
      }
      setSelectedFiles(newBatchFiles);
      if (newBatchFiles.length === 0 && files.length > 0) {
        toast({ variant: "destructive", title: "有効なファイルが選択されていません", description: "選択された全てのファイルがサイズまたは形式エラーのためスキップされました。" });
      } else if (newBatchFiles.length < files.length && newBatchFiles.length > 0) {
         toast({ variant: "default", title: "一部ファイルがスキップされました", description: "一部のファイルがサイズまたは形式エラーのためスキップされました。エラーメッセージをご確認ください。" });
      }
    } else {
      setSelectedFiles([]);
    }
  };

  const processSingleFileViaAPI = async (batchFile: BatchFile, recordingDateToUse: string, recordingTimeToUse: string, locationNameToUse: string) => {
    setProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append("videoFile", batchFile.file);
    formData.append("direction", selectedDirection);
    
    // --- NEW TIMESTAMP LOGIC for UI uploads ---
    // Ensure time has seconds for consistent parsing
    const timeToUseWithSeconds = recordingTimeToUse.length === 5 ? `${recordingTimeToUse}:00` : recordingTimeToUse;
    // Create a date string that `new Date()` can parse as local time
    const localDateTimeString = `${recordingDateToUse}T${timeToUseWithSeconds}`;
    // Create a Date object; it will be in the browser's local timezone
    const localDate = new Date(localDateTimeString);
    // Convert to a full ISO 8601 string, which includes the timezone offset (e.g., "2023-07-12T10:30:00.000+09:00").
    // Note: toISOString() converts to UTC 'Z'. We need to construct it manually if we want to preserve offset,
    // but the backend `parseISO` can handle UTC 'Z' format perfectly, so we'll use the standard.
    const isoTimestamp = localDate.toISOString(); 
    formData.append("recordingTimestamp", isoTimestamp);
    // --- END NEW TIMESTAMP LOGIC ---

    formData.append("uploadSource", "ui"); // Explicitly 'ui' for UI uploads
    formData.append("locationName", locationNameToUse || "N/A");


    try {
      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      const resultData = await response.json();

      if (!response.ok) {
        throw new Error(resultData.error || resultData.details || resultData.messageFromServer || `APIリクエストがステータス ${response.status}で失敗しました`);
      }
      
      const apiRecordingStartDateTime = resultData.recordingStartDateTime ? parseISO(resultData.recordingStartDateTime) : null;
      const apiProcessingTimestamp = resultData.processingTimestamp ? parseISO(resultData.processingTimestamp) : new Date();

      const newEntry: StatisticsData = {
        id: resultData.id,
        visitorCount: resultData.visitorCount,
        countedDirection: resultData.countedDirection,
        videoFileName: resultData.videoFileName,
        recordingStartDateTime: apiRecordingStartDateTime && isValidDateFn(apiRecordingStartDateTime) ? apiRecordingStartDateTime : null,
        timestamp: isValidDateFn(apiProcessingTimestamp) ? apiProcessingTimestamp : new Date(),
        uploadSource: 'ui', 
        locationName: resultData.locationName,
      };
      setLastProcessedResult(newEntry); 

      toast({
        title: "処理完了",
        description: `${newEntry.videoFileName} (${newEntry.locationName}) の訪問者数 (記録日時: ${newEntry.recordingStartDateTime ? format(newEntry.recordingStartDateTime, "PP p") : 'N/A'}, 方向: ${getDirectionLabel(newEntry.countedDirection)}) は ${newEntry.visitorCount} です。データは保存されました。`,
        variant: "default"
      });
      return true; 
    } catch (err) {
      console.error(`動画 ${batchFile.file.name} のAPI経由処理エラー:`, err);
      const errorMessage = err instanceof Error ? err.message : "不明なエラーが発生しました。";
      setError(`${batchFile.file.name} の訪問者数カウントに失敗しました: ${errorMessage}.`);
      toast({
        variant: "destructive",
        title: `エラー: ${batchFile.file.name}`,
        description: `訪問者数のカウントに失敗しました。 ${errorMessage}`,
      });
      return false; 
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setError("アップロードする動画ファイルを選択してください。");
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
      
      const success = await processSingleFileViaAPI(batchFile, recordingDateToUse, recordingTimeToUse, formLocationName);
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
    setFormLocationName(""); // Clear location name after batch submit
    toast({
        title: "バッチ処理完了",
        description: `${successCount} ファイル成功, ${errorCount} ファイル失敗。結果は保存されました。`,
        variant: successCount > 0 && errorCount === 0 ? "default" : (errorCount > 0 ? "destructive" : "default")
    });
  };
  
  const getDirectionLabel = (direction: Direction | string | undefined) => {
    if (!direction) return "N/A";
    switch (direction) {
      case "entering": return "R→L";
      case "exiting": return "L→R";
      default: return direction;
    }
  };
  
  const apiDataForCSV = useMemo(() => {
    // Sort by processing timestamp DESC to show newest uploads first
    return allHistory
      .filter(entry => entry.uploadSource === 'api')
      .sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [allHistory]);


  const handleDownloadAPIDataCSV = () => {
    const dataToExport = apiDataForCSV;

    if (dataToExport.length === 0) {
      toast({ variant: "default", title: "APIデータなし", description: "エクスポート対象のAPIアップロードデータがありません。" });
      return;
    }
    
    const csvHeader = ["録画日", "録画開始時刻", "カメラ名称", "方向", "訪問者数"];
    const csvRows = ["\uFEFF" + csvHeader.join(",")]; // Add BOM for Excel compatibility

    for (const entry of dataToExport) {
      const recDate = entry.recordingStartDateTime ? format(entry.recordingStartDateTime, "yyyy-MM-dd") : 'N/A';
      const recTime = entry.recordingStartDateTime ? format(entry.recordingStartDateTime, "HH:mm:ss") : 'N/A';
      const location = entry.locationName || 'N/A';
      const directionLabel = entry.countedDirection === 'entering' ? '右→左' : entry.countedDirection === 'exiting' ? '左→右' : 'N/A';
      const escapeCSV = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
      
      csvRows.push([
        escapeCSV(recDate),
        escapeCSV(recTime),
        escapeCSV(location),
        escapeCSV(directionLabel),
        escapeCSV(entry.visitorCount)
      ].join(","));
    }

    const csvString = csvRows.join("\n"); 
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const reportDateStr = format(new Date(), "yyyyMMdd");
    link.setAttribute("download", `CountCam_API_レポート_${reportDateStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "APIデータCSVダウンロード完了", description: "APIアップロードのレポートがダウンロードされました。" });
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
                動画アップロード (Web UI経由)
              </CardTitle>
              <CardDescription>
                動画ファイルと関連情報を入力してください。結果は中央で保存され、UIでの精度検証に使用されます。
                録画日時はファイル名から解析されるか、フォールバック値が使用されます。地点名は任意です。
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleBatchSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="videoFile">動画ファイル (複数選択可)</Label>
                  <Input id="videoFile" type="file" accept="video/*" multiple onChange={handleFileChange} disabled={processing || isBatchProcessing} ref={fileInputRef} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                  {selectedFiles.length > 0 && !error && ( <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 border rounded-md bg-secondary/50"> <Files className="w-5 h-5 text-primary" /> <span>選択中: {selectedFiles.length} ファイル</span> </div> )}
                  {selectedFiles.map((batchFile, index) => ( <div key={index} className="text-xs text-muted-foreground ml-2"> - {batchFile.file.name} {batchFile.parsedDate && batchFile.parsedTime && ` (解析日時: ${batchFile.parsedDate} ${batchFile.parsedTime})`} </div> ))}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="locationName">地点名 (例: メインエントランス)</Label>
                  <Input id="locationName" type="text" value={formLocationName} onChange={(e) => setFormLocationName(e.target.value)} placeholder="例: 北口ゲート" disabled={processing || isBatchProcessing} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"> <Label htmlFor="recordingDate">フォールバック録画開始日</Label> <Input id="recordingDate" type="date" value={formRecordingDate} onChange={(e) => setFormRecordingDate(e.target.value)} disabled={processing || isBatchProcessing} required /> </div>
                  <div className="space-y-2"> <Label htmlFor="recordingTime">フォールバック録画開始時刻</Label> <Input id="recordingTime" type="time" value={formRecordingTime} onChange={(e) => setFormRecordingTime(e.target.value)} step="1" disabled={processing || isBatchProcessing} required /> </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-medium">カウント方向 (バッチ内の全ファイルに適用)</Label>
                  <RadioGroup value={selectedDirection} onValueChange={(value) => setSelectedDirection(value as Direction)} className="grid grid-cols-1 sm:grid-cols-2 gap-4" disabled={processing || isBatchProcessing}>
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent/5 has-[input:checked]:bg-primary/10 has-[input:checked]:border-primary transition-all"> <RadioGroupItem value="entering" id="dir-entering" /> <Label htmlFor="dir-entering" className="flex items-center gap-2 cursor-pointer text-sm sm:text-base"> <ArrowRightLeft className="w-5 h-5 text-green-500" /> R→L </Label> </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-accent/5 has-[input:checked]:bg-primary/10 has-[input:checked]:border-primary transition-all"> <RadioGroupItem value="exiting" id="dir-exiting" /> <Label htmlFor="dir-exiting" className="flex items-center gap-2 cursor-pointer text-sm sm:text-base"> <ArrowRightLeft className="w-5 h-5 text-red-500" /> L→R </Label> </div>
                  </RadioGroup>
                </div>
                {isBatchProcessing && ( <div className="space-y-2"> <Label>バッチ処理進捗 ({currentBatchFileIndex + 1} / {selectedFiles.length} ファイル): {selectedFiles[currentBatchFileIndex]?.file.name}</Label> <Progress value={batchProgress} className="w-full" /> </div> )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={processing || isBatchProcessing || selectedFiles.length === 0} className="w-full">
                  {isBatchProcessing ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> バッチ処理中... </> ) : processing ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ファイル処理中... </> ) : ( <> <Users className="mr-2 h-4 w-4" /> {selectedFiles.length > 1 ? `${selectedFiles.length} ファイルを処理` : (selectedFiles.length === 1 ? "選択したファイルを処理" : "訪問者をカウント (ファイル選択)") } </> )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {error && ( <Alert variant="destructive" className="shadow-md"> <AlertCircle className="h-4 w-4" /> <AlertTitle>エラー</AlertTitle> <AlertDescription>{error}</AlertDescription> </Alert> )}

          {lastProcessedResult && !processing && !isBatchProcessing && (
            <Card className="shadow-lg bg-gradient-to-br from-card to-secondary/30">
              <CardHeader> <CardTitle className="text-2xl flex items-center text-accent-foreground gap-2"> <CheckCircle2 className="text-accent" /> 最新の処理結果 (UIアップロード) </CardTitle> <CardDescription className="text-accent-foreground/80"> 解析完了: <strong>{lastProcessedResult.videoFileName}</strong> </CardDescription> </CardHeader>
              <CardContent className="space-y-4 text-lg">
                 <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <Users className="h-6 w-6 text-accent" /> <span className="font-medium text-foreground">合計訪問者数:</span> </div> <span className="font-bold text-3xl text-accent">{lastProcessedResult.visitorCount}</span> </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <ArrowRightLeft className="h-6 w-6 text-primary" /> <span className="font-medium text-foreground">カウント方向:</span> </div> <span className="font-semibold text-primary">{getDirectionLabel(lastProcessedResult.countedDirection)}</span> </div>
                {lastProcessedResult.locationName && lastProcessedResult.locationName !== 'N/A' && (
                  <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <MapPin className="h-6 w-6 text-primary" /> <span className="font-medium text-foreground">地点名:</span> </div> <span className="font-semibold text-primary">{lastProcessedResult.locationName}</span> </div>
                )}
                 <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <Video className="h-6 w-6 text-primary" /> <span className="font-medium text-foreground">録画開始日時:</span> </div> <span className="font-semibold text-primary">{lastProcessedResult.recordingStartDateTime && isValidDateFn(lastProcessedResult.recordingStartDateTime) ? format(lastProcessedResult.recordingStartDateTime, "PP p") : 'N/A'}</span> </div>
                <div className="flex items-center justify-between p-3 bg-background/70 rounded-md shadow-sm"> <div className="flex items-center gap-3"> <CalendarDays className="h-6 w-6 text-primary" /> <span className="font-medium text-foreground">処理日時:</span> </div> <span className="font-semibold text-primary">{format(lastProcessedResult.timestamp, "PP p")}</span> </div>
              </CardContent>
            </Card>
          )}

          <div className="py-4 text-center">
             <Button 
                variant="outline" 
                size="lg" 
                onClick={handleDownloadAPIDataCSV} 
                disabled={isBatchProcessing || apiDataForCSV.length === 0} 
                aria-label="APIアップロード 訪問者レポートCSVをダウンロード">
               <Download className="mr-2 h-5 w-5" />
               APIアップロードレポート (CSV)
             </Button>
           </div>
        </div>
      </main>
    </div>
  );
}
