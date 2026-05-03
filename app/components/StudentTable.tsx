"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Trash2,
  Save,
  X,
  Filter,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { students as initialStudents, Student, StudentStatus } from "../data/students";

// ─── Column Definitions ────────────────────────────────────────────────────

export interface ColumnDef {
  id: keyof Student | "actions";
  label: string;
  visible: boolean;
  sortable?: boolean;
  minWidth?: number;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "userId", label: "User ID", visible: false, sortable: true, minWidth: 90 },
  { id: "name", label: "Name", visible: true, sortable: true, minWidth: 120 },
  { id: "email", label: "Email", visible: false, sortable: true, minWidth: 180 },
  { id: "gender", label: "Gender", visible: true, sortable: true, minWidth: 80 },
  { id: "dateOfBirth", label: "Date of Birth", visible: false, sortable: true, minWidth: 110 },
  { id: "phone", label: "Phone", visible: true, sortable: false, minWidth: 130 },
  { id: "timezone", label: "Timezone", visible: true, sortable: true, minWidth: 140 },
  { id: "educationEmail", label: "Education Email", visible: true, sortable: true, minWidth: 180 },
  { id: "password", label: "Password", visible: true, sortable: false, minWidth: 140 },
  { id: "preferredTime", label: "Preferred Time", visible: true, sortable: true, minWidth: 120 },
  { id: "classDays", label: "Class Days", visible: true, sortable: true, minWidth: 100 },
  { id: "price", label: "Price", visible: false, sortable: true, minWidth: 70 },
  { id: "status", label: "Status", visible: true, sortable: true, minWidth: 90 },
  { id: "course", label: "Course", visible: true, sortable: true, minWidth: 140 },
  { id: "parentInquiry", label: "Parent Inquiry", visible: false, sortable: true, minWidth: 110 },
  { id: "teacherAssigned", label: "Teacher Assigned", visible: false, sortable: true, minWidth: 130 },
  { id: "roomId", label: "Room ID", visible: false, sortable: true, minWidth: 80 },
  { id: "actions", label: "Actions", visible: true, sortable: false, minWidth: 100 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const STATUS_CLASSES: Record<StudentStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-gray-100 text-gray-600",
  Pending: "bg-yellow-100 text-yellow-700",
  Suspended: "bg-red-100 text-red-600",
};

const GENDER_CLASSES: Record<string, string> = {
  male: "bg-green-100 text-green-700",
  female: "bg-pink-100 text-pink-700",
};

