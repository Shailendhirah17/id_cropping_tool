import * as pdfjsLib from 'pdfjs-dist';

// Use local worker via Vite URL import handling to avoid external CDN issues/404s
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const loadPDFPageAsImage = async (file: File, pageNum: number = 1): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfStatus = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdfStatus.getPage(pageNum);
  
  // High-res rendering (scale 2.5)
  const viewport = page.getViewport({ scale: 2.5 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Could not create canvas context');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await (page as any).render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas
  }).promise;

  return canvas.toDataURL('image/png');
};

export const getPDFPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfStatus = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdfStatus.numPages;
};

/**
 * Load ALL pages of a PDF as an array of data URL images.
 */
export const loadAllPDFPages = async (file: File, scale: number = 2.5): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create canvas context');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await (page as any).render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;

    pages.push(canvas.toDataURL('image/png'));
  }

  return pages;
};

/**
 * Load a single page from a PDF ArrayBuffer (avoids re-reading the file).
 */
export const loadPDFPageFromBuffer = async (
  arrayBuffer: ArrayBuffer,
  pageNum: number = 1,
  scale: number = 2.5
): Promise<string> => {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create canvas context');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await (page as any).render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas.toDataURL('image/png');
};
