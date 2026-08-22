"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Database,
  ExternalLink,
  Loader2,
  Play,
  Search,
  Table2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  adminTableHeadClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/ui/admin/tokens";
import "@/components/dashboard/dashboard-premium.css";

type TableInfo = { name: string; rows: number };
type TableGroup = { group: string; tables: TableInfo[] };
type ColumnInfo = { column_name: string; data_type: string; column_key: string };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };


export default function DatabaseManagerClient() {
  const [groups, setGroups] = useState<TableGroup[]>([]);
  const [totalTables, setTotalTables] = useState(0);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [querySql, setQuerySql] = useState("");
  const [queryResult, setQueryResult] = useState<{ rows: Record<string, unknown>[]; columns: string[]; rowCount: number; elapsed: number } | null>(null);
  const [queryError, setQueryError] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [view, setView] = useState<"browser" | "query">("browser");

  const [loadError, setLoadError] = useState("");

  const loadTables = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/master-admin/database?action=tables", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || `Failed to load tables (${res.status})`);
        setGroups([]);
        setTotalTables(0);
        return;
      }
      setGroups(data.tables || []);
      setTotalTables(data.totalTables || 0);
      if (data.tables?.length) setExpandedGroup(data.tables[0].group);
    } catch {
      setLoadError("Network error loading tables.");
      setGroups([]);
      setTotalTables(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadTables();
  }, [loadTables]);

  const loadTable = useCallback(async (tableName: string, page = 1, searchTerm = "") => {
    setTableLoading(true);
    setSelectedTable(tableName);
    setQueryResult(null);
    try {
      const params = new URLSearchParams({ action: "rows", table: tableName, page: String(page), pageSize: "25" });
      if (searchTerm) params.set("search", searchTerm);
      const [colRes, rowRes] = await Promise.all([
        fetch(`/api/master-admin/database?action=columns&table=${tableName}`, { cache: "no-store" }),
        fetch(`/api/master-admin/database?${params}`, { cache: "no-store" }),
      ]);
      const colData = await colRes.json();
      const rowData = await rowRes.json();
      setColumns(colData.columns || []);
      setRows(rowData.rows || []);
      setPagination(rowData.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 0 });
    } finally {
      setTableLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (selectedTable) void loadTable(selectedTable, 1, search);
  }, [selectedTable, search, loadTable]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (selectedTable) void loadTable(selectedTable, newPage, search);
    },
    [selectedTable, search, loadTable],
  );

  const runQuery = useCallback(async () => {
    if (!querySql.trim()) return;
    setQueryLoading(true);
    setQueryError("");
    setQueryResult(null);
    try {
      const res = await fetch("/api/master-admin/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: querySql }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQueryError(data.error || "Query failed");
      } else {
        setQueryResult(data);
      }
    } catch {
      setQueryError("Network error");
    } finally {
      setQueryLoading(false);
    }
  }, [querySql]);

  const displayRows = view === "query" && queryResult ? queryResult.rows : rows;
  const displayColumns = view === "query" && queryResult ? queryResult.columns : columns.map((c) => c.column_name);

  function getLinkHref(colName: string, val: unknown): string | null {
    if (val == null || val === "") return null;
    const str = String(val);
    if (colName === "customer_uid" && str.length > 0) return `/master-admin/customers/${str}`;
    return null;
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Database Manager"
        subtitle={`${totalTables} tables · Browse data and run read-only queries.`}
      />

      <div className="flex min-h-[420px] flex-col gap-3 lg:h-[calc(100vh-220px)] lg:min-h-[500px] lg:flex-row">
        <aside className="dash-premium-card max-h-[260px] w-full shrink-0 overflow-y-auto lg:max-h-none lg:w-60">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : loadError ? (
            <div className="space-y-3 p-4">
              <p className="flex items-start gap-2 text-[12px] font-medium text-red-600">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {loadError}
              </p>
              <button type="button" onClick={() => void loadTables()} className={adminSecondaryButtonClass}>
                Retry
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="p-4 text-[12px] font-medium text-slate-500">No tables found in this database.</div>
          ) : (
            <nav className="p-2">
              {groups.map((group) => (
                <div key={group.group} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(expandedGroup === group.group ? null : group.group)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 transition hover:bg-zinc-50 hover:text-slate-600"
                  >
                    {group.group}
                    <span className="text-[10px] font-semibold text-slate-300">{group.tables.length}</span>
                  </button>
                  {expandedGroup === group.group ? (
                    <div className="mt-0.5 space-y-0.5">
                      {group.tables.map((table) => (
                        <button
                          key={table.name}
                          type="button"
                          onClick={() => {
                            setView("browser");
                            void loadTable(table.name);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                            selectedTable === table.name
                              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary-hover)]"
                               : "text-slate-600 hover:bg-zinc-50 hover:text-slate-900"
                          }`}
                        >
                          <span className="truncate">{table.name}</span>
                          <span className="ml-2 shrink-0 text-[10px] text-slate-400">
                            {table.rows.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>
          )}
        </aside>

        <main className="dash-premium-card flex min-h-[360px] min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[#ECECEC] bg-white px-4 py-3 sm:gap-3 sm:px-5">
            <div className="flex shrink-0 gap-1 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-1">
              <button
                type="button"
                onClick={() => setView("browser")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                  view === "browser" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Table2 size={13} className="mr-1 inline" />
                Browser
              </button>
              <button
                type="button"
                onClick={() => setView("query")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                  view === "query" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Play size={13} className="mr-1 inline" />
                Query
              </button>
            </div>

            {view === "browser" && selectedTable ? (
              <>
                <span className="min-w-0 truncate text-[13px] font-black text-slate-900">{selectedTable}</span>
                <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                  {pagination.total.toLocaleString()} rows
                </span>
                <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1 sm:flex-none">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Search rows..."
                      className={`${adminInputClass} w-full pl-8 sm:w-56`}
                    />
                  </div>
                  <button type="button" onClick={handleSearch} className={adminSecondaryButtonClass + " !px-3 !py-2 !text-[12px]"}>
                    Search
                  </button>
                </div>
              </>
            ) : view === "browser" ? (
              <span className="min-w-0 flex-1 basis-[12rem] text-[13px] font-medium leading-snug text-slate-400">
                Select a table from the list to browse data
              </span>
            ) : null}
          </div>

          {view === "query" ? (
            <div className="border-b border-[#ECECEC] p-5">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                SQL Query <span className="normal-case">(Read-only · Ctrl+Enter to run)</span>
              </label>
              <div className="flex gap-2">
                <textarea
                  value={querySql}
                  onChange={(e) => setQuerySql(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void runQuery();
                  }}
                  placeholder="SELECT * FROM customers LIMIT 10"
                  rows={3}
                  className="flex-1 rounded-[14px] border border-[#ECECEC] bg-white px-4 py-2.5 font-mono text-[13px] text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
                />
                <button
                  type="button"
                  onClick={() => void runQuery()}
                  disabled={queryLoading || !querySql.trim()}
                  className={adminPrimaryButtonClass + " !px-5"}
                >
                  {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Run
                </button>
              </div>
              {queryError ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-600">
                  <AlertCircle size={14} />
                  {queryError}
                </div>
              ) : null}
              {queryResult ? (
                <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                  <CheckCircle2 size={14} className="text-[var(--color-primary-hover)]" />
                  {queryResult.rowCount} rows returned in {queryResult.elapsed}ms
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto">
            {tableLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : displayRows.length > 0 ? (
              <div className="ma-table-scroll">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className={adminTableHeadClass}>
                    {displayColumns.map((col) => (
                      <th key={col} scope="col" className="whitespace-nowrap px-3 py-2.5">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, i) => (
                    <tr key={i} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                      {displayColumns.map((col) => {
                        const val = row[col];
                        const display = val == null ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
                        const truncated = display.length > 80 ? display.slice(0, 80) + "…" : display;
                        const linkHref = getLinkHref(col, val);

                        return (
                          <td key={col} className="max-w-[200px] truncate px-3 py-2 text-slate-700" title={display}>
                            {linkHref ? (
                              <Link
                                href={linkHref}
                                className="inline-flex items-center gap-1 font-semibold text-slate-900 transition hover:underline"
                              >
                                {truncated}
                                <ExternalLink size={10} className="shrink-0 opacity-50" />
                              </Link>
                            ) : truncated ? (
                              truncated
                            ) : (
                              <span className="text-slate-300">NULL</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : selectedTable ? (
              <div className="flex min-h-[160px] items-center justify-center p-12 text-[13px] font-medium text-slate-400">
                No rows found
              </div>
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center p-10 text-center sm:p-16">
                <Database size={40} className="text-slate-200" />
                <p className="mt-4 max-w-sm text-[13px] font-semibold leading-relaxed text-slate-400">
                  Select a table from the list to browse data
                </p>
              </div>
            )}
          </div>

          {view === "browser" && selectedTable && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-[#ECECEC] bg-[#FAFAFB] px-4 py-2.5 text-[12px] text-[#6B7280]">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} rows)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                  const start = Math.max(1, Math.min(pagination.page - 3, pagination.totalPages - 6));
                  const pageNum = start + i;
                  if (pageNum > pagination.totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`grid h-7 min-w-7 place-items-center rounded-lg px-1.5 text-[12px] font-bold ${
                        pagination.page === pageNum
                          ? "bg-[var(--color-primary)] text-slate-900"
                          : "text-slate-500 hover:bg-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-white disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
