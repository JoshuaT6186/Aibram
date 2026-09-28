/**
 * functions/index.js
 *
 * Anthropic proxy for Aibram.
 *
 * Why this exists: your Anthropic key can never live inside the React
 * Native bundle — a shipped app (and definitely an open-source Shipaton
 * submission) is decompilable, so anyone could pull the key out and run
 * up your bill. This function holds the real key server-side. The app
 * calls this endpoint with the signed-in user's Firebase ID token; this
 * function verifies that token, then makes the real Anthropic call.
 *
 * ── One-time setup ──
 * 1. cd into your project root (where firebase.json lives, or run
 *    `firebase init functions` first if you don't have a functions/
 *    folder yet — choose JavaScript, and when it asks to overwrite
 *    files, keep this index.js).
 * 2. npm install firebase-admin firebase-functions
 * 3. Store your real key as a secret (never in code, never in .env
 *    committed to git):
 *      firebase functions:secrets:set ANTHROPIC_API_KEY
 *    (paste your key from console.anthropic.com when prompted)
 * 4. Deploy:
 *      firebase deploy --only functions:callAibram
 * 5. Firebase will print a URL like:
 *      https://callaibram-xxxxxxxxxx-uc.a.run.app
 *    Paste that into AIBRAM_FUNCTION_URL near the top of App.js.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const TAVILY_API_KEY = defineSecret('TAVILY_API_KEY');
const GOOGLE_MAPS_API_KEY = defineSecret('GOOGLE_MAPS_API_KEY');

exports.callAibram = onRequest(
  // maxRequestSize raised so Document Intelligence base64 payloads (PDFs/images
  // up to ~8MB client-side) fit; memory raised to handle them comfortably.
  { secrets: [ANTHROPIC_API_KEY], cors: true, memory: '512MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST' });
      return;
    }

    // ── Verify the caller is actually a signed-in Aibram user ──
    // Without this, anyone who finds the URL could spend your Anthropic
    // quota. The client attaches the Firebase ID token as a Bearer token.
    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const { system, messages, tools } = req.body || {};
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: 'Body must include a messages array' });
      return;
    }

    // Each message's content may be a plain string OR an array of content
    // blocks (text / image / document) — Document Intelligence sends the
    // latter. Both shapes are valid for Anthropic's API; forward as-is.
    // `tools` is optional — only the main Aibram chat sends it, enabling
    // Claude to propose real actions (add_task, add_event, add_node).

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY.value(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000, // room for detailed aibram-steps blocks without truncation
          system: system || undefined,
          messages,
          ...(Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic API error:', response.status, errText);
        res.status(502).json({ error: 'Anthropic API error', detail: errText });
        return;
      }

      const data = await response.json();
      // Return the full content block array (text + tool_use blocks) so the
      // client can detect proposed actions, plus a flattened `text` field
      // for callers that only want the plain reply (Morning Brief, etc).
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      res.status(200).json({ text, content: data.content || [] });
    } catch (e) {
      console.error('callAibram failed:', e);
      res.status(500).json({ error: 'Server error calling Anthropic' });
    }
  }
);

/**
 * getMorningNews — Tavily-backed news for the Morning Brief.
 *
 * Same reasoning as callAibram: the Tavily key lives here, never in the
 * app. Client sends a short topic/location string; this searches Tavily
 * and returns a few concise, titled results for the "Your World" card.
 *
 * Setup:
 *   firebase functions:secrets:set TAVILY_API_KEY
 *   firebase deploy --only functions:getMorningNews
 * Paste the printed URL into AIBRAM_NEWS_URL near the top of App.js.
 */
