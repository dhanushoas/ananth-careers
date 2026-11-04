import { HttpResponse } from '@angular/common/http';

/** Extracts the filename from a Content-Disposition header. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

/** Triggers a browser download for a blob response. */
export function saveBlobResponse(response: HttpResponse<Blob>, fallbackName: string): void {
  if (!response.body) {
    return;
  }
  const name = filenameFromDisposition(response.headers.get('Content-Disposition'), fallbackName);
  saveBlob(response.body, name);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveJson(data: unknown, filename: string): void {
  saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}
