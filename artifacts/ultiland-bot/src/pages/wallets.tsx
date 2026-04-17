import { useState } from "react";
import { format } from "date-fns";
import { Download, Copy, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetWallets, getGetWalletsQueryKey, useExportWallets } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Wallets() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;
  
  const { data, isLoading } = useGetWallets({ limit, offset }, {
    query: { queryKey: getGetWalletsQueryKey({ limit, offset }) }
  });
  
  const exportMutation = useExportWallets({
    query: {
      enabled: false // We trigger this manually
    }
  });

  const { toast } = useToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
      duration: 2000,
    });
  };

  const handleExport = async () => {
    try {
      const response = await exportMutation.refetch();
      if (response.data) {
        const blob = new Blob([response.data], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallets-${format(new Date(), 'yyyy-MM-dd')}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export wallets",
        variant: "destructive"
      });
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 bg-background space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">WALLET_REGISTRY</h1>
          <p className="text-muted-foreground text-sm">Manage and monitor all generated keys.</p>
        </div>
        <Button 
          onClick={handleExport} 
          variant="outline" 
          className="font-mono text-xs border-border hover:bg-muted"
        >
          <Download className="w-4 h-4 mr-2" /> EXPORT (.TXT)
        </Button>
      </div>

      <Card className="border-border shadow-none bg-card flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center w-full max-w-sm border border-border bg-background rounded-md px-3 py-1">
            <Search className="w-4 h-4 text-muted-foreground mr-2" />
            <input 
              type="text" 
              placeholder="Search address..." 
              className="bg-transparent border-none outline-none focus:ring-0 text-sm font-mono w-full"
              disabled // Not implemented in API yet, mock UI
            />
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            TOTAL: {data?.total || 0}
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-auto">
          <Table>
            <TableHeader className="bg-background/50 sticky top-0 z-10 backdrop-blur-sm border-b border-border">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-16 font-mono text-xs">ID</TableHead>
                <TableHead className="font-mono text-xs">ADDRESS</TableHead>
                <TableHead className="font-mono text-xs text-center">CHECKED IN</TableHead>
                <TableHead className="font-mono text-xs text-center">TASK SUBMITTED</TableHead>
                <TableHead className="font-mono text-xs">REFERRAL</TableHead>
                <TableHead className="text-right font-mono text-xs">CREATED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: limit }).map((_, i) => (
                  <TableRow key={i} className="border-border/50">
                    <TableCell><div className="h-4 w-6 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted rounded mx-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted rounded mx-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted rounded ml-auto animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : data?.wallets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-mono text-sm">
                    NO_RECORDS_FOUND
                  </TableCell>
                </TableRow>
              ) : (
                data?.wallets.map((wallet) => (
                  <TableRow key={wallet.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground">{wallet.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="font-mono text-sm">{truncateAddress(wallet.address)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 ml-2 text-muted-foreground hover:text-foreground opacity-50 hover:opacity-100"
                          onClick={() => handleCopy(wallet.address)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {wallet.checkedIn ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {wallet.taskSubmitted ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-500 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase bg-background border-border">
                        {wallet.referralCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {format(new Date(wallet.createdAt), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        
        {/* Pagination */}
        <div className="py-3 px-4 border-t border-border flex items-center justify-between bg-background/50">
          <div className="text-xs text-muted-foreground font-mono">
            PAGE {page} OF {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 border-border bg-background"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> PREV
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="h-8 border-border bg-background"
            >
              NEXT <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
