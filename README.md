# ToolBox Pro — 65 Tools

A premium, responsive toolbox with 65 useful tools. Most tools run fully in the browser. AI Study Notes uses the optional Render/Node backend.

## GitHub Pages frontend
Upload the contents of `ToolBox-Pro/` to the repository root. GitHub Pages can serve `index.html`, `style.css`, `app.js` and `assets/` normally.

## AI Notes backend
The AI Notes feature must NOT contain a secret API key in frontend code.

Deploy `backend/` as a Node web service on Render:
- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `GEMINI_API_KEY` = your own Gemini API key
- Optional: `GEMINI_MODEL=gemini-2.5-flash`

After deployment, set the frontend backend URL in the browser once:
```js
localStorage.setItem('tbp:api','https://YOUR-RENDER-SERVICE.onrender.com')
```

The backend validates input and rate-limits requests. It does not permanently store generated notes or PDFs.

## Security
Never commit a real API key to GitHub and never paste it into `index.html`, `app.js`, or this README.

## Ads
The project keeps the existing AdSense publisher `ca-pub-3776846934936900` and slot `8855628320`. Two ad placements are present inside each opened tool dialog, plus the existing site-level placements. Ad behavior remains controlled by Google; the UI does not encourage ad clicks.


## AI Study Notes setup
1. Deploy `backend/` to Render as a Node web service.
2. Add `GEMINI_API_KEY` in Render Environment Variables. Never put the key in frontend code.
3. Optionally set `GEMINI_MODEL` (default: `gemini-2.5-flash`).
4. In `app.js`, replace `DEFAULT_API_BASE` with your Render backend URL.
5. AI notes are generated through the backend. PDF files are created in memory and returned immediately; no PDF is saved on the server.
