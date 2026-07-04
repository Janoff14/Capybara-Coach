"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
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

      return api.uploadDocument(token, { file, title });
    },
    onSuccess: async (document) => {
      toast.success("Document uploaded.");
      setTitle("");
      setFile(null);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a study document</DialogTitle>
          <DialogDescription>
            PDFs only for the demo. We store the original file, extract its text,
            and make it available for study sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="document-title">Title (optional)</Label>
            <Input
              id="document-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Human-friendly name for this PDF"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-file">PDF file</Label>
            <label
              htmlFor="document-file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border-soft)] bg-[var(--panel-soft)] px-6 py-8 text-center transition-colors hover:border-[rgba(75,102,72,0.28)] hover:bg-[rgba(205,235,197,0.12)]"
            >
              <FileUp className="mb-4 size-8 text-[var(--primary)]" />
              <p className="font-display text-lg font-bold tracking-[-0.03em] text-[var(--foreground)]">
                Choose a PDF file
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">
                We will keep the original file, extract readable text, and prepare it for the study flow.
              </p>
              <input
                id="document-file"
                className="sr-only"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-xs text-[var(--muted-foreground)]">
              {file ? `Selected: ${file.name}` : "Choose a single PDF file."}
            </p>
          </div>

          <Button
            className="w-full"
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
