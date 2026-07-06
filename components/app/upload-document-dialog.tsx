"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { OperationProgress } from "@/components/app/operation-progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { DocumentRead } from "@/lib/types";

type UploadDocumentDialogProps = {
  buttonLabel?: string;
  buttonVariant?: "default" | "secondary" | "ghost";
  buttonClassName?: string;
  onUploaded?: (document: DocumentRead) => void;
};

export function UploadDocumentDialog({
  buttonLabel = "Upload document",
  buttonVariant = "default",
  buttonClassName,
  onUploaded,
}: UploadDocumentDialogProps) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to upload a document.");
      }

      if (!file) {
        throw new Error("Choose a PDF before uploading.");
      }

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        throw new Error("PDF files only for this MVP.");
      }

      setUploadProgress(0);
      return api.uploadDocument(token, { file, title }, setUploadProgress);
    },
    onSuccess: async (document) => {
      toast.success("Document uploaded.");
      setTitle("");
      setFile(null);
      setUploadProgress(null);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      onUploaded?.(document);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Document upload failed.";
      toast.error(message);
      setUploadProgress(null);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} className={buttonClassName}>
          <FileUp className="size-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="reader-upload-dialog">
        <DialogHeader className="reader-upload-header">
          <p className="reader-overline">Circulation desk · new acquisition</p>
          <DialogTitle>Catalog a study document</DialogTitle>
          <DialogDescription>
            PDFs only for the demo. We store the original file, extract its text,
            and make it available for study sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="reader-upload-form">
          <div className="reader-upload-field">
            <Label htmlFor="document-title">Title (optional)</Label>
            <Input
              id="document-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Human-friendly name for this PDF"
            />
          </div>

          <div className="reader-upload-field">
            <Label htmlFor="document-file">PDF file</Label>
            <label
              htmlFor="document-file"
              className="reader-upload-dropzone"
            >
              <FileUp aria-hidden="true" />
              <p>
                Choose a PDF file
              </p>
              <span>
                We will keep the original file, extract readable text, and prepare it for the study flow.
              </span>
              <input
                id="document-file"
                className="sr-only"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="reader-upload-file" role="status">
              {file ? `Selected: ${file.name}` : "Choose a single PDF file."}
            </p>
          </div>

          {uploadMutation.isPending ? (
            <OperationProgress
              compact
              label={uploadProgress === 100 ? "Extracting text and filing card" : "Uploading PDF"}
              detail={uploadProgress === 100 ? "The file arrived. The catalog is reading and indexing it now." : file?.name}
              value={uploadProgress === 100 ? null : uploadProgress}
            />
          ) : null}

          <Button
            className="reader-upload-submit"
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
