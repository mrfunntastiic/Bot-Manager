import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Play, Square, Activity, Upload, CheckCircle2, XCircle, Clock, AlertTriangle, FileText, Wallet, Terminal, Trash2 } from "lucide-react";
import { 
  useRunBot, 
  useStopBot, 
  useGetBotStatus, 
  getGetBotStatusQueryKey,
  useGetBotLogs,
  getGetBotLogsQueryKey,
  useGetWalletStats,
  useUploadProxies,
  useClearBotLogs,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const runBotSchema = z.object({
  referralCode: z.string().min(1, "Referral code is required"),
  accountCount: z.coerce.number().min(1, "Must run at least 1 account"),
  useProxy: z.boolean().default(false),
  proxies: z.string().optional()
});

type RunBotFormValues = z.infer<typeof runBotSchema>;

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Queries
  const { data: status } = useGetBotStatus({ 
    query: { 
      queryKey: getGetBotStatusQueryKey(), 
      refetchInterval: 2000 
    } 
  });
  
  const { data: logsData } = useGetBotLogs(
    { limit: 100 },
    { 
      query: { 
        queryKey: getGetBotLogsQueryKey({ limit: 100 }), 
        refetchInterval: status?.running ? 2000 : false 
      } 
    }
  );
  
  const { data: stats } = useGetWalletStats();
  
  // Mutations
  const runBotMutation = useRunBot();
  const stopBotMutation = useStopBot();
  const uploadProxiesMutation = useUploadProxies();
  const clearLogsMutation = useClearBotLogs();

  const handleClearLogs = () => {
    clearLogsMutation.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetBotLogsQueryKey() });
        toast({ title: "Logs cleared", description: result.message, duration: 2000 });
      },
      onError: () => toast({ title: "Failed to clear logs", variant: "destructive" }),
    });
  };
  
  // Local state
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const form = useForm<RunBotFormValues>({
    resolver: zodResolver(runBotSchema),
    defaultValues: {
      referralCode: "DEFAULT",
      accountCount: 10,
      useProxy: false,
      proxies: ""
    }
  });

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData?.logs]);

  const onSubmit = async (data: RunBotFormValues) => {
    try {
      if (data.useProxy && data.proxies) {
        const proxyList = data.proxies.split('\n').map(p => p.trim()).filter(Boolean);
        if (proxyList.length > 0) {
          await uploadProxiesMutation.mutateAsync({ data: { proxies: proxyList } });
          toast({ title: "Proxies uploaded", description: `Uploaded ${proxyList.length} proxies.` });
        }
      }
      
      await runBotMutation.mutateAsync({ 
        data: { 
          referralCode: data.referralCode,
          accountCount: data.accountCount,
          useProxy: data.useProxy
        } 
      });
      
      toast({ title: "Bot started", description: "The automation sequence has been initiated." });
    } catch (error: any) {
      toast({ 
        title: "Failed to start", 
        description: error?.message || "An error occurred", 
        variant: "destructive" 
      });
    }
  };

  const handleStop = async () => {
    try {
      await stopBotMutation.mutateAsync();
      toast({ title: "Bot stopped", description: "Graceful shutdown initiated." });
    } catch (error) {
      toast({ title: "Error stopping bot", variant: "destructive" });
    }
  };

  const isRunning = status?.running || false;
  const progressPercent = status && status.totalAccounts > 0 
    ? (status.currentAccount / status.totalAccounts) * 100 
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">DASHBOARD</h1>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase">Total Wallets</p>
              <h3 className="text-2xl font-bold font-mono mt-1">{stats?.total || 0}</h3>
            </div>
            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase">Checked In</p>
              <h3 className="text-2xl font-bold font-mono mt-1 text-green-500">{stats?.checkedIn || 0}</h3>
            </div>
            <div className="h-10 w-10 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase">Tasks Submitted</p>
              <h3 className="text-2xl font-bold font-mono mt-1 text-blue-500">{stats?.taskSubmitted || 0}</h3>
            </div>
            <div className="h-10 w-10 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase">Total Runs</p>
              <h3 className="text-2xl font-bold font-mono mt-1">{stats?.totalRuns || 0}</h3>
            </div>
            <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control Panel */}
        <Card className="col-span-1 lg:col-span-1 border-border shadow-none bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-mono flex items-center">
              <Terminal className="w-4 h-4 mr-2" /> 
              EXECUTION_PARAMS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-xs uppercase font-mono text-muted-foreground">Referral Code</Label>
                <Input 
                  id="referralCode" 
                  {...form.register("referralCode")} 
                  className="font-mono bg-background"
                  disabled={isRunning}
                />
                {form.formState.errors.referralCode && (
                  <p className="text-xs text-destructive">{form.formState.errors.referralCode.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountCount" className="text-xs uppercase font-mono text-muted-foreground">Account Count</Label>
                <Input 
                  id="accountCount" 
                  type="number" 
                  {...form.register("accountCount")} 
                  className="font-mono bg-background"
                  disabled={isRunning}
                />
                {form.formState.errors.accountCount && (
                  <p className="text-xs text-destructive">{form.formState.errors.accountCount.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-y border-border">
                <Label htmlFor="useProxy" className="text-xs uppercase font-mono text-muted-foreground cursor-pointer">Use Proxies</Label>
                <Switch 
                  id="useProxy" 
                  checked={form.watch("useProxy")} 
                  onCheckedChange={(val) => form.setValue("useProxy", val)} 
                  disabled={isRunning}
                />
              </div>

              {form.watch("useProxy") && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label htmlFor="proxies" className="text-xs uppercase font-mono text-muted-foreground">Proxies (ip:port:user:pass)</Label>
                  <Textarea 
                    id="proxies" 
                    {...form.register("proxies")} 
                    placeholder="127.0.0.1:8080:user:pass..." 
                    className="font-mono text-xs min-h-[100px] bg-background resize-none"
                    disabled={isRunning}
                  />
                </div>
              )}

              <div className="pt-4">
                {!isRunning ? (
                  <Button 
                    type="submit" 
                    className="w-full font-mono font-bold" 
                    disabled={runBotMutation.isPending}
                  >
                    {runBotMutation.isPending ? <Activity className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    INITIATE_RUN
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    className="w-full font-mono font-bold" 
                    onClick={handleStop}
                    disabled={stopBotMutation.isPending}
                  >
                    {stopBotMutation.isPending ? <Activity className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
                    HALT_EXECUTION
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Live Status & Logs */}
        <div className="col-span-1 lg:col-span-2 space-y-6 flex flex-col">
          {/* Status Panel */}
          <Card className="border-border shadow-none bg-card">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-mono flex items-center">
                  <Activity className="w-4 h-4 mr-2" /> 
                  TELEMETRY
                </CardTitle>
                <div className={`px-2 py-1 rounded text-xs font-mono font-bold border ${isRunning ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' : 'bg-muted text-muted-foreground border-border'}`}>
                  {isRunning ? 'ACTIVE' : 'IDLE'}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2 text-sm font-mono">
                    <span className="text-muted-foreground">PROGRESS</span>
                    <span className="font-bold">{status?.currentAccount || 0} / {status?.totalAccounts || 0}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background border border-border rounded-md p-3 flex flex-col">
                    <span className="text-xs text-muted-foreground font-mono mb-1 flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> SUCCESS
                    </span>
                    <span className="text-xl font-bold font-mono text-green-500">{status?.successCount || 0}</span>
                  </div>
                  <div className="bg-background border border-border rounded-md p-3 flex flex-col">
                    <span className="text-xs text-muted-foreground font-mono mb-1 flex items-center">
                      <XCircle className="h-3 w-3 mr-1 text-destructive" /> FAILED
                    </span>
                    <span className="text-xl font-bold font-mono text-destructive">{status?.failCount || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Logs */}
          <Card className="flex-1 flex flex-col border-border shadow-none bg-card min-h-[300px]">
            <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                SYSTEM_LOGS
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 font-mono text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleClearLogs}
                disabled={clearLogsMutation.isPending || !logsData?.logs?.length}
                title="Clear all logs"
              >
                <Trash2 className="w-3 h-3 mr-1.5" />
                CLEAR
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden relative">
              <div className="absolute inset-0 overflow-y-auto p-4 font-mono text-xs space-y-1 scroll-smooth">
                {logsData?.logs && logsData.logs.length > 0 ? (
                  logsData.logs.map((log) => {
                    let colorClass = "text-muted-foreground";
                    if (log.level === "success") colorClass = "text-green-400";
                    if (log.level === "error") colorClass = "text-destructive";
                    if (log.level === "warning") colorClass = "text-yellow-400";
                    if (log.level === "info") colorClass = "text-blue-400";
                    
                    return (
                      <div key={log.id} className="flex items-start break-all hover:bg-white/5 px-1 rounded transition-colors">
                        <span className="text-muted-foreground opacity-50 mr-3 shrink-0 whitespace-nowrap">
                          [{new Date(log.timestamp).toISOString().split('T')[1].replace('Z', '')}]
                        </span>
                        <span className={`${colorClass} mr-2 shrink-0 w-16`}>
                          {log.level.toUpperCase().padEnd(7)}
                        </span>
                        <span className="text-foreground/90">{log.message}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground opacity-50 italic">
                    Awaiting log output...
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
