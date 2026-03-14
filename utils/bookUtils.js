import Book from "../models/Book.js";

/**
 * FIELD MAPPING for file import
 */
export const FIELD_MAP = {
  title: ["title", "Title"],
  author: ["author", "Author"],
  genre: ["genre", "Genre"],
  publishedCount: ["publishedcount", "published_count", "Publication_Count", "publishedCount"],
  status: ["status", "Status"],
  height: ["height", "Height"],
  publisher: ["publisher", "Publisher"],
  location: ["location", "Location", "Library_Location"],
  description: ["description", "Description", "summary"],
  imageUrl: ["imageUrl", "image", "Cover", "cover_url"],
};

export function normalizeRow(row) {
  const mapped = {};
  for (const [key, variants] of Object.entries(FIELD_MAP)) {
    let found;
    for (const v of variants) {
      for (const k of Object.keys(row)) {
        if (
          k.replace(/[^a-z0-9]/gi, "").toLowerCase() ===
          v.replace(/[^a-z0-9]/gi, "").toLowerCase()
        ) {
          found = k;
        }
      }
    }
    if (found !== undefined) mapped[key] = row[found];
  }
  return mapped;
}

/**
 * Validation + duplicate prevention + bulk insert
 */
export async function validateAndInsertBooks(books, res) {
  const allowedStatuses = ["Available", "Borrowed"];
  const validBooks = [];
  const invalidBooks = [];

  books.forEach((book, index) => {
    const b = {
      title: book.title?.toString().trim() ?? "",
      author: book.author?.toString().trim() ?? "",
      genre: book.genre?.toString().trim() ?? "",
      publishedCount: Number(book.publishedCount ?? 0),
      status: (book.status || "Available").toString().trim(),
      height: book.height ? `${book.height}` : "",
      publisher: book.publisher?.toString().trim() ?? "",
      location: book.location?.toString().trim() ?? "",
      description: book.description?.toString().trim() ?? "",
      imageUrl: book.imageUrl?.toString().trim() ?? "",
    };

    if (
      !b.title ||
      !b.author ||
      isNaN(b.publishedCount) ||
      b.publishedCount < 0 ||
      (b.status && !allowedStatuses.includes(b.status))
    ) {
      invalidBooks.push({ row: index + 2, ...b });
    } else {
      validBooks.push(b);
    }
  });

  console.log(`Parsed ${books.length} rows: ${validBooks.length} valid, ${invalidBooks.length} invalid`);

  if (validBooks.length === 0) {
    return res.status(400).json({
      message: "No valid book entries to insert.",
      invalidCount: invalidBooks.length,
      invalidBooks,
    });
  }

  // Check existing
  const existingBooks = await Book.find({
    $or: validBooks.map((b) => ({ title: b.title, author: b.author })),
  }).select("title author");

  const existingSet = new Set(
    existingBooks.map((b) => `${b.title.toLowerCase()}-${b.author.toLowerCase()}`)
  );

  const newBooks = validBooks.filter(
    (b) => !existingSet.has(`${b.title.toLowerCase()}-${b.author.toLowerCase()}`)
  );

  if (newBooks.length === 0) {
    return res.status(400).json({
      message: "All submitted books already exist.",
      duplicateCount: validBooks.length,
      invalidBooks,
    });
  }

  const inserted = await Book.insertMany(newBooks, { ordered: false });

  console.log(`Inserted ${inserted.length} new books`);

  // Return only selected fields + _id
  const formattedInserted = inserted.map((doc) => ({
    _id: doc._id,
    title: doc.title,
    author: doc.author,
    genre: doc.genre,
    status: doc.status,
    location: doc.location,
    publisher: doc.publisher,
    height: doc.height,
    publishedCount: doc.publishedCount,
    description: doc.description,
    imageUrl: doc.imageUrl
  }));

  return res.status(201).json({
    message: "Bulk insert completed",
    totalSubmitted: books.length,
    insertedCount: inserted.length,
    duplicateCount: validBooks.length - newBooks.length,
    invalidCount: invalidBooks.length,
    invalidBooks,
    insertedBooks: formattedInserted
  });
}
