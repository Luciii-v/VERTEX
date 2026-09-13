import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  UploadCloud, 
  Eye, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Tag,
  X,
  Plus
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { DocumentItem } from '../types';
import { GlassPanel } from '../components/GlassPanel';

export const DocumentLibrary: React.FC = () => {
  const { documents, addDocument, deleteDocument, addToast } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'Date' | 'Name' | 'Type'>('Date');
  const [isDragging, setIsDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['All', 'SOP', 'P&ID', 'Manual', 'Work Order', 'Report'];

  const filteredDocs = documents
    .filter((doc) => {
      const matchesSearch = 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'Name') return a.title.localeCompare(b.title);
      if (sortBy === 'Type') return a.category.localeCompare(b.category);
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const extension = file.name.split('.').pop()?.toUpperCase() || 'PDF';
      let cat: any = 'Report';
      if (extension === 'DWG') cat = 'P&ID';
      else if (file.name.includes('SOP')) cat = 'SOP';
      else if (file.name.includes('WO')) cat = 'Work Order';

      addDocument({
        title: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
        fileName: file.name,
        category: cat,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        tags: [extension, 'Ingested'],
        contentPreview: `Document ${file.name} ingested on-premise into sovereign vector index.`,
      });
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="p-6 space-y-6 font-mono overflow-y-auto h-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-textPrimary  uppercase tracking-widest">
            SOVEREIGN DOCUMENT REPOSITORY
          </h2>
          <p className="text-xs text-textPrimary/80 mt-1">
            Local vector-indexed industrial documents, P&ID schematics, SOP manuals, and inspection logs.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-textPrimary text-base hover:bg-textPrimary/90 rounded-lg font-bold text-xs flex items-center gap-2  transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> UPLOAD NEW DOCUMENT (Ctrl+U)
        </button>
      </div>

      {/* Prominent Upload Panel (Drag & Drop Zone) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden ${
          isDragging
            ? 'border-border bg-textPrimary/10 '
            : 'border-border bg-panel hover:border-border hover:bg-textPrimary/5'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileUpload(e.target.files)}
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.dwg,.docx,.xlsx"
          className="hidden"
        />

        <div className="p-3 bg-textPrimary/20 text-textPrimary rounded-full">
          <UploadCloud className="w-8 h-8 animate-bounce" />
        </div>

        <h3 className="text-sm font-bold text-textPrimary">
          DRAG & DROP REFINERY DOCUMENTS HERE
        </h3>
        <p className="text-xs text-textSecondary">
          or <span className="text-textPrimary underline font-bold">click to browse local files</span>
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] text-textSecondary">
          <span>Supported: <strong className="text-textPrimary">PDF, DWG, PNG, JPG, DOCX, XLSX</strong></span>
          <span>•</span>
          <span>Max File Size: <strong className="text-textPrimary">50 MB</strong></span>
          <span>•</span>
          <span>Ingestion: <strong className="text-accent">SOVEREIGN OCR & VECTOR INDEX</strong></span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-panel p-4 rounded-xl border border-border">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-textPrimary absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents by title, file name, tag (e.g. P-102A, SOP-402)..."
            className="w-full bg-base border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-textPrimary placeholder-[#00d4ff]/40 focus:outline-none focus:border-border"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-textPrimary shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-textPrimary text-base '
                  : 'bg-base text-textSecondary hover:text-textPrimary border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-textSecondary">Sort:</span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-base border border-border rounded-lg px-2.5 py-1.5 text-xs text-textPrimary focus:outline-none"
          >
            <option value="Date">Upload Date</option>
            <option value="Name">Title</option>
            <option value="Type">Category</option>
          </select>
        </div>
      </div>

      {/* 3-Column Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocs.map((doc) => (
          <GlassPanel
            key={doc.id}
            variant="cyan"
            className="flex flex-col justify-between space-y-4 hover:border-border transition-all group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="p-2 bg-textPrimary/10 border border-border rounded-lg text-textPrimary shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                  doc.status === 'INDEXED [OK]'
                    ? 'bg-textPrimary/10 text-textPrimary border-border'
                    : 'bg-accent/10 text-accent border-border'
                }`}>
                  {doc.status}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-textPrimary group-hover:text-textPrimary line-clamp-1">
                  {doc.title}
                </h4>
                <span className="text-[10px] text-textSecondary block mt-0.5 font-mono">
                  {doc.fileName} • {doc.fileSize}
                </span>
              </div>

              <p className="text-xs text-textSecondary bg-base p-2 rounded border border-border line-clamp-2">
                {doc.contentPreview}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {doc.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[9px] bg-panel text-textPrimary px-1.5 py-0.5 rounded border border-border flex items-center gap-1"
                  >
                    <Tag className="w-2.5 h-2.5" /> {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-[10px] text-textSecondary">{doc.uploadDate}</span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="px-2.5 py-1 bg-textPrimary/10 hover:bg-textPrimary/20 text-textPrimary border border-border rounded flex items-center gap-1"
                  title="Preview document content"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  onClick={() => addToast('DOWNLOAD INITIALIZED', `Downloading ${doc.fileName}`, 'success')}
                  className="p-1 text-textSecondary hover:text-textPrimary hover:bg-base rounded"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="p-1 text-error/70 hover:text-error hover:bg-error/10 rounded"
                  title="Delete Document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-textSecondary pt-4 border-t border-border">
        <span>Showing {filteredDocs.length} of {documents.length} sovereign documents</span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-panel border border-border rounded hover:text-textPrimary disabled:opacity-30">
            Previous
          </button>
          <span className="text-textPrimary font-bold">Page 1 of 1</span>
          <button className="px-3 py-1 bg-panel border border-border rounded hover:text-textPrimary disabled:opacity-30">
            Next
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-base  flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-panel border-2 border-border rounded-xl p-5 space-y-4 ">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-textPrimary flex items-center gap-2">
                <FileText className="w-5 h-5" /> {previewDoc.title}
              </h3>
              <button onClick={() => setPreviewDoc(null)} className="text-textSecondary hover:text-textPrimary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-textSecondary">
              <div className="p-3 bg-base border border-border rounded space-y-1">
                <div><strong className="text-textPrimary">File Name:</strong> {previewDoc.fileName}</div>
                <div><strong className="text-textPrimary">Category:</strong> {previewDoc.category}</div>
                <div><strong className="text-textPrimary">Size:</strong> {previewDoc.fileSize}</div>
                <div><strong className="text-textPrimary">Status:</strong> <span className="text-textPrimary">{previewDoc.status}</span></div>
              </div>
              <div className="p-4 bg-base border border-border rounded text-textPrimary leading-relaxed max-h-64 overflow-y-auto">
                <span className="font-bold text-textPrimary block mb-2">[Sovereign Vector Ingest Content]:</span>
                {previewDoc.contentPreview}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-textPrimary text-base rounded font-bold hover:bg-textPrimary/90 text-xs "
              >
                CLOSE PREVIEW
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
