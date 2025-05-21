/**
 * PDF Spread Merger – Node.js + pdf-lib
 * Author       : Rishabh Garai
 * Contact      : +91-7808904220
 * Email        : rishabhgarai33@gmail.com
 * Version      : 1.0.0
 * Last Updated : 16 May 2025
 *
 * -------------------------------
 *  Dependencies:
 * - express       : ^4.18.4
 * - pdf-lib       : ^1.17.1
 * - body-parser   : ^1.20.2
 * - ejs           : ^3.1.9
 * - path, url     : Node.js built-in modules
 *
 * -------------------------------
 *  How It Works:
 * - Accepts a base64-encoded PDF via POST request.
 * - Creates a new PDF by merging selected pages into horizontal spreads (left + right pages).
 * - Allows optional blank pages in the spread using custom `pagePairs`.
 * - Applies equal margins around the spread (top, bottom, left, right) while removing spacing between left and right pages.
 * - Returns the newly created spread PDF as a downloadable file.
 */
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb } from 'pdf-lib';

const app = express();

// ES module __dirname support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// JSON body limit for base64 PDF
app.use(bodyParser.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.render('index');
});
app.post('/merge-spread', async (req, res) => {
  try {
    const base64Data = req.body.pdfBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const originalPdf = await PDFDocument.load(buffer);
    const newPdf = await PDFDocument.create();

    // === Constants ===
    const POINTS_PER_MM = 2.83465;
    const BLEED_MM = 5;
    const BLEED = BLEED_MM * POINTS_PER_MM;
    const CUT_OFFSET = 2;
    const MARK_LENGTH = 10;

    const IMG_WIDTH = 575.525;
    const IMG_HEIGHT = 575.525;
    const FINAL_WIDTH = IMG_WIDTH * 2 + BLEED * 2;
    const FINAL_HEIGHT = IMG_HEIGHT + BLEED * 2;
    const MARGIN_X = BLEED;
    const MARGIN_Y = BLEED;

    const pagePairs = [
      [2, 'blank'],
      ['blank', 1],
      [6, 3],
      [4, 5],
      [10, 7],
      [8, 9],
      [14, 11],
      [12, 13],
      ['blank', 15],
      [16, 0]
    ];

    const uniquePages = [...new Set(pagePairs.flat().filter(p => p !== 'blank'))];
    const copiedPages = await newPdf.copyPages(originalPdf, uniquePages);
    const pageMap = {};
    uniquePages.forEach((pageNum, index) => {
      pageMap[pageNum] = copiedPages[index];
    });
    const drawCutMarks = (page, width, height, bleed) => {
  const drawLine = (x1, y1, x2, y2) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  };
// === bottom left
// Horizontal (flush against top trim line)
drawLine(bleed - 10, bleed, bleed, bleed);  // horizontal line
// Vertical (flush against left top corner)
drawLine(bleed - 0, bleed - 10, bleed , bleed);  // vertical line

// === bottom right
drawLine(width - bleed , bleed, width - bleed  + 10, bleed);  // horizontal line
drawLine(width - bleed , bleed - 10, width - bleed , bleed);  // vertical line

  // === top left
  // Horizontal (Y = height - bleed)
  drawLine(bleed - 10, height - bleed-9, bleed+1, height - bleed-9);
  // Vertical (X = bleed - 2)
  drawLine(bleed , height - bleed-10, bleed , height - bleed );

  // === top right
  // Horizontal 
  drawLine(width - bleed -2, height - bleed-9, width - bleed  +9, height - bleed-9);
  // Vertical 
  drawLine(width - bleed -1, height - bleed-9, width - bleed -1, height - bleed +1);
};


    // === Generate spreads with bleed + marks ===
    for (const [leftIdx, rightIdx] of pagePairs) {
      const page = newPdf.addPage([FINAL_WIDTH, FINAL_HEIGHT]);

      if (leftIdx !== 'blank' && pageMap[leftIdx]) {
        const [embeddedLeft] = await newPdf.embedPages([pageMap[leftIdx]]);
        page.drawPage(embeddedLeft, {
          x: MARGIN_X,
          y: 5,
          width: IMG_WIDTH,
          height: IMG_HEIGHT,
        });
      }

      if (rightIdx !== 'blank' && pageMap[rightIdx]) {
        const [embeddedRight] = await newPdf.embedPages([pageMap[rightIdx]]);
        page.drawPage(embeddedRight, {
          x: MARGIN_X + IMG_WIDTH,
          y: 5,
          width: IMG_WIDTH,
          height: IMG_HEIGHT,
        });
      }

      drawCutMarks(page, FINAL_WIDTH, FINAL_HEIGHT, BLEED);
    }

    // === Wrap each spread page inside a larger centered canvas ===
    const wrapperPdf = await PDFDocument.create();
    const finalPages = await wrapperPdf.copyPages(newPdf, newPdf.getPageIndices());

    const WRAP_PADDING = 30; // extra space around entire spread
    const WRAP_WIDTH = FINAL_WIDTH + WRAP_PADDING * 2;
    const WRAP_HEIGHT = FINAL_HEIGHT + WRAP_PADDING * 2;

    for (const page of finalPages) {
      const wrapperPage = wrapperPdf.addPage([WRAP_WIDTH, WRAP_HEIGHT]);

      const [embeddedPage] = await wrapperPdf.embedPages([page]);

      wrapperPage.drawPage(embeddedPage, {
        x: (WRAP_WIDTH - FINAL_WIDTH) / 2,
        y: (WRAP_HEIGHT - FINAL_HEIGHT) / 2,
        width: FINAL_WIDTH,
        height: FINAL_HEIGHT
      });
    }

    // === Final export ===
    const finalPdfBytes = await wrapperPdf.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=wrapped_bleed_spread.pdf',
    });
    res.send(Buffer.from(finalPdfBytes));
  } catch (err) {
    console.error('Error generating merged spread:', err);
    res.status(500).json({ error: "Please verify your PDF page numbers or try again due to a technical issue." });
  }
});

app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});
