const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();

app.set('trust proxy', 1);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '64kb' }));

app.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

/* -------------------------------------------------------
   FONT
------------------------------------------------------- */

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf'
];

const BOLD_FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
];

const FONT =
  FONT_CANDIDATES.find(fs.existsSync) || null;

const BOLD_FONT =
  BOLD_FONT_CANDIDATES.find(fs.existsSync) || FONT;

if (!FONT) {
  console.warn('Unicode font not found. PDF may have limited character support.');
}

/* -------------------------------------------------------
   BASIC ROUTES
------------------------------------------------------- */

app.get('/', (req, res) => {
  res.send('ToolBox Pro Backend is running');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

/* -------------------------------------------------------
   AI STUDY NOTES
------------------------------------------------------- */

app.post('/api/generate-notes', async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({
      error: 'AI service is not configured.'
    });
  }

  const {
    course,
    year,
    university,
    subject,
    topic,
    language,
    notesType
  } = req.body || {};

  for (const [key, value] of Object.entries({
    course,
    year,
    university,
    subject,
    topic,
    language,
    notesType
  })) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > 300
    ) {
      return res.status(400).json({
        error: `Invalid ${key}.`
      });
    }
  }

  const prompt = `
Create high-quality, accurate, exam-oriented study notes.

Student details:
Course: ${course}
Year / Semester: ${year}
University: ${university}
Subject: ${subject}
Topic: ${topic}
Language: ${language}
Notes Type: ${notesType}

IMPORTANT:
- Make the notes detailed but easy to study.
- Use clear headings and subheadings.
- Use simple student-friendly language.
- Do not invent official university material.
- If exact syllabus information is uncertain, clearly say it is general study material.
- Keep terminology academically appropriate.

Use this structure:

# ${topic}

## 1. Overview
Give a clear introduction.

## 2. Important Definitions
Give important definitions in simple exam-friendly language.

## 3. Key Concepts
Explain the main concepts point-by-point.

## 4. Detailed Explanation
Explain the topic properly with examples wherever useful.

## 5. Important Exam Points
List high-value points students should remember.

## 6. Examples
Give practical or numerical examples where relevant.

## 7. Important Questions with Short Answers
Give around 8-10 likely questions with concise answers.

## 8. Long Answer Questions
Give around 5 important long-answer questions and points that should be covered.

## 9. Quick Revision
Give a compact revision checklist.

## 10. Exam Tip
Give a useful final exam-oriented tip.

Return only the study notes.
`;

  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert educational study-notes assistant. Produce accurate, structured, exam-oriented notes.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.35,
          max_tokens: 12000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API error:', data);

      return res.status(502).json({
        error: 'AI provider request failed.'
      });
    }

    const notes =
      data?.choices?.[0]?.message?.content?.trim() || '';

    if (!notes) {
      return res.status(502).json({
        error: 'AI returned no notes.'
      });
    }

    res.json({ notes });
  } catch (error) {
    console.error('Groq request error:', error);

    res.status(502).json({
      error: 'Unable to reach AI provider.'
    });
  }
});

/* -------------------------------------------------------
   PREMIUM PDF HELPERS
------------------------------------------------------- */

function cleanText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^\s*>\s?/, '')
    .trim();
}

function drawPageNumber(doc) {
  const page = doc.page;
  const text = `Page ${page}`;

  doc
    .save()
    .font(FONT || 'Helvetica')
    .fontSize(8)
    .fillColor('#777777')
    .text(
      text,
      48,
      doc.page.height - 30,
      {
        width: doc.page.width - 96,
        align: 'center'
      }
    )
    .restore();
}

function setupFonts(doc) {
  if (FONT) {
    doc.registerFont('TBP-Regular', FONT);
  }

  if (BOLD_FONT) {
    doc.registerFont('TBP-Bold', BOLD_FONT);
  }

  doc.font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica');
}

function drawHeader(doc, title) {
  doc
    .save()
    .roundedRect(42, 36, doc.page.width - 84, 72, 12)
    .fill('#111827');

  doc
    .fillColor('#ffffff')
    .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
    .fontSize(21)
    .text(title, 60, 55, {
      width: doc.page.width - 120,
      align: 'center'
    });

  doc.restore();

  doc.moveDown(1.5);
}