function exportToCSV(data: Student[], columns: ColumnDef[]) {
  const visible = columns.filter((c) => c.visible && c.id !== "actions");
  const header = visible.map((c) => c.label).join(",");
  const rows = data.map((row) =>
    visible
      .map((c) => {
        const val = String(row[c.id as keyof Student] ?? "");
        return val.includes(",") ? `"${val}"` : val;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Draggable Header Cell ─────────────────────────────────────────────────

function SortableHeaderCell({
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  column: ColumnDef;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    minWidth: column.minWidth,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200 whitespace-nowrap select-none"
    >
      <div className="flex items-center gap-1">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </span>
        {column.sortable ? (
          <button
            onClick={() => onSort(column.id as string)}
            className="flex items-center gap-1 hover:text-gray-900"
          >
            {column.label}
            <span className="text-gray-400">
              {sortKey === column.id ? (
                sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
              ) : (
                <ChevronDown size={14} className="opacity-30" />
              )}
            </span>
          </button>
        ) : (
          <span>{column.label}</span>
        )}
      </div>
    </th>
  );
}

// ─── Copy Button ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="ml-1 text-gray-400 hover:text-gray-700" title="Copy">
      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
    </button>
  );
}

// ─── Edit Row Modal ────────────────────────────────────────────────────────

function EditModal({
  student,
  onSave,
  onClose,
}: {
  student: Student;
  onSave: (s: Student) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Student>({ ...student });

  const fields: { key: keyof Student; label: string; type?: string }[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email", type: "email" },
    { key: "gender", label: "Gender" },
    { key: "dateOfBirth", label: "Date of Birth", type: "date" },
    { key: "phone", label: "Phone" },
    { key: "timezone", label: "Timezone" },
    { key: "educationEmail", label: "Education Email", type: "email" },
    { key: "password", label: "Password" },
    { key: "preferredTime", label: "Preferred Time" },
    { key: "classDays", label: "Class Days" },
    { key: "price", label: "Price", type: "number" },
    { key: "status", label: "Status" },
    { key: "course", label: "Course" },
    { key: "parentInquiry", label: "Parent Inquiry" },
    { key: "teacherAssigned", label: "Teacher Assigned" },
    { key: "roomId", label: "Room ID" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-800">Edit Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {fields.map(({ key, label, type }) => (
            <div key={key} className={key === "name" || key === "educationEmail" ? "col-span-2" : ""}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              {key === "gender" ? (
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as "male" | "female" })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              ) : key === "status" ? (
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  {(["Active", "Inactive", "Pending", "Suspended"] as StudentStatus[]).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={type || "text"}
                  value={String(form[key])}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: type === "number" ? Number(e.target.value) : e.target.value,
                    })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-end p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 flex items-center gap-2"
          >
            <Save size={14} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function StudentTable() {
  const [data, setData] = useState<Student[]>(initialStudents);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [search, setSearch] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState({
    gender: "",
    status: "",
    course: "",
    timezone: "",
    classDays: "",
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const columnPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = data.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.educationEmail.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.userId.toLowerCase().includes(q) ||
      s.course.toLowerCase().includes(q);

    const matchesGender = !advancedFilters.gender || s.gender === advancedFilters.gender;
    const matchesStatus = !advancedFilters.status || s.status === advancedFilters.status;
    const matchesCourse =
      !advancedFilters.course ||
      s.course.toLowerCase().includes(advancedFilters.course.toLowerCase());
    const matchesTimezone =
      !advancedFilters.timezone ||
      s.timezone.toLowerCase().includes(advancedFilters.timezone.toLowerCase());
    const matchesClassDays =
      !advancedFilters.classDays ||
      s.classDays.toLowerCase().includes(advancedFilters.classDays.toLowerCase());

    return matchesSearch && matchesGender && matchesStatus && matchesCourse && matchesTimezone && matchesClassDays;
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey as keyof Student];
    const bv = b[sortKey as keyof Student];
    if (av === undefined || bv === undefined) return 0;
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortKey(key); setSortDir("asc"); }
      setPage(1);
    },
    [sortKey]
  );

  // ── Column DnD ────────────────────────────────────────────────────────────

  const visibleColumns = columns.filter((c) => c.visible);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = columns.findIndex((c) => c.id === active.id);
    const newIdx = columns.findIndex((c) => c.id === over.id);
    setColumns(arrayMove(columns, oldIdx, newIdx));
  }

  // ── Edit / Delete ─────────────────────────────────────────────────────────

  function handleSaveEdit(updated: Student) {
    setData((prev) => prev.map((s) => (s.userId === updated.userId ? updated : s)));
    setEditingStudent(null);
  }

  function handleDelete(userId: string) {
    setData((prev) => prev.filter((s) => s.userId !== userId));
    setDeleteId(null);
  }

  // ── Render cell value ─────────────────────────────────────────────────────

  function renderCell(col: ColumnDef, student: Student) {
    if (col.id === "actions") {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingStudent(student)}
            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteId(student.userId)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={() => handleSaveEdit(student)}
            className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors"
            title="Save"
          >
            <Save size={15} />
          </button>
        </div>
      );
    }

    if (col.id === "gender") {
      return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${GENDER_CLASSES[student.gender]}`}>
          {student.gender}
        </span>
      );
    }

    if (col.id === "status") {
      return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[student.status]}`}>
          {student.status}
        </span>
      );
    }

    if (col.id === "password") {
      const val = student.password;
      const masked = val.length > 6 ? val.slice(0, 4) + "•".repeat(Math.min(val.length - 4, 8)) : "••••";
      return (
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{masked}</span>
          <CopyButton text={val} />
        </div>
      );
    }

    if (col.id === "educationEmail") {
      const val = student.educationEmail;
      return (
        <div className="flex items-center gap-1">
          <span className="truncate max-w-[160px]" title={val}>{val}</span>
          <CopyButton text={val} />
        </div>
      );
    }

    if (col.id === "price") {
      return <span>${student.price}</span>;
    }

    const val = String(student[col.id as keyof Student] ?? "");
    return <span className="truncate max-w-[180px] block" title={val}>{val}</span>;
  }

  const hasActiveFilters = Object.values(advancedFilters).some(Boolean);
  const activeFilterCount = Object.values(advancedFilters).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and track all student records</p>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[340px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {/* Advanced Search Toggle */}
            <button
              onClick={() => setShowAdvancedSearch((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                showAdvancedSearch || hasActiveFilters
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Filter size={15} />
              Advanced Search
              {activeFilterCount > 0 && (
                <span className="bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex-1" />

            {/* Export */}
            <button
              onClick={() => exportToCSV(sorted, columns)}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
            >
              <Download size={15} />
              Export
            </button>

            {/* Per page */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Per Page:</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {[5, 10, 25, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Column Picker */}
            <div className="relative" ref={columnPickerRef}>
              <button
                onClick={() => setShowColumnPicker((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
              >
                <SlidersHorizontal size={15} />
                Columns
                <ChevronDown size={14} />
              </button>

              {showColumnPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-2 w-52 max-h-80 overflow-y-auto">
                  {columns
                    .filter((c) => c.id !== "actions")
                    .map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() =>
                            setColumns((prev) =>
                              prev.map((c) => (c.id === col.id ? { ...c, visible: !c.visible } : c))
                            )
                          }
                          className="accent-green-500"
                        />
                        {col.label}
                      </label>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Search Panel */}
          {showAdvancedSearch && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select
                    value={advancedFilters.gender}
                    onChange={(e) => { setAdvancedFilters((f) => ({ ...f, gender: e.target.value })); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={advancedFilters.status}
                    onChange={(e) => { setAdvancedFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">All</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                  <input
                    type="text"
                    placeholder="Filter by course..."
                    value={advancedFilters.course}
                    onChange={(e) => { setAdvancedFilters((f) => ({ ...f, course: e.target.value })); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
                  <input
                    type="text"
                    placeholder="Filter by timezone..."
                    value={advancedFilters.timezone}
                    onChange={(e) => { setAdvancedFilters((f) => ({ ...f, timezone: e.target.value })); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Class Days</label>
                  <input
                    type="text"
                    placeholder="e.g. Mon / Tue"
                    value={advancedFilters.classDays}
                    onChange={(e) => { setAdvancedFilters((f) => ({ ...f, classDays: e.target.value })); setPage(1); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setAdvancedFilters({ gender: "", status: "", course: "", timezone: "", classDays: "" });
                    setPage(1);
                  }}
                  className="mt-3 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200 w-12">
                      S.No.
                    </th>
                    <SortableContext
                      items={visibleColumns.map((c) => c.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      {visibleColumns.map((col) => (
                        <SortableHeaderCell
                          key={col.id}
                          column={col}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={handleSort}
                        />
                      ))}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paged.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 1}
                        className="text-center py-16 text-gray-400"
                      >
                        <Search size={36} className="mx-auto mb-2 opacity-30" />
                        No students found matching your search.
                      </td>
                    </tr>
                  ) : (
                    paged.map((student, idx) => (
                      <tr
                        key={student.userId}
                        className="hover:bg-green-50/40 transition-colors"
                      >
                        <td className="px-3 py-3 text-gray-500 text-xs font-medium">
                          {(safePage - 1) * perPage + idx + 1}
                        </td>
                        {visibleColumns.map((col) => (
                          <td key={col.id} className="px-3 py-3 text-gray-700 text-sm">
                            {renderCell(col, student)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DndContext>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium text-gray-700">
                {sorted.length === 0 ? 0 : (safePage - 1) * perPage + 1}
              </span>{" "}
              -{" "}
              <span className="font-medium text-gray-700">
                {Math.min(safePage * perPage, sorted.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-700">{sorted.length}</span> entries
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
                title="First page"
              >
                <ChevronFirst size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-sm text-gray-600"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-sm font-medium text-gray-700 px-3 py-1.5 bg-green-500 text-white rounded-lg">
                Page {safePage} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-sm text-gray-600"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
                title="Last page"
              >
                <ChevronLast size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingStudent && (
        <EditModal
          student={editingStudent}
          onSave={handleSaveEdit}
          onClose={() => setEditingStudent(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Student</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900">
                {data.find((s) => s.userId === deleteId)?.name}
              </span>
              ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