exports.getMorningNews = onRequest(
  { secrets: [TAVILY_API_KEY], cors: true, memory: '256MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST' });
      return;
    }

    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const { query } = req.body || {};
    const q = (query && String(query).trim()) || 'top news today';

    // Scraped content often carries markdown fragments (##, links, images).
    // Strip them so the client renders clean sentences, not raw markup.
    const cleanSnippet = (text) => String(text || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')       // markdown images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // markdown links -> label
      .replace(/^#{1,6}\s.*$/gm, '')               // heading lines
      .replace(/[#*_`>|]/g, '')                     // leftover markup chars
      .replace(/\s+/g, ' ')
      .trim();

    // Truncate on a whole word, never mid-word ("diversifie...") — cut at
    // the last space before the limit, or return as-is if already short.
    const truncateAtWord = (text, limit) => {
      if (text.length <= limit) return text;
      const cut = text.slice(0, limit);
      const lastSpace = cut.lastIndexOf(' ');
      return (lastSpace > limit * 0.5 ? cut.slice(0, lastSpace) : cut).trim() + '…';
    };

    // Homepage/nav scrapes read as real English but aren't articles — they're
    // usually short on punctuation (no real sentences) or contain telltale
    // site-chrome phrases. Both are cheap, reliable signals a snippet is junk.
    const NAV_JUNK_PATTERNS = /skip to content|skip navigation|all channels|local events|watch live|sign in|subscribe now|privacy policy|terms of service/i;
    const looksLikeRealProse = (text) => {
      if (NAV_JUNK_PATTERNS.test(text)) return false;
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length < 12) return false; // too short to be an actual sentence or two
      const periods = (text.match(/[.!?]/g) || []).length;
      return periods >= 1; // real prose has at least one sentence boundary
    };

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY.value(),
          query: q,
          topic: 'news',            // recent articles only, not evergreen pages
          search_depth: 'advanced', // real article content, not homepage/nav junk
          days: 3,                  // genuinely recent, not stale evergreen pages
          max_results: 8,           // pad the pool since junk results get filtered below
          include_answer: false,
          include_images: true,     // source-linked article images per result
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Tavily API error:', response.status, errText);
        res.status(502).json({ error: 'Tavily API error', detail: errText });
        return;
      }

      const data = await response.json();
      // Trim to just what the client needs — title, clean snippet, url, image.
      // Per-result images (newer Tavily shape) preferred; fall back to the
      // top-level images array by index for older response shapes.
      const topImages = Array.isArray(data.images) ? data.images : [];
      const results = (data.results || [])
        .map((r, i) => {
          let image = null;
          if (Array.isArray(r.images) && r.images.length > 0) {
            image = typeof r.images[0] === 'string' ? r.images[0] : (r.images[0].url || null);
          } else if (topImages[i]) {
            image = typeof topImages[i] === 'string' ? topImages[i] : (topImages[i].url || null);
          }
          const cleanContent = cleanSnippet(r.content);
          return {
            title: truncateAtWord(cleanSnippet(r.title), 110),
            snippet: truncateAtWord(cleanContent, 260),
            url: r.url || '',
            image,
            _rawContent: cleanContent, // quality signal, stripped before response
          };
        })
        // Drop nav-menu/homepage junk — real article content reads like
        // actual sentences, not concatenated menu labels.
        .filter(r => r.title && looksLikeRealProse(r._rawContent))
        .slice(0, 4)
        .map(({ _rawContent, ...r }) => r);
      res.status(200).json({ results });
    } catch (e) {
      console.error('getMorningNews failed:', e);
      res.status(500).json({ error: 'Server error calling Tavily' });
    }
  }
);

/**
 * getETA — real, traffic-aware drive time via Google's Distance Matrix API.
 *
 * Setup:
 *   firebase functions:secrets:set GOOGLE_MAPS_API_KEY
 *   firebase deploy --only functions:getETA
 * Paste the printed URL into AIBRAM_ETA_URL near the top of App.js.
 *
 * Kept server-side for the same reason as the other keys: a Maps key with
 * Directions/Distance Matrix enabled is billable, and this app has no need
 * for an interactive map (no MapView), so there's no reason the key should
 * ever ship inside the client bundle.
 *
 * Accepts free-text origin/destination (e.g. "Austin, TX" or "Chili's on
 * Parmer Ln") — Google geocodes both ends itself, so this works whether the
 * destination came from a saved place or is just an event's title.
 */
