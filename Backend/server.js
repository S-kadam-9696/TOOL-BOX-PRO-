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
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.get('/', (req, res) => {
  res.send('ToolBox Pro Backend is running');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/generate-notes', async (req, res) => {
  if (!KEY) {
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
    if (typeof v !== 'string' || !v.trim() || v.length > 300) {
      return res.status(400).json({
        error: `Invalid ${k}.`
      });
    }
  }

  const prompt = `Create accurate exam-oriented study notes in ${language}. Course: ${course}. Year/Semester: ${year}. University: ${university}. Subject: ${subject}. Topic: ${topic}. Type: ${notesType}. Include overview, definitions, key concepts, explanation, important exam points, examples where relevant, important questions with short answers, and quick revision. Do not claim the notes are officially issued by the university. If syllabus details are uncertain, state that they are general study material.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        MODEL
      )}:generateContent?key=${encodeURIComponent(KEY)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await r.json();

    if (!r.ok) {
      return res.status(502).json({
        error: 'AI provider request failed.'
      });
    }

    const notes =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || '')
        .join('') || '';

    if (!notes) {
      return res.status(502).json({
        error: 'AI returned no notes.'
      });
    }

    res.json({ notes });
  } catch {
    res.status(502).json({
      error: 'Unable to reach AI provider.'
    });
  }
});

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
    ) ||
    notes.length > 50000
  ) {
    return res.status(400).json({
      error: 'Invalid PDF data.'
    });
  }

  try {
    const doc = new PDFDocument({
      margin: 48,
      size: 'A4'
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

    doc
      .fontSize(20)
      .text(title, { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor('#555')
      .text(
        `${course} • ${year} • ${university} • ${language}`,
        { align: 'center' }
      )
      .moveDown();

    doc
      .fillColor('#111')
      .fontSize(11)
      .text(notes, { lineGap: 3 });

    doc.end();
  } catch {
    res.status(500).json({
      error: 'PDF generation failed.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`ToolBox Pro backend listening on ${PORT}`);
});
