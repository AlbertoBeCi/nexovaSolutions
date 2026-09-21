/**
 * NEXOVA SOLUTIONS - incidencias/_components/csv-uploader.tsx
 * Zona de subida de un CSV de tickets de soporte: soporta arrastrar y
 * soltar (drag & drop) y selector de archivo tradicional. Solo valida la
 * extensión en cliente (UX inmediata); la validación real de columnas y
 * reglas de negocio la hace services/api (ver POST /api/incidents/analyze).
 */

"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

interface CsvUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function CsvUploader({ onFileSelected, disabled = false }: CsvUploaderProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setLocalError("El archivo debe tener extensión .csv.");
      return;
    }

    setLocalError(null);
    onFileSelected(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    handleFile(event.dataTransfer.files?.[0]);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    // permite volver a seleccionar el mismo archivo dos veces seguidas
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        } ${
          isDraggingOver
            ? "border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-800"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
        }`}
      >
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Arrastra aquí tu archivo CSV de tickets de soporte
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          o haz clic para seleccionarlo desde tu equipo
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
          aria-label="Seleccionar archivo CSV de tickets de soporte"
        />
      </div>

      {localError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {localError}
        </p>
      )}
    </div>
  );
}
