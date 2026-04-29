import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { normalizeChineseInstitutionalReport } from "./chinese-template";
import type { InstitutionalReport } from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const FONT_SIZE_TITLE = 14;
const FONT_SIZE_BODY = 11;
const MARGIN_X = 40;
const MARGIN_Y = 46;
const LINE_HEIGHT = 18;

function splitLines(text: string, maxCharsPerLine = 40): string[] {
  const normalized = text.replace(/\r/g, "");
  const lines: string[] = [];
  normalized.split("\n").forEach((line) => {
    if (!line) {
      lines.push("");
      return;
    }
    for (let i = 0; i < line.length; i += maxCharsPerLine) {
      lines.push(line.slice(i, i + maxCharsPerLine));
    }
  });
  return lines;
}

export async function buildLightweightPdf(rawReport: InstitutionalReport): Promise<Uint8Array> {
  const report = normalizeChineseInstitutionalReport(rawReport);
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let cursorY = PAGE_HEIGHT - MARGIN_Y;
  const writeLine = (text: string, size = FONT_SIZE_BODY) => {
    if (cursorY < MARGIN_Y) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN_Y;
    }
    page.drawText(text, {
      x: MARGIN_X,
      y: cursorY,
      size,
      font,
      color: rgb(0.12, 0.12, 0.12),
    });
    cursorY -= LINE_HEIGHT;
  };

  writeLine(report.title, FONT_SIZE_TITLE);
  writeLine(`${report.stock.name} (${report.stock.code})`);
  writeLine(`生成时间：${report.generatedAt}`);
  writeLine("");

  for (const section of report.sections) {
    writeLine(section.title, FONT_SIZE_TITLE);
    splitLines(section.content).forEach((line) => writeLine(line));
    writeLine("");
  }

  writeLine("免责声明", FONT_SIZE_TITLE);
  splitLines(report.disclaimer || "").forEach((line) => writeLine(line));

  return await pdfDoc.save();
}

