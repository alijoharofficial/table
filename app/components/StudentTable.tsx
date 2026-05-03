"use client";

import React, {
  useState, useCallback, useRef, useEffect, useMemo,
} from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search, Download, ChevronDown, ChevronUp, GripVertical, Pencil,
  Trash2, Save, X, Filter, ChevronFirst, ChevronLast, ChevronLeft,
  ChevronRight, Copy, Check, SlidersHorizontal, Users, UserCheck,
  Clock, UserX, ShieldAlert, FileJson, FileText, ArrowUp, ArrowDown,
  ChevronRight as ChevronRightIcon, Phone, Mail, Globe, Calendar,
  BookOpen, DollarSign, MapPin, Layers, RefreshCw, MoreHorizontal,
  CheckSquare, Square,
} from "lucide-react";
import { students as initialStudents, Student, StudentStatus } from "../data/students";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ColumnDef {
  id: keyof Student | "actions";
  label: string;
  visible: boolean;
  sortable?: boolean;
  minWidth?: number;
}

interface SortState { key: string; dir: "asc" | "desc" }
interface Toast { id: string; type: "success" | "error" | "info" | "warning"; message: string }
interface InlineEdit { rowId: string; colId: keyof Student; value: string }

// ─── Constants ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<StudentStatus, { pill: string; dot: string; tab: string; activeTab: string }> = {
  Active:    { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",   dot: "bg-emerald-500", tab: "text-emerald-700 hover:bg-emerald-50",   activeTab: "bg-emerald-500 text-white shadow-emerald-200" },
  Pending:   { pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",         dot: "bg-amber-500",   tab: "text-amber-700 hover:bg-amber-50",         activeTab: "bg-amber-500 text-white shadow-amber-200"   },
  Inactive:  { pill: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",        dot: "bg-slate-400",   tab: "text-slate-600 hover:bg-slate-100",         activeTab: "bg-slate-500 text-white shadow-slate-200"   },
  Suspended: { pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",            dot: "bg-rose-500",    tab: "text-rose-700 hover:bg-rose-50",            activeTab: "bg-rose-500 text-white shadow-rose-200"    },
};

const GENDER_STYLE: Record<string, string> = {
  male:   "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  female: "bg-pink-50 text-pink-700 ring-1 ring-pink-200",
};

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "userId",          label: "User ID",          visible: false, sortable: true,  minWidth: 90  },
  { id: "name",            label: "Name",             visible: true,  sortable: true,  minWidth: 140 },
  { id: "email",           label: "Email",            visible: false, sortable: true,  minWidth: 190 },
  { id: "gender",          label: "Gender",           visible: true,  sortable: true,  minWidth: 90  },
  { id: "dateOfBirth",     label: "Date of Birth",    visible: false, sortable: true,  minWidth: 115 },
  { id: "phone",           label: "Phone",            visible: true,  sortable: false, minWidth: 145 },
  { id: "timezone",        label: "Timezone",         visible: true,  sortable: true,  minWidth: 155 },
  { id: "educationEmail",  label: "Education Email",  visible: true,  sortable: true,  minWidth: 195 },
  { id: "password",        label: "Password",         visible: true,  sortable: false, minWidth: 155 },
  { id: "preferredTime",   label: "Preferred Time",   visible: true,  sortable: true,  minWidth: 125 },
  { id: "classDays",       label: "Class Days",       visible: true,  sortable: true,  minWidth: 110 },
  { id: "price",           label: "Price",            visible: false, sortable: true,  minWidth: 80  },
  { id: "status",          label: "Status",           visible: true,  sortable: true,  minWidth: 110 },
  { id: "course",          label: "Course",           visible: true,  sortable: true,  minWidth: 150 },
  { id: "parentInquiry",   label: "Parent Inquiry",   visible: false, sortable: true,  minWidth: 120 },
  { id: "teacherAssigned", label: "Teacher Assigned", visible: false, sortable: true,  minWidth: 145 },
  { id: "roomId",          label: "Room ID",          visible: false, sortable: true,  minWidth: 85  },
  { id: "actions",         label: "Actions",          visible: true,  sortable: false, minWidth: 120 },
];

const EDITABLE_COLS = new Set<keyof Student>([
  "name", "email", "phone", "timezone", "educationEmail",
  "preferredTime", "classDays", "price", "course",
  "parentInquiry", "teacherAssigned", "roomId",
]);

// ─── Utilities ─────────────────────────────────────────────────────────────

function generateId() { return Math.random().toString(36).slice(2, 9); }

function exportData(data: Student[], columns: ColumnDef[], format: "csv" | "json") {
  const visible = columns.filter((c) => c.visible && c.id !== "actions") as { id: keyof Student; label: string }[];
  if (format === "json") {
    const rows = data.map((s) => Object.fromEntries(visible.map((c) => [c.id, s[c.id]])));
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    trigger(blob, "students.json");
  } else {
    const header = visible.map((c) => c.label).join(",");
    const rows = data.map((s) =>
      visible.map((c) => { const v = String(s[c.id] ?? ""); return v.includes(",") ? `"${v}"` : v; }).join(",")
    );
    trigger(new Blob([[header, ...rows].join("\n")], { type: "text/csv" }), "students.csv");
  }
}

function trigger(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Toast System ──────────────────────────────────────────────────────────

const TOAST_STYLES = {
  success: "bg-emerald-600",
  error:   "bg-rose-600",
  info:    "bg-indigo-600",
  warning: "bg-amber-500",
};

function ToastList({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl text-white text-sm font-medium shadow-xl shadow-black/20 pointer-events-auto animate-in slide-in-from-right-4 duration-300 ${TOAST_STYLES[t.type]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => remove(t.id)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, onClick, active }: {
  label: string; value: number; icon: React.ElementType;
  color: string; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 w-full ${
        active
          ? `${color} border-transparent shadow-lg scale-[1.02]`
          : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-md"
      }`}
    >
      <div className={`p-2.5 rounded-xl ${active ? "bg-white/20" : color} transition-colors`}>
        <Icon size={18} className={active ? "text-white" : "text-white"} />
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none ${active ? "text-white" : "text-slate-800"}`}>{value}</p>
        <p className={`text-xs font-medium mt-1 ${active ? "text-white/80" : "text-slate-500"}`}>{label}</p>
      </div>
    </button>
  );
}

// ─── Copy Button ───────────────────────────────────────────────────────────

function CopyBtn({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 1800);
      }}
      className="ml-1 flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
    </button>
  );
}