exports.getETA = onRequest(
  { secrets: [GOOGLE_MAPS_API_KEY], cors: true, memory: '256MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST' });
      return;
    }

    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const { origin, destination } = req.body || {};
    if (!origin || !destination) {
      res.status(400).json({ error: 'origin and destination are both required' });
      return;
    }

    try {
      const params = new URLSearchParams({
        origins: String(origin),
        destinations: String(destination),
        departure_time: 'now', // real-time traffic, not a static estimate
        mode: 'driving',
        key: GOOGLE_MAPS_API_KEY.value(),
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`);
      if (!response.ok) {
        res.status(502).json({ ok: false, error: `Maps API responded ${response.status}` });
        return;
      }
      const data = await response.json();
      const element = data.rows?.[0]?.elements?.[0];
      if (!element || element.status !== 'OK') {
        // Common and not really an error — e.g. the event title isn't a
        // real geocodable place ("Study session"). Let the client fall
        // back to no chip rather than a broken one.
        res.status(200).json({ ok: false, reason: element?.status || data.status || 'unknown' });
        return;
      }
      const durationSeconds = (element.duration_in_traffic || element.duration).value;
      res.status(200).json({
        ok: true,
        durationMin: Math.round(durationSeconds / 60),
        distanceText: element.distance?.text || '',
        resolvedDestination: data.destination_addresses?.[0] || String(destination),
      });
    } catch (e) {
      console.error('getETA failed:', e);
      res.status(500).json({ ok: false, error: 'Server error calling Google Maps' });
    }
  }
);

/**
 * getPlaceAutocomplete — real place suggestions via Google's Places
 * Autocomplete API, so users pick a verified address instead of typing
 * free text that may or may not geocode correctly later in getETA.
 *
 * Reuses the SAME GOOGLE_MAPS_API_KEY secret as getETA — Places
 * Autocomplete and Distance Matrix are both part of Google Maps Platform,
 * billed under the same project. No new secret to create.
 *
 * ── One-time setup ──
 * 1. In Google Cloud Console (the same project your GOOGLE_MAPS_API_KEY
 *    already belongs to): APIs & Services → Library → search "Places API"
 *    → Enable. If your key has API restrictions turned on, also add
 *    "Places API" to that key's allowed APIs list, or requests will be
 *    rejected even though the secret is already configured.
 * 2. Deploy:
 *      firebase deploy --only functions:getPlaceAutocomplete
 * 3. Firebase will print a URL like:
 *      https://getplaceautocomplete-xxxxxxxxxx-uc.a.run.app
 *    Paste that into AIBRAM_PLACES_URL near the top of App.js.
 *
 * Accepts a partial text query and returns up to 5 real place
 * predictions (description + place_id). The client debounces keystrokes
 * before calling this — see LocationAutocomplete in App.js — so this
 * isn't hit on every character typed.
 *
 * sessionToken (optional): pass the same token for every keystroke of one
 * autocomplete "search episode," then drop it after a selection is made.
 * Google bills a full Places Details-style session as one unit instead of
 * per-keystroke when a session token is used consistently — worth adding
 * later as a cost optimization, but omitted here to keep this build simple
 * for now. Safe to add without changing the response shape.
 */
exports.getPlaceAutocomplete = onRequest(
  { secrets: [GOOGLE_MAPS_API_KEY], cors: true, memory: '256MiB' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST' });
      return;
    }

    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const { input, sessionToken } = req.body || {};
    const query = (input && String(input).trim()) || '';
    if (query.length < 2) {
      // Too short to be a meaningful query — return empty rather than
      // burning a billable request on "c" or "ch".
      res.status(200).json({ predictions: [] });
      return;
    }

    try {
      const params = new URLSearchParams({
        input: query,
        key: GOOGLE_MAPS_API_KEY.value(),
      });
      if (sessionToken) params.set('sessiontoken', String(sessionToken));
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
      if (!response.ok) {
        res.status(502).json({ error: `Places API responded ${response.status}` });
        return;
      }
      const data = await response.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Places Autocomplete error:', data.status, data.error_message);
        res.status(200).json({ predictions: [], reason: data.status });
        return;
      }
      const predictions = (data.predictions || []).slice(0, 5).map(p => ({
        description: p.description,
        placeId: p.place_id,
      }));
      res.status(200).json({ predictions });
    } catch (e) {
      console.error('getPlaceAutocomplete failed:', e);
      res.status(500).json({ error: 'Server error calling Google Places' });
    }
  }
);