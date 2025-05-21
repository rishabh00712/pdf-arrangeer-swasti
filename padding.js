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
import { PDFDocument, rgb } from 'pdf-lib';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// ES module __dirname support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (optional)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse large JSON
app.use(bodyParser.json({ limit: '50mb' }));

// Render input form
app.get('/', (req, res) => {
  res.render('index');
});

// === Merge Spread Endpoint ===
app.post('/merge-spread', async (req, res) => {
  try {
    const base64Data = req.body.pdfBase64;
    if (!base64Data) {
      return res.status(400).json({ error: 'No PDF data provided.' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const originalPdf = await PDFDocument.load(buffer);
    const newPdf = await PDFDocument.create();

const imgWidth = 575.525;
const imgHeight = 575.525;

const mm = 2.835;
const borderThickness = 1 * mm;
const gapFromBorder = 3 * mm;

// First compute total margin (both border and inner gap)
const outerMargin = borderThickness + gapFromBorder;

// Final dimensions of the full page
const finalWidth = imgWidth * 2 + outerMargin * 2;
const finalHeight = imgHeight + outerMargin * 2;

// Margins for centering content
const marginx = (finalWidth - imgWidth * 2) / 2;
const marginy = (finalHeight - imgHeight) / 2;


    // === Define custom page pairings ===
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

    // === Copy only needed pages ===
    const uniquePages = [...new Set(pagePairs.flat().filter(p => p !== 'blank'))];
    const copiedPages = await newPdf.copyPages(originalPdf, uniquePages);
    const pageMap = {};
    uniquePages.forEach((pageNum, index) => {
      pageMap[pageNum] = copiedPages[index];
    });

    // === Create spreads ===
    for (const [leftIdx, rightIdx] of pagePairs) {
      const page = newPdf.addPage([finalWidth, finalHeight]);

      // === Draw border around full page ===
      page.drawRectangle({
        x: borderThickness / 2,
        y: borderThickness / 2,
        width: finalWidth - borderThickness,
        height: finalHeight - borderThickness,
        borderColor: rgb(0, 0, 0),
        borderWidth: borderThickness,
      });

      // === Draw left image ===
      if (leftIdx !== 'blank' && pageMap[leftIdx]) {
        const [embeddedLeft] = await newPdf.embedPages([pageMap[leftIdx]]);
        page.drawPage(embeddedLeft, {
          x: marginx,
          y: marginy,
          width: imgWidth,
          height: imgHeight,
        });
      }

      // === Draw right image ===
      if (rightIdx !== 'blank' && pageMap[rightIdx]) {
        const [embeddedRight] = await newPdf.embedPages([pageMap[rightIdx]]);
        page.drawPage(embeddedRight, {
          x: marginx + imgWidth,
          y: marginy,
          width: imgWidth,
          height: imgHeight,
        });
      }
    }

    // === Send final PDF ===
    const finalPdfBytes = await newPdf.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=merged_spread_with_border.pdf',
    });
    res.send(Buffer.from(finalPdfBytes));

  } catch (err) {
    console.error('Error generating merged spread:', err);
    res.status(500).json({
      error: "Please verify your PDF page numbers or try again due to a technical issue."
    });
  }
});

// === Start server ===
app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});
