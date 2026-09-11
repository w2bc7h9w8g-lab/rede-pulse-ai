import writeXlsxFile from "write-excel-file/browser";

export type CellValue = string | number | null | undefined;
export type SheetSpec = { name: string; rows: CellValue[][] };

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, "-").slice(0, 31).trim();
  return cleaned || `Planilha ${index + 1}`;
}

function toCells(rows: CellValue[][], headerRow: boolean) {
  return rows.map((row, rowIndex) =>
    row.map((cell) => {
      if (cell === null || cell === undefined || cell === "") {
        return { value: null, type: String } as const;
      }
      if (typeof cell === "number") {
        return {
          value: cell,
          type: Number,
          fontWeight: rowIndex === 0 && headerRow ? ("bold" as const) : undefined,
        };
      }
      return {
        value: String(cell),
        type: String,
        fontWeight: rowIndex === 0 && headerRow ? ("bold" as const) : undefined,
      };
    }),
  );
}

/** Gera um .xlsx no navegador, uma aba por item de `sheets`. */
export async function downloadXlsx(sheets: SheetSpec[], fileName: string): Promise<void> {
  const usable = sheets.filter((s) => s.rows.length > 0);
  if (usable.length === 0) throw new Error("Não há dados para exportar.");

  const names: string[] = [];
  usable.forEach((sheet, index) => {
    let name = sanitizeSheetName(sheet.name, index);
    let suffix = 2;
    while (names.includes(name)) {
      name = sanitizeSheetName(`${sheet.name} (${suffix})`, index);
      suffix += 1;
    }
    names.push(name);
  });

  const data = usable.map((sheet) => toCells(sheet.rows, true));

  const blob = (await writeXlsxFile(data as never, { sheets: names } as never)) as unknown as Blob;
  triggerDownload(blob, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadCsv(rows: CellValue[][], fileName: string): void {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell === null || cell === undefined ? "" : String(cell);
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(";"),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, fileName.endsWith(".csv") ? fileName : `${fileName}.csv`);
}

