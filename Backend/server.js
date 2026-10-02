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
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

app.get('/', (req, res) => {
  res.send('ToolBox Pro Backend is running');
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

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
    if (typeof v !== 'string' || !v.trim() || v.length > 300) {
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

Include:
1. Overview
2. Important definitions
3. Key concepts
4. Detailed explanation
5. Important exam points
6. Examples where relevant
7. Important questions with short answers
8. Long-answer questions
9. Quick revision points

Make the notes clear, structured and useful for students.
Do not claim that the notes are officially issued by the university.
If exact syllabus details are uncertain, clearly state that the material is general study material.
`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        temperature: 0.4,
        max_tokens: 12000
      })
    });

    const data = await r.json();

    if (!r.ok) {
      console.error('Groq error:', data);
      return res.status(502).json({
        error: 'AI provider request failed.'
      });
    }

    const notes = data?.choices?.[0]?.message?.content || '';

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
  } catch (err) {
    console.error('PDF error:', err);

    res.status(500).json({
      error: 'PDF generation failed.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`ToolBox Pro backend listening on ${PORT}`);
});
