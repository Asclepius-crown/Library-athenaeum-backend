import express from 'express';
import fetch from 'node-fetch'; // or global fetch with Node 18+

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

router.post('/', async (req, res) => {
  // Read parameters from query string as per your original code (no frontend changes)
  const { q, category, maxResults } = req.body;

  if (!q) {
    return res.status(400).json({ message: "Missing 'q' (search) query parameter." });
  }

  // Encode the search term
  let query = encodeURIComponent(q);

  // Append subject (category) if provided and not "All"
  if (category && category !== 'All') {
    query += `+subject:${encodeURIComponent(category)}`;
  }

  // Use maxResults param or default to 20
  const max = maxResults ? `&maxResults=${maxResults}` : "&maxResults=20";

  // Construct the Google Books API URL
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&key=${GOOGLE_API_KEY}${max}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Google Books API error: ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    res.json(data);
  } catch (error) {
    console.error('Google Books API fetch error:', error);
    res.status(500).json({ message: error.message || 'Error fetching from Google Books' });
  }
});

export default router;