function drawInfoBox(doc, course, year, university, language) {
  const y = doc.y;

  doc
    .save()
    .roundedRect(48, y, doc.page.width - 96, 70, 10)
    .fill('#f3f4f6');

  doc
    .fillColor('#374151')
    .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
    .fontSize(9)
    .text('COURSE', 64, y + 13);

  doc
    .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
    .fontSize(9)
    .text('YEAR / SEMESTER', 205, y + 13);

  doc
    .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
    .fontSize(9)
    .text('LANGUAGE', 390, y + 13);

  doc
    .fillColor('#111827')
    .font(FONT ? 'TBP-Regular' : 'Helvetica')
    .fontSize(10)
    .text(course, 64, y + 29, { width: 125 });

  doc
    .text(year, 205, y + 29, { width: 160 });

  doc
    .text(language, 390, y + 29, { width: 100 });

  doc
    .fillColor('#6b7280')
    .fontSize(8)
    .text(university, 64, y + 50, {
      width: doc.page.width - 128
    });

  doc.restore();

  doc.y = y + 88;
}

function ensureSpace(doc, needed = 70) {
  if (doc.y > doc.page.height - needed) {
    doc.addPage();
  }
}

function renderNotes(doc, notes) {
  const lines = cleanText(notes).split('\n');

  for (let rawLine of lines) {
    let line = rawLine.trim();

    if (!line) {
      doc.moveDown(0.45);
      continue;
    }

    /* Main heading */
    if (/^#\s+/.test(line)) {
      ensureSpace(doc, 80);

      const heading = stripMarkdown(
        line.replace(/^#\s+/, '')
      );

      doc
        .fillColor('#111827')
        .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
        .fontSize(18)
        .text(heading, {
          paragraphGap: 8
        });

      doc
        .moveDown(0.15);

      continue;
    }

    /* Section heading */
    if (/^##\s+/.test(line)) {
      ensureSpace(doc, 65);

      const heading = stripMarkdown(
        line.replace(/^##\s+/, '')
      );

      doc
        .fillColor('#1f2937')
        .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
        .fontSize(14)
        .text(heading, {
          paragraphGap: 6
        });

      doc.moveDown(0.15);

      continue;
    }

    /* Subheading */
    if (/^###\s+/.test(line)) {
      ensureSpace(doc, 55);

      const heading = stripMarkdown(
        line.replace(/^###\s+/, '')
      );

      doc
        .fillColor('#374151')
        .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
        .fontSize(11.5)
        .text(heading);

      doc.moveDown(0.1);

      continue;
    }

    /* Bullet */
    if (/^[-*•]\s+/.test(line)) {
      ensureSpace(doc, 35);

      const bullet = stripMarkdown(
        line.replace(/^[-*•]\s+/, '')
      );

      const x = doc.x;

      doc
        .fillColor('#111827')
        .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
        .fontSize(9)
        .text('•', x, doc.y);

      doc
        .font(FONT ? 'TBP-Regular' : 'Helvetica')
        .fontSize(9.5)
        .fillColor('#374151')
        .text(bullet, x + 14, doc.y - 10, {
          width: doc.page.width - x - 70,
          lineGap: 3
        });

      doc.moveDown(0.15);

      continue;
    }

    /* Numbered list */
    if (/^\d+\.\s+/.test(line)) {
      ensureSpace(doc, 35);

      const match = line.match(/^(\d+)\.\s+(.*)$/);
      const number = match[1];
      const content = stripMarkdown(match[2]);

      const x = doc.x;

      doc
        .fillColor('#111827')
        .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
        .fontSize(9.5)
        .text(`${number}.`, x, doc.y);

      doc
        .font(FONT ? 'TBP-Regular' : 'Helvetica')
        .fontSize(9.5)
        .fillColor('#374151')
        .text(content, x + 20, doc.y - 11, {
          width: doc.page.width - x - 76,
          lineGap: 3
        });

      doc.moveDown(0.15);

      continue;
    }

    /* Markdown table separator */
    if (/^\|?[\s:-]+\|[\s|:-]*$/.test(line)) {
      continue;
    }

    /* Table row */
    if (line.includes('|')) {
      ensureSpace(doc, 35);

      const cells = line
        .split('|')
        .map(x => stripMarkdown(x))
        .filter(Boolean);

      const available = doc.page.width - 96;
      const colWidth = available / Math.max(cells.length, 1);

      const startX = 48;
      const startY = doc.y;

      doc
        .save()
        .fillColor('#f3f4f6')
        .rect(
          startX,
          startY - 2,
          available,
          22
        )
        .fill();

      cells.forEach((cell, index) => {
        doc
          .fillColor('#374151')
          .font(FONT ? 'TBP-Regular' : 'Helvetica')
          .fontSize(8)
          .text(
            cell,
            startX + index * colWidth + 5,
            startY + 4,
            {
              width: colWidth - 10,
              height: 30
            }
          );
      });

      doc.restore();

      doc.y = startY + 25;

      continue;
    }

    /* Normal paragraph */
    ensureSpace(doc, 40);

    const paragraph = stripMarkdown(line);

    doc
      .fillColor('#374151')
      .font(FONT ? 'TBP-Regular' : 'Helvetica')
      .fontSize(9.5)
      .text(paragraph, {
        width: doc.page.width - 96,
        lineGap: 4,
        paragraphGap: 6
      });
  }
}

/* -------------------------------------------------------
   PREMIUM NOTES PDF
------------------------------------------------------- */

app.post('/api/notes-pdf', async (req, res) => {
  const {
    title,
    course,
    year,
    university,
    language,
    notes
  } = req.body || {};

  if (
    [title, course, year, university, language, notes].some(
      value =>
        typeof value !== 'string' ||
        !value.trim()
    ) ||
    notes.length > 50000
  ) {
    return res.status(400).json({
      error: 'Invalid PDF data.'
    });
  }

  try {
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 48,
        bottom: 48,
        left: 48,
        right: 48
      },
      bufferPages: true,
      info: {
        Title: title,
        Author: 'ToolBox Pro',
        Subject: 'AI Study Notes',
        Creator: 'ToolBox Pro'
      }
    });

    const chunks = [];

    doc.on('data', chunk => {
      chunks.push(chunk);
    });

    doc.on('error', error => {
      console.error('PDF error:', error);
    });

    setupFonts(doc);

    /* Cover/header */
    drawHeader(doc, 'ToolBox Pro — Study Notes');

    doc
      .fillColor('#111827')
      .font(BOLD_FONT ? 'TBP-Bold' : 'Helvetica-Bold')
      .fontSize(17)
      .text(title, {
        align: 'center'
      });

    doc.moveDown(0.7);

    drawInfoBox(
      doc,
      course,
      year,
      university,
      language
    );

    doc
      .fillColor('#6b7280')
      .font(FONT ? 'TBP-Regular' : 'Helvetica')
      .fontSize(8.5)
      .text(
        'General study material generated with AI. Verify syllabus-specific requirements with your university/course outline.',
        {
          align: 'center',
          lineGap: 3
        }
      );

    doc.moveDown(1);

    /* Divider */
    doc
      .moveTo(48, doc.y)
      .lineTo(doc.page.width - 48, doc.y)
      .lineWidth(1)
      .strokeColor('#d1d5db')
      .stroke();

    doc.moveDown(0.8);

    renderNotes(doc, notes);

    /* Add page numbers */
    const range = doc.bufferedPageRange();

    for (
      let i = range.start;
      i < range.start + range.count;
      i++
    ) {
      doc.switchToPage(i);
      drawPageNumber(doc);
    }

    doc.end();

    doc.on('end', () => {
      const pdf = Buffer.concat(chunks);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': pdf.length,
        'Content-Disposition':
          'attachment; filename="toolbox-pro-study-notes.pdf"',
        'Cache-Control': 'no-store'
      });

      res.end(pdf);
    });
  } catch (error) {
    console.error('PDF generation failed:', error);

    res.status(500).json({
      error: 'PDF generation failed.'
    });
  }
});

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(
    `ToolBox Pro backend listening on ${PORT}`
  );
});
