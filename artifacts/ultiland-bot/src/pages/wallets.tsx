import { useState, useCallback } from "react";
import { format } from "date-fns";
import {
  Download, Copy, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight,
  Trash2, Eye, X, Shield, Key, BookOpen, Info, AlertTriangle
} from "lucide-react";
import {
  useGetWallets, getGetWalletsQueryKey,
  useExportWallets,
  useDeleteWallet,
  useBulkDeleteWallets,
  useSearchWallets, getSearchWalletsQueryKey,
  useGetWallet, getGetWalletQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

function MaskedText({ text, label }: { text: string; label: string }) {
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard`, duration: 2000 });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase font-mono">{label}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-mono text-muted-foreground hover:text-foreground" onClick={() => setVisible(v => !v)}>
            <Eye className="h-3 w-3 mr-1" />{visible ? "HIDE" : "SHOW"}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-mono text-muted-foreground hover:text-foreground" onClick={handleCopy}>
            <Copy className="h-3 w-3 mr-1" />COPY
          </Button>
        </div>
      </div>
      <div
        className="font-mono text-xs bg-background border border-border rounded px-3 py-2 break-all cursor-pointer"
        onClick={() => setVisible(v => !v)}
      >
        {visible ? text : "•".repeat(Math.min(text.length, 48))}
      </div>
    </div>
  );
}

export default function Wallets() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const limit = 20;
  const offset = (page - 1) * limit;

  // Search debounce
  const handleSearch = (val: string) => {
    setSearchQuery(val);
    setPage(1);
    setSelected(new Set());
    clearTimeout((window as unknown as Record<string, number>).__searchTimer);
    (window as unknown as Record<string, number>).__searchTimer = window.setTimeout(() => {
      setDebouncedSearch(val);
    }, 400);
  };

  const isSearching = debouncedSearch.trim().length > 0;

  const { data: listData, isLoading: listLoading } = useGetWallets({ limit, offset }, {
    query: { queryKey: getGetWalletsQueryKey({ limit, offset }), enabled: !isSearching }
  });

  const { data: searchData, isLoading: searchLoading } = useSearchWallets(
    { q: debouncedSearch, limit, offset },
    { query: { queryKey: getSearchWalletsQueryKey({ q: debouncedSearch, limit, offset }), enabled: isSearching } }
  );

  const data = isSearching ? searchData : listData;
  const isLoading = isSearching ? searchLoading : listLoading;

  const { data: detailData } = useGetWallet(detailId!, {
    query: { queryKey: getGetWalletQueryKey(detailId!), enabled: detailId !== null }
  });

  const exportQuery = useExportWallets({ query: { enabled: false } });
  const deleteMutation = useDeleteWallet();
  const bulkDeleteMutation = useBulkDeleteWallets();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["wallets"] });
    queryClient.invalidateQueries({ queryKey: getGetWalletsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getSearchWalletsQueryKey() });
  }, [queryClient]);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({ title: "Copied", description: "Address copied to clipboard", duration: 2000 });
  };

  const handleExport = async () => {
    try {
      const response = await exportQuery.refetch();
      if (response.data) {
        const blob = new Blob([response.data], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wallets-${format(new Date(), "yyyy-MM-dd")}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: "Export complete", description: "Wallets exported to wallets.txt" });
      }
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    deleteMutation.mutate({ id: deleteId }, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Wallet removed from registry" });
        setDeleteId(null);
        if (detailId === deleteId) setDetailId(null);
        setSelected(s => { const n = new Set(s); n.delete(deleteId); return n; });
        invalidate();
      },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
  };

  const handleBulkDelete = async () => {
    bulkDeleteMutation.mutate({ data: { ids: Array.from(selected) } }, {
      onSuccess: (result) => {
        toast({ title: "Deleted", description: `${result.deleted} wallet(s) removed` });
        setSelected(new Set());
        setShowBulkDelete(false);
        invalidate();
      },
      onError: () => toast({ title: "Bulk delete failed", variant: "destructive" }),
    });
  };

  const toggleSelect = (id: number) => {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    const wallets = data?.wallets ?? [];
    const allIds = wallets.map(w => w.id);
    const allSelected = allIds.every(id => selected.has(id));
    if (allSelected) {
      setSelected(s => { const n = new Set(s); allIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(s => { const n = new Set(s); allIds.forEach(id => n.add(id)); return n; });
    }
  };

  const truncateAddress = (address: string) => address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "";
  const totalPages = data ? Math.ceil(data.total / limit) : 1;
  const currentWallets = data?.wallets ?? [];
  const allPageSelected = currentWallets.length > 0 && currentWallets.every(w => selected.has(w.id));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 bg-background space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">WALLET_REGISTRY</h1>
          <p className="text-muted-foreground text-sm">Manage and monitor all generated accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="font-mono text-xs h-8"
              onClick={() => setShowBulkDelete(true)}
            >
              <Trash2 className="w-3 h-3 mr-2" />DELETE {selected.size} SELECTED
            </Button>
          )}
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="font-mono text-xs border-border hover:bg-muted h-8"
          >
            <Download className="w-3 h-3 mr-2" />EXPORT (.TXT)
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-border shadow-none bg-card flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between gap-4">
          <div className="flex items-center flex-1 max-w-sm border border-border bg-background rounded-md px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search address or referral..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 text-sm font-mono w-full placeholder:text-muted-foreground/50"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono shrink-0">
            {isSearching ? `RESULTS: ${data?.total ?? 0}` : `TOTAL: ${data?.total ?? 0}`}
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-auto">
          <Table>
            <TableHeader className="bg-background/50 sticky top-0 z-10 backdrop-blur-sm border-b border-border">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAll}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </TableHead>
                <TableHead className="w-14 font-mono text-xs">ID</TableHead>
                <TableHead className="font-mono text-xs">ADDRESS</TableHead>
                <TableHead className="font-mono text-xs text-center w-28">CHECKED IN</TableHead>
                <TableHead className="font-mono text-xs text-center w-32">TASK DONE</TableHead>
                <TableHead className="font-mono text-xs w-28">REFERRAL</TableHead>
                <TableHead className="text-right font-mono text-xs w-36">CREATED</TableHead>
                <TableHead className="w-24 font-mono text-xs text-center">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border/50">
                    <TableCell><div className="h-4 w-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-6 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-36 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted rounded mx-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted rounded mx-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted rounded ml-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted rounded mx-auto animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : currentWallets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground font-mono text-sm">
                    {isSearching ? "NO_MATCH_FOUND" : "NO_RECORDS_FOUND"}
                  </TableCell>
                </TableRow>
              ) : (
                currentWallets.map((wallet) => (
                  <TableRow
                    key={wallet.id}
                    className={`border-border/50 hover:bg-muted/30 transition-colors ${selected.has(wallet.id) ? "bg-primary/5" : ""}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(wallet.id)}
                        onCheckedChange={() => toggleSelect(wallet.id)}
                        className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{wallet.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm">{truncateAddress(wallet.address)}</span>
                        <button
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          onClick={() => handleCopyAddress(wallet.address)}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {wallet.checkedIn
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-muted-foreground/25 mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {wallet.taskSubmitted
                        ? <CheckCircle2 className="w-4 h-4 text-blue-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-muted-foreground/25 mx-auto" />}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase bg-background border-border">
                        {wallet.referralCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {format(new Date(wallet.createdAt), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1 text-muted-foreground/50 hover:text-primary transition-colors"
                          title="View Details"
                          onClick={() => setDetailId(wallet.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                          title="Delete"
                          onClick={() => setDeleteId(wallet.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
            {selected.size > 0 ? `${selected.size} SELECTED — ` : ""}PAGE {page} OF {Math.max(1, totalPages)}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 border-border bg-background font-mono text-xs">
              <ChevronLeft className="h-3 w-3 mr-1" />PREV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-7 border-border bg-background font-mono text-xs">
              NEXT<ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <SheetContent className="w-full sm:max-w-md bg-card border-border text-foreground overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-mono text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              WALLET_DETAIL
            </SheetTitle>
            <SheetDescription className="font-mono text-xs text-muted-foreground">
              #{detailId} — Sensitive data. Keep private.
            </SheetDescription>
          </SheetHeader>

          {detailData ? (
            <div className="space-y-5">
              {/* Status badges */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`font-mono text-[10px] ${detailData.checkedIn ? "border-green-500/50 text-green-500" : "border-muted-foreground/30 text-muted-foreground"}`}>
                  {detailData.checkedIn ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : <XCircle className="h-2.5 w-2.5 mr-1" />}
                  CHECK-IN
                </Badge>
                <Badge variant="outline" className={`font-mono text-[10px] ${detailData.taskSubmitted ? "border-blue-500/50 text-blue-500" : "border-muted-foreground/30 text-muted-foreground"}`}>
                  {detailData.taskSubmitted ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : <XCircle className="h-2.5 w-2.5 mr-1" />}
                  TASK
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px] border-border text-muted-foreground ml-auto">
                  REF: {detailData.referralCode}
                </Badge>
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-mono flex items-center gap-1">
                    <Shield className="h-3 w-3" />ADDRESS
                  </span>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center gap-1"
                    onClick={() => { navigator.clipboard.writeText(detailData.address); toast({ title: "Copied", duration: 2000 }); }}
                  >
                    <Copy className="h-3 w-3" />COPY
                  </button>
                </div>
                <div className="font-mono text-xs bg-background border border-border rounded px-3 py-2 break-all text-foreground">
                  {detailData.address}
                </div>
              </div>

              {/* Private Key */}
              <MaskedText text={detailData.privateKey} label="PRIVATE KEY" />

              {/* Mnemonic */}
              {detailData.mnemonic && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase font-mono flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />MNEMONIC PHRASE
                    </span>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center gap-1"
                      onClick={() => { navigator.clipboard.writeText(detailData.mnemonic); toast({ title: "Copied", duration: 2000 }); }}
                    >
                      <Copy className="h-3 w-3" />COPY
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-background border border-border rounded px-3 py-2">
                    {detailData.mnemonic.split(" ").map((word, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-muted-foreground/40 font-mono text-[10px] w-4 text-right">{i + 1}.</span>
                        <span className="font-mono text-xs text-foreground">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="border border-border rounded p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">CREATED</span>
                  <span>{format(new Date(detailData.createdAt), "yyyy-MM-dd HH:mm:ss")}</span>
                </div>
                {detailData.runId && (
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">RUN_ID</span>
                    <span className="text-xs truncate max-w-[60%] text-right">{detailData.runId}</span>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded p-3">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive/80 font-mono">Keep private key and mnemonic secure. Never share them.</p>
              </div>

              {/* Delete button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => { setDeleteId(detailId); setDetailId(null); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />DELETE THIS WALLET
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm">
              LOADING...
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm">CONFIRM_DELETE</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs text-muted-foreground">
              This will permanently delete wallet #{deleteId} from the registry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs border-border">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              className="font-mono text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
            >
              DELETE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirm Dialog */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm">CONFIRM_BULK_DELETE</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs text-muted-foreground">
              This will permanently delete {selected.size} wallet(s) from the registry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs border-border">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              className="font-mono text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleBulkDelete}
            >
              DELETE {selected.size} WALLETS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