// ─── Inline Edit Cell ──────────────────────────────────────────────────────

function InlineInput({ value, onSave, onCancel, type = "text" }: {
  value: string; onSave: (v: string) => void; onCancel: () => void; type?: string;
}) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      type={type}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onCancel(); }}
      onBlur={() => onSave(val)}
      className="w-full px-2 py-1 text-sm border-2 border-indigo-400 rounded-lg bg-white focus:outline-none focus:border-indigo-500 shadow-lg shadow-indigo-100"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ─── Expanded Row Detail ────────────────────────────────────────────────────

function ExpandedDetail({ student }: { student: Student }) {
  const fields: { icon: React.ElementType; label: string; value: string; span?: boolean }[] = [
    { icon: Users,       label: "User ID",          value: student.userId          },
    { icon: Mail,        label: "Personal Email",    value: student.email           },
    { icon: Calendar,    label: "Date of Birth",     value: student.dateOfBirth     },
    { icon: Phone,       label: "Phone",             value: student.phone           },
    { icon: Globe,       label: "Timezone",          value: student.timezone        },
    { icon: Mail,        label: "Education Email",   value: student.educationEmail  },
    { icon: Clock,       label: "Preferred Time",    value: student.preferredTime   },
    { icon: Calendar,    label: "Class Days",        value: student.classDays       },
    { icon: DollarSign,  label: "Price",             value: `$${student.price}`     },
    { icon: BookOpen,    label: "Course",            value: student.course          },
    { icon: Users,       label: "Parent Inquiry",    value: student.parentInquiry   },
    { icon: UserCheck,   label: "Teacher Assigned",  value: student.teacherAssigned },
    { icon: MapPin,      label: "Room ID",           value: student.roomId          },
    { icon: Layers,      label: "Status",            value: student.status          },
  ];

  return (
    <tr>
      <td colSpan={100} className="p-0 border-b-2 border-indigo-100">
        <div className="bg-gradient-to-br from-indigo-50 to-slate-50 px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{student.name}</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[student.status].pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[student.status].dot}`} />
                {student.status}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {fields.map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={12} className="text-indigo-400 flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-xs font-medium text-slate-700 truncate" title={value}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Edit Modal ─────────────────────────────────────────────────────────────

function EditModal({ student, onSave, onClose }: {
  student: Student; onSave: (s: Student) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Student>({ ...student });
  const fields: { key: keyof Student; label: string; type?: string; options?: string[] }[] = [
    { key: "name",            label: "Full Name"         },
    { key: "email",           label: "Personal Email",   type: "email"  },
    { key: "gender",          label: "Gender",           options: ["male", "female"] },
    { key: "dateOfBirth",     label: "Date of Birth",    type: "date"   },
    { key: "phone",           label: "Phone"             },
    { key: "timezone",        label: "Timezone"          },
    { key: "educationEmail",  label: "Education Email",  type: "email"  },
    { key: "password",        label: "Password"          },
    { key: "preferredTime",   label: "Preferred Time"    },
    { key: "classDays",       label: "Class Days"        },
    { key: "price",           label: "Price (USD)",      type: "number" },
    { key: "status",          label: "Status",           options: ["Active", "Inactive", "Pending", "Suspended"] },
    { key: "course",          label: "Course"            },
    { key: "parentInquiry",   label: "Parent Inquiry"    },
    { key: "teacherAssigned", label: "Teacher Assigned"  },
    { key: "roomId",          label: "Room ID"           },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold">
              {form.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edit Student</h2>
              <p className="text-indigo-200 text-xs">{form.userId}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 grid grid-cols-2 gap-4 flex-1">
          {fields.map(({ key, label, type, options }) => (
            <div key={key} className={key === "name" || key === "educationEmail" || key === "email" ? "col-span-2" : ""}>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
              {options ? (
                <select
                  value={String(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50"
                >
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={type || "text"}
                  value={String(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t bg-slate-50">
          <button onClick={onClose} className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-5 py-2.5 text-sm rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Save size={14} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ───────────────────────────────────────────────────

function DeleteModal({ names, onConfirm, onClose }: {
  names: string[]; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 flex items-center justify-center">
            <Trash2 size={20} className="text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">
              Delete {names.length > 1 ? `${names.length} Students` : "Student"}
            </h3>
            <p className="text-sm text-slate-500">This action cannot be undone.</p>
          </div>
        </div>
        {names.length <= 3 ? (
          <div className="bg-rose-50 rounded-xl p-3 mb-5 text-sm text-rose-700">
            {names.map((n) => <p key={n} className="font-medium">• {n}</p>)}
          </div>
        ) : (
          <p className="bg-rose-50 rounded-xl p-3 mb-5 text-sm text-rose-700 font-medium">
            {names[0]}, {names[1]}, and {names.length - 2} more…
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 font-medium transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors shadow-lg shadow-rose-200">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Header Cell ───────────────────────────────────────────────────

function SortableHeaderCell({
  col, sort, onSort,
}: {
  col: ColumnDef; sort: SortState; onSort: (k: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, minWidth: col.minWidth };
  const isActive = sort.key === col.id;

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-4 py-0 h-11 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap select-none border-r border-slate-700/50 last:border-r-0 ${isDragging ? "bg-slate-700" : "bg-slate-800"}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-slate-600 hover:text-slate-400 active:cursor-grabbing flex-shrink-0"
          title="Drag to reorder"
        >
          <GripVertical size={13} />
        </span>
        {col.sortable ? (
          <button
            onClick={() => onSort(col.id as string)}
            className={`flex items-center gap-1 group hover:text-white transition-colors ${isActive ? "text-indigo-300" : ""}`}
          >
            {col.label}
            <span className="ml-0.5">
              {isActive
                ? sort.dir === "asc"
                  ? <ArrowUp size={12} className="text-indigo-400" />
                  : <ArrowDown size={12} className="text-indigo-400" />
                : <ChevronDown size={12} className="opacity-20 group-hover:opacity-50" />}
            </span>
          </button>
        ) : (
          <span className="text-slate-400">{col.label}</span>
        )}
      </div>
    </th>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function StudentTable() {
  const [data,            setData]            = useState<Student[]>(initialStudents);
  const [columns,         setColumns]         = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [search,          setSearch]          = useState("");
  const [statusTab,       setStatusTab]       = useState<StudentStatus | "All">("All");
  const [advFilters,      setAdvFilters]      = useState({ gender: "", course: "", timezone: "", classDays: "" });
  const [showAdv,         setShowAdv]         = useState(false);
  const [showColPicker,   setShowColPicker]   = useState(false);
  const [showExport,      setShowExport]      = useState(false);
  const [sort,            setSort]            = useState<SortState>({ key: "name", dir: "asc" });
  const [page,            setPage]            = useState(1);
  const [perPage,         setPerPage]         = useState(10);
  const [selected,        setSelected]        = useState<Set<string>>(new Set());
  const [expanded,        setExpanded]        = useState<Set<string>>(new Set());
  const [inlineEdit,      setInlineEdit]      = useState<InlineEdit | null>(null);
  const [editingStudent,  setEditingStudent]  = useState<Student | null>(null);
  const [deleteTargets,   setDeleteTargets]   = useState<string[]>([]);
  const [toasts,          setToasts]          = useState<Toast[]>([]);

  const colPickerRef = useRef<HTMLDivElement>(null);
  const exportRef    = useRef<HTMLDivElement>(null);

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = generateId();
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // ── Close dropdowns on outside click ──────────────────────────────────────

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false);
      if (exportRef.current    && !exportRef.current.contains(e.target as Node))    setShowExport(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── DnD ───────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oi = columns.findIndex((c) => c.id === active.id);
    const ni = columns.findIndex((c) => c.id === over.id);
    setColumns(arrayMove(columns, oi, ni));
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: data.length, Active: 0, Inactive: 0, Pending: 0, Suspended: 0 };
    data.forEach((s) => counts[s.status]++);
    return counts;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((s) => {
      if (statusTab !== "All" && s.status !== statusTab) return false;
      if (q && ![s.name, s.email, s.educationEmail, s.phone, s.userId, s.course]
        .some((v) => v.toLowerCase().includes(q))) return false;
      if (advFilters.gender   && s.gender   !== advFilters.gender)                              return false;
      if (advFilters.course   && !s.course.toLowerCase().includes(advFilters.course.toLowerCase())) return false;
      if (advFilters.timezone && !s.timezone.toLowerCase().includes(advFilters.timezone.toLowerCase())) return false;
      if (advFilters.classDays && !s.classDays.toLowerCase().includes(advFilters.classDays.toLowerCase())) return false;
      return true;
    });
  }, [data, search, statusTab, advFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sort.key as keyof Student];
      const bv = b[sort.key as keyof Student];
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const paged      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const visibleCols = columns.filter((c) => c.visible);

  // ── Sort ──────────────────────────────────────────────────────────────────

  const handleSort = useCallback((key: string) => {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" }
    );
    setPage(1);
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────

  const pageIds   = paged.map((s) => s.userId);
  const allPageSelected  = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  function toggleSelectPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else                  pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleSelectRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Inline edit ────────────────────────────────────────────────────────────

  function startInlineEdit(rowId: string, colId: keyof Student) {
    if (!EDITABLE_COLS.has(colId)) return;
    const student = data.find((s) => s.userId === rowId);
    if (!student) return;
    setInlineEdit({ rowId, colId, value: String(student[colId]) });
  }

  function commitInlineEdit(newVal: string) {
    if (!inlineEdit) return;
    const { rowId, colId } = inlineEdit;
    setData((prev) => prev.map((s) =>
      s.userId === rowId
        ? { ...s, [colId]: colId === "price" ? Number(newVal) : newVal }
        : s
    ));
    toast(`"${inlineEdit.colId}" updated`);
    setInlineEdit(null);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  function handleSaveEdit(updated: Student) {
    setData((prev) => prev.map((s) => s.userId === updated.userId ? updated : s));
    setEditingStudent(null);
    toast("Student record saved");
  }

  function handleDelete(ids: string[]) {
    const names = ids.map((id) => data.find((s) => s.userId === id)?.name ?? id);
    setData((prev) => prev.filter((s) => !ids.includes(s.userId)));
    setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
    setDeleteTargets([]);
    toast(ids.length === 1 ? `"${names[0]}" deleted` : `${ids.length} students deleted`, "info");
  }

  // ── Active filters ─────────────────────────────────────────────────────────

  const filterChips: { label: string; onRemove: () => void }[] = [];
  if (advFilters.gender)    filterChips.push({ label: `Gender: ${advFilters.gender}`,       onRemove: () => setAdvFilters((f) => ({ ...f, gender: "" }))    });
  if (advFilters.course)    filterChips.push({ label: `Course: ${advFilters.course}`,        onRemove: () => setAdvFilters((f) => ({ ...f, course: "" }))    });
  if (advFilters.timezone)  filterChips.push({ label: `TZ: ${advFilters.timezone}`,          onRemove: () => setAdvFilters((f) => ({ ...f, timezone: "" }))  });
  if (advFilters.classDays) filterChips.push({ label: `Days: ${advFilters.classDays}`,       onRemove: () => setAdvFilters((f) => ({ ...f, classDays: "" })) });

  // ── Pagination numbers ─────────────────────────────────────────────────────

  function pageNumbers() {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("…");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }

  // ── Cell renderer ──────────────────────────────────────────────────────────

  function renderCell(col: ColumnDef, student: Student) {
    const colId = col.id as keyof Student;

    if (col.id === "actions") {
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingStudent(student); }}
            title="Edit"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTargets([student.userId]); }}
            title="Delete"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSaveEdit(student); toast(`"${student.name}" saved`); }}
            title="Save"
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
          >
            <Save size={14} />
          </button>
        </div>
      );
    }

    // Inline edit active?
    if (inlineEdit && inlineEdit.rowId === student.userId && inlineEdit.colId === colId && EDITABLE_COLS.has(colId)) {
      return (
        <InlineInput
          value={inlineEdit.value}
          onSave={commitInlineEdit}
          onCancel={() => setInlineEdit(null)}
          type={colId === "price" ? "number" : "text"}
        />
      );
    }

    if (col.id === "status") {
      const s = STATUS_STYLE[student.status];
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
          {student.status}
        </span>
      );
    }

    if (col.id === "gender") {
      return (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${GENDER_STYLE[student.gender]}`}>
          {student.gender}
        </span>
      );
    }

    if (col.id === "password") {
      const v = student.password;
      const masked = v.slice(0, 4) + "•".repeat(Math.min(v.length - 4, 8));
      return (
        <div className="flex items-center gap-1">
          <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-mono">{masked}</code>
          <CopyBtn text={v} onCopy={() => toast("Password copied", "info")} />
        </div>
      );
    }

    if (col.id === "educationEmail") {
      return (
        <div className="flex items-center gap-1 min-w-0">
          <span className="truncate text-sm" title={student.educationEmail}>{student.educationEmail}</span>
          <CopyBtn text={student.educationEmail} onCopy={() => toast("Email copied", "info")} />
        </div>
      );
    }

    if (col.id === "price") {
      return <span className="font-semibold text-slate-700">${student.price}</span>;
    }

    const val = String(student[colId] ?? "");
    const editable = EDITABLE_COLS.has(colId);

    return (
      <span
        className={`block truncate text-sm text-slate-700 ${editable ? "group-hover/cell:underline group-hover/cell:decoration-dotted group-hover/cell:text-indigo-600 cursor-text" : ""}`}
        title={val}
      >
        {val}
      </span>
    );
  }

  // ── Stats counts ───────────────────────────────────────────────────────────

  const stats = [
    { label: "Total",     value: statusCounts.All,       icon: Users,      color: "bg-slate-700",    tab: "All"       },
    { label: "Active",    value: statusCounts.Active,    icon: UserCheck,  color: "bg-emerald-500",  tab: "Active"    },
    { label: "Pending",   value: statusCounts.Pending,   icon: Clock,      color: "bg-amber-500",    tab: "Pending"   },
    { label: "Inactive",  value: statusCounts.Inactive,  icon: UserX,      color: "bg-slate-500",    tab: "Inactive"  },
    { label: "Suspended", value: statusCounts.Suspended, icon: ShieldAlert,color: "bg-rose-500",     tab: "Suspended" },
  ] as const;

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-8">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Student Management</h1>
              <p className="text-slate-400 text-sm mt-1">Manage and track all enrolled students</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700">
              <RefreshCw size={11} />
              <span>Live • {data.length} records</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-3">
            {stats.map(({ label, value, icon, color, tab }) => (
              <StatCard
                key={tab}
                label={label}
                value={value}
                icon={icon}
                color={color}
                active={statusTab === tab}
                onClick={() => { setStatusTab(tab as StudentStatus | "All"); setPage(1); }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6">

        {/* Toolbar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-[380px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 placeholder:text-slate-400"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Advanced Filter Toggle */}
            <button
              onClick={() => setShowAdv((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border font-medium transition-all ${
                showAdv || filterChips.length > 0
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter size={14} />
              Filters
              {filterChips.length > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {filterChips.length}
                </span>
              )}
            </button>

            <div className="flex-1" />

            {/* Per page */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="hidden sm:inline">Per page:</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 cursor-pointer"
              >
                {[5, 10, 25, 50].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>

            {/* Export */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setShowExport((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium transition-colors"
              >
                <Download size={14} /> Export <ChevronDown size={12} />
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden w-40">
                  <button onClick={() => { exportData(sorted, columns, "csv");  toast("Exported as CSV");  setShowExport(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100">
                    <FileText size={14} className="text-emerald-600" /> Export CSV
                  </button>
                  <button onClick={() => { exportData(sorted, columns, "json"); toast("Exported as JSON"); setShowExport(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <FileJson size={14} className="text-indigo-600" /> Export JSON
                  </button>
                </div>
              )}
            </div>

            {/* Column Picker */}
            <div className="relative" ref={colPickerRef}>
              <button
                onClick={() => setShowColPicker((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium transition-colors"
              >
                <SlidersHorizontal size={14} /> Columns <ChevronDown size={12} />
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 w-52 max-h-80 overflow-y-auto">
                  {columns.filter((c) => c.id !== "actions").map((col) => (
                    <label key={col.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => setColumns((prev) => prev.map((c) => c.id === col.id ? { ...c, visible: !c.visible } : c))}
                        className="accent-indigo-600"
                      />
                      <span className="text-sm text-slate-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Filter Panel */}
          {showAdv && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Gender",     key: "gender",    options: ["", "male", "female"] },
                  { label: "Course",     key: "course",    placeholder: "e.g. Tajweed"     },
                  { label: "Timezone",   key: "timezone",  placeholder: "e.g. Europe"      },
                  { label: "Class Days", key: "classDays", placeholder: "e.g. Mon / Tue"   },
                ] .map(({ label, key, options, placeholder }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                    {options ? (
                      <select
                        value={advFilters[key as keyof typeof advFilters]}
                        onChange={(e) => { setAdvFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                      >
                        <option value="">All</option>
                        {options.filter(Boolean).map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder={placeholder}
                        value={advFilters[key as keyof typeof advFilters]}
                        onChange={(e) => { setAdvFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                      />
                    )}
                  </div>
                ))}
              </div>
              {filterChips.length > 0 && (
                <button
                  onClick={() => { setAdvFilters({ gender: "", course: "", timezone: "", classDays: "" }); setPage(1); }}
                  className="mt-3 text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1"
                >
                  <X size={11} /> Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
              {filterChips.map((chip) => (
                <span key={chip.label} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                  {chip.label}
                  <button onClick={chip.onRemove} className="hover:text-indigo-900">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selected.size > 0 && (
          <div className="bg-indigo-600 text-white rounded-2xl px-5 py-3 mb-4 flex items-center gap-4 shadow-lg shadow-indigo-200 animate-in slide-in-from-top-2 duration-200">
            <CheckSquare size={18} />
            <span className="font-semibold text-sm">{selected.size} student{selected.size > 1 ? "s" : ""} selected</span>
            <div className="flex-1" />
            <button
              onClick={() => { exportData(data.filter((s) => selected.has(s.userId)), columns, "csv"); toast(`Exported ${selected.size} rows`); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors"
            >
              <Download size={13} /> Export Selected
            </button>
            <button
              onClick={() => setDeleteTargets([...selected])}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-sm font-medium transition-colors shadow-sm"
            >
              <Trash2 size={13} /> Delete Selected
            </button>
            <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg hover:bg-white/15">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-sm border-collapse">
                {/* Dark header */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-800">
                    {/* Checkbox */}
                    <th className="sticky left-0 z-30 bg-slate-800 px-4 py-0 h-11 w-10 border-r border-slate-700/50">
                      <button onClick={toggleSelectPage} className="text-slate-400 hover:text-slate-200 transition-colors">
                        {allPageSelected
                          ? <CheckSquare size={16} className="text-indigo-400" />
                          : somePageSelected
                            ? <Square size={16} className="text-indigo-400 opacity-60" />
                            : <Square size={16} />}
                      </button>
                    </th>
                    {/* S.No */}
                    <th className="px-4 py-0 h-11 w-12 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800 border-r border-slate-700/50 whitespace-nowrap">
                      S.No.
                    </th>
                    {/* Expand */}
                    <th className="px-2 py-0 h-11 w-8 bg-slate-800 border-r border-slate-700/50" />
                    {/* Draggable columns */}
                    <SortableContext items={visibleCols.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                      {visibleCols.map((col) => (
                        <SortableHeaderCell key={col.id} col={col} sort={sort} onSort={handleSort} />
                      ))}
                    </SortableContext>
                  </tr>
                </thead>

                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCols.length + 4} className="text-center py-20">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <Search size={24} className="opacity-40" />
                          </div>
                          <p className="font-medium text-slate-500">No students found</p>
                          <p className="text-sm">Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paged.map((student, idx) => {
                      const isSelected = selected.has(student.userId);
                      const isExpanded = expanded.has(student.userId);
                      return (
                        <React.Fragment key={student.userId}>
                          <tr
                            className={`group border-b border-slate-50 transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-indigo-50 hover:bg-indigo-50/80"
                                : "hover:bg-slate-50/60"
                            }`}
                            onClick={() => toggleSelectRow(student.userId)}
                          >
                            {/* Checkbox */}
                            <td className={`sticky left-0 z-10 px-4 py-0 w-10 border-r border-slate-100 ${isSelected ? "bg-indigo-50" : "bg-white"} group-hover:bg-inherit`}>
                              <div className="flex items-center h-full py-3">
                                {isSelected
                                  ? <CheckSquare size={15} className="text-indigo-600" />
                                  : <Square size={15} className="text-slate-300 group-hover:text-slate-400" />}
                              </div>
                            </td>

                            {/* S.No */}
                            <td className={`px-4 py-3 text-xs text-slate-400 font-medium border-r border-slate-100 w-12 ${isSelected ? "bg-indigo-50" : "bg-white"}`}>
                              {(safePage - 1) * perPage + idx + 1}
                            </td>

                            {/* Expand */}
                            <td className="px-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setExpanded((prev) => {
                                  const n = new Set(prev);
                                  n.has(student.userId) ? n.delete(student.userId) : n.add(student.userId);
                                  return n;
                                })}
                                className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded"
                                title={isExpanded ? "Collapse" : "Expand row"}
                              >
                                <ChevronRightIcon
                                  size={14}
                                  className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                />
                              </button>
                            </td>

                            {/* Data cells */}
                            {visibleCols.map((col) => (
                              <td
                                key={col.id}
                                className={`px-4 py-3 group/cell ${col.id !== "actions" && EDITABLE_COLS.has(col.id as keyof Student) ? "cursor-text" : ""}`}
                                style={{ minWidth: col.minWidth }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (col.id !== "actions") startInlineEdit(student.userId, col.id as keyof Student);
                                }}
                                onClick={(e) => { if (col.id === "actions") e.stopPropagation(); }}
                              >
                                {renderCell(col, student)}
                              </td>
                            ))}
                          </tr>

                          {/* Expanded detail */}
                          {isExpanded && <ExpandedDetail student={student} />}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </DndContext>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {sorted.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, sorted.length)}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{sorted.length}</span> students
              {selected.size > 0 && (
                <span className="ml-2 text-indigo-600 font-medium">• {selected.size} selected</span>
              )}
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)} disabled={safePage === 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
              >
                <ChevronFirst size={15} />
              </button>
              <button
                onClick={() => setPage((p) => p - 1)} disabled={safePage === 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>

              {pageNumbers().map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm select-none">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                      safePage === p
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105"
                        : "border border-slate-200 hover:bg-white text-slate-600"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setPage((p) => p + 1)} disabled={safePage === totalPages}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
              >
                <ChevronLast size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Inline edit hint */}
        <p className="text-center text-xs text-slate-400 mt-3">
          Double-click any text cell to edit inline · Click row to select · Click ▶ to expand details
        </p>
      </div>

      {/* Modals */}
      {editingStudent && (
        <EditModal
          student={editingStudent}
          onSave={handleSaveEdit}
          onClose={() => setEditingStudent(null)}
        />
      )}

      {deleteTargets.length > 0 && (
        <DeleteModal
          names={deleteTargets.map((id) => data.find((s) => s.userId === id)?.name ?? id)}
          onConfirm={() => handleDelete(deleteTargets)}
          onClose={() => setDeleteTargets([])}
        />
      )}

      {/* Toasts */}
      <ToastList toasts={toasts} remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
