import type { RefObject } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileUploadCardProps = {
  file: File | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  onFileSelected: (file: File | null) => void;
  onDragStateChange: (dragging: boolean) => void;
};

const pickFirstFitFile = (files: FileList | null): File | null => {
  const selected = files?.[0] ?? null;
  if (!selected) return null;
  return selected;
};

export function FileUploadCard({
  file,
  fileInputRef,
  isDragging,
  onFileSelected,
  onDragStateChange,
}: FileUploadCardProps) {
  return (
    <div className="panel p-5 md:p-6">
      <h2 className="section-title">1. FIT File Upload</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Use your original treadmill activity file as the source for correction.
      </p>

      <label
        className={cn(
          "panel-soft flex cursor-pointer flex-col border border-dashed border-border/75 p-3 transition-colors",
          "gap-3 hover:border-primary/45",
          isDragging && "border-primary bg-primary/5"
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragStateChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragStateChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragStateChange(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragStateChange(false);
          onFileSelected(pickFirstFitFile(event.dataTransfer.files));
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".fit"
          className="sr-only"
          onChange={(event) => onFileSelected(pickFirstFitFile(event.target.files))}
        />

        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" /> Choose a .fit file
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Select File
          </Button>
          <span className="text-sm text-muted-foreground">{file ? file.name : "No file selected"}</span>
        </div>

        <span className="text-xs text-muted-foreground">
          {file ? `${(file.size / 1024).toFixed(1)} KB` : "Accepted format: .fit"}
        </span>
      </label>
    </div>
  );
}
