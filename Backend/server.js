const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const PDFDocument = require('pdfkit');

const app = express();

app.set('trust proxy', 1);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '32kb' }));

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
const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

app.get('/', (req, res) => {
  res.send('ToolBox Pro Backend is running');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});


/* =========================
   AI STUDY NOTES
========================= */

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

  for (const [k, v] of Object.entries({
    course,
    year,
    university,
    subject,
    topic,
    language,
    notesType
  })) {
    if (
      typeof v !== 'string' ||
      !v.trim() ||
      v.length > 300
    ) {
      return res.status(400).json({
        error: `Invalid ${k}.`
      });
    }
  }

  const prompt = `
Create accurate, exam-oriented study notes in ${language}.

Course: ${course}
Year/Semester: ${year}
University: ${university}
Subject: ${subject}
Topic: ${topic}
Notes Type: ${notesType}

Use this exact structure:

# ${topic}

## 1. Overview
Give a clear introduction.

## 2. Important Definitions
Give important exam-friendly definitions.

## 3. Key Concepts
Explain the main concepts clearly.

## 4. Detailed Explanation
Explain the topic in an organized way.

## 5. Important Exam Points
Give points students should remember.

## 6. Examples
Give relevant examples where useful.

## 7. Important Questions with Short Answers
Give important exam questions with concise answers.

## 8. Long Answer Questions
Give important long-answer questions and answer guidance.

## 9. Quick Revision
Give a short revision checklist.

## 10. Exam Tip
Give one useful exam-oriented tip.

Do not claim that the notes are officially issued by the university.
If exact syllabus details are uncertain, clearly state that the material is general study material.
`;

  try {
    const r = await fetch(
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
                'You are an educational study-notes assistant. Give accurate, well-structured and exam-oriented notes.'
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

    const data = await r.json();

    if (!r.ok) {
      console.error('Groq error:', data);

      return res.status(502).json({
        error: 'AI provider request failed.'
      });
    }

    const notes =
      data?.choices?.[0]?.message?.content || '';

    if (!notes) {
      return res.status(502).json({
        error: 'AI returned no notes.'
      });
    }

    res.json({ notes });

  } catch (err) {
    console.error('Groq request error:', err);

    res.status(502).json({
      error: 'Unable to reach AI provider.'
    });
  }
});


/* =========================
   SAFE PDF TEXT
========================= */

function cleanPdfText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

    // Currency
    .replace(/₹/g, 'Rs. ')

    // Smart punctuation
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')

    // Bullets / special symbols
    .replace(/•/g, '-')
    .replace(/✓/g, '[OK]')
    .replace(/☑/g, '[OK]')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')

    // Remove problematic invisible characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}


/* =========================
   PDF HELPERS
========================= */

function addPageNumber(doc) {
  const range = doc.bufferedPageRange();
  const pageCount = range.count;

  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#777')
      .text(
        `ToolBox Pro  •  Page ${i + 1} of ${pageCount}`,
        50,
        800,
        {
          width: 495,
          align: 'center'
        }
      );
  }
}


/* =========================
   PDF GENERATION
========================= */

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
      v => typeof v !== 'string' || !v.trim()
    )
  ) {
    return res.status(400).json({
      error: 'Invalid PDF data.'
    });
  }

  if (notes.length > 50000) {
    return res.status(400).json({
      error: 'Notes are too large.'
    });
  }

  try {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
      info: {
        Title: title,
        Author: 'ToolBox Pro',
        Subject: 'AI Study Notes'
      }
    });

    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

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

    /* ---------- HEADER ---------- */

    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(cleanPdfText(title), {
        align: 'center',
        width: 495
      });

    doc.moveDown(0.7);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555')
      .text(
        cleanPdfText(
          `${course} | ${year} | ${university} | ${language}`
        ),
        {
          align: 'center',
          width: 495
        }
      );

    doc.moveDown(1);

    /* ---------- INFO BOX ---------- */

    const boxTop = doc.y;

    doc
      .roundedRect(50, boxTop, 495, 58, 8)
      .fill('#f3f4f6');

    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Study Material', 65, boxTop + 12);

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#555')
      .text(
        'AI-generated general study material. Verify syllabus-specific requirements with your university/course outline.',
        65,
        boxTop + 28,
        {
          width: 465,
          lineGap: 2
        }
      );

    doc.y = boxTop + 78;

    /* ---------- NOTES ---------- */

    const cleanNotes = cleanPdfText(notes);

    const lines = cleanNotes.split('\n');

    for (let rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        doc.moveDown(0.45);
        continue;
      }

      /* H1 */
      if (line.startsWith('# ')) {
        const text = line.replace(/^#\s+/, '');

        doc
          .moveDown(0.7)
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .fontSize(18)
          .text(text, {
            width: 495,
            lineGap: 4
          });

        doc.moveDown(0.25);
        continue;
      }

      /* H2 */
      if (line.startsWith('## ')) {
        const text = line.replace(/^##\s+/, '');

        doc
          .moveDown(0.55)
          .fillColor('#1f2937')
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(text, {
            width: 495,
            lineGap: 3
          });

        doc.moveDown(0.15);
        continue;
      }

      /* H3 */
      if (line.startsWith('### ')) {
        const text = line.replace(/^###\s+/, '');

        doc
          .moveDown(0.4)
          .fillColor('#374151')
          .font('Helvetica-Bold')
          .fontSize(11.5)
          .text(text, {
            width: 495,
            lineGap: 3
          });

        continue;
      }

      /* Numbered list */
      if (/^\d+\.\s+/.test(line)) {
        doc
          .fillColor('#111827')
          .font('Helvetica')
          .fontSize(10.5)
          .text(line, {
            width: 495,
            lineGap: 4,
            paragraphGap: 3
          });

        continue;
      }

      /* Bullet */
      if (/^[-*]\s+/.test(line)) {
        const text = line.replace(/^[-*]\s+/, '');

        doc
          .fillColor('#111827')
          .font('Helvetica')
          .fontSize(10.5)
          .text(`- ${text}`, {
            width: 495,
            lineGap: 4,
            paragraphGap: 2
          });

        continue;
      }

      /* Normal paragraph */
      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(10.5)
        .text(line, {
          width: 495,
          lineGap: 4,
          paragraphGap: 4
        });
    }

    /* ---------- FOOTER ---------- */

    doc.moveDown(1);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text('ToolBox Pro', {
        align: 'center',
        width: 495
      });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#777')
      .text('Created by Soham', {
        align: 'center',
        width: 495
      });

    /* ---------- PAGE NUMBERS ---------- */

    addPageNumber(doc);

    doc.end();

  } catch (err) {
    console.error('PDF error:', err);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'PDF generation failed.'
      });
    }
  }
});


/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `ToolBox Pro backend listening on ${PORT}`
  );
});
