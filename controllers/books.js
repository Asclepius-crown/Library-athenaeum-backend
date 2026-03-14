import Book from "../models/Book.js";
import BorrowedBook from "../models/BorrowedBook.js";
import Student from "../models/Student.js";
import { normalizeRow, validateAndInsertBooks } from "../utils/bookUtils.js";
import csvParser from "csv-parser";
import fs from "fs";
import XLSX from "xlsx";
import { Readable } from 'stream';

export const uploadBooks = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const ext = req.file.originalname.split(".").pop().toLowerCase();
    let books = [];

    if (ext === "csv") {
      const rows = await new Promise((resolve, reject) => {
        const arr = [];
        const stream = Readable.from(req.file.buffer);
        stream
          .pipe(csvParser())
          .on("data", (row) => {
            arr.push(normalizeRow(row));
          })
          .on("end", () => resolve(arr))
          .on("error", reject);
      });
      books = rows;
    } else if (ext === "xlsx" || ext === "xlsm") {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      books = sheetData.map(normalizeRow);
    } else {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    if (!books.length) {
      return res.status(400).json({ message: "No data found in file" });
    }

    await validateAndInsertBooks(books, res);
  } catch (error) {
    console.error("POST /books/upload error:", error);
    res.status(500).json({ message: "Failed to upload books", error: error.message });
  }
};

export const getBulkBooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const { search, genre, status, sort } = req.query;

    let matchQuery = {};

    if (genre && genre !== "All") {
      matchQuery.genre = genre;
    }

    if (status && status !== "All") {
      // For aggregated view, we filter by derived status
      // This will be handled in the $match stage below using availableCopies
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      matchQuery.$or = [
        { title: searchRegex },
        { author: searchRegex },
      ];
    }

    // Aggregation Pipeline
    const pipeline = [
      {
        $match: matchQuery // Initial filtering based on query params
      },
      {
        $group: {
          _id: {
            title: "$title",
            author: "$author",
            genre: "$genre",
            publisher: "$publisher",
            height: "$height",
            description: "$description",
            imageUrl: "$imageUrl",
            publishedCount: "$publishedCount",
            isbn: "$isbn",
            location: "$location",
            category: "$category",
            type: "$type",
          },
          totalCopies: { $sum: 1 },
          availableCopies: {
            $sum: {
              $cond: { if: { $eq: ["$status", "Available"] }, then: 1, else: 0 }
            }
          },
          // Collect IDs of individual copies for actions later if needed
          copyIds: { $push: "$_id" },
          isFeatured: { $max: "$isFeatured" } // Check if any copy is featured
        }
      },
      {
        $project: {
          _id: "$_id", // Keep the grouped _id as an object
          title: "$_id.title",
          author: "$_id.author",
          genre: "$_id.genre",
          publisher: "$_id.publisher",
          height: "$_id.height",
          description: "$_id.description",
          imageUrl: "$_id.imageUrl",
          publishedCount: "$_id.publishedCount",
          isbn: "$_id.isbn",
          location: "$_id.location",
          category: "$_id.category",
          type: "$_id.type",
          totalCopies: 1,
          availableCopies: 1,
          derivedStatus: {
            $cond: { if: { $gt: ["$availableCopies", 0] }, then: "Available", else: "Borrowed" }
          },
          copyIds: 1,
          isFeatured: 1
        }
      }
    ];

    // Apply status filtering AFTER aggregation
    if (status === "Available") {
      pipeline.push({ $match: { derivedStatus: "Available" } });
    } else if (status === "Borrowed") {
      pipeline.push({ $match: { derivedStatus: "Borrowed" } });
    }

    // Sorting
    let sortOptions = {};
    if (sort === "title_asc") {
      sortOptions = { title: 1 };
    } else if (sort === "title_desc") {
      sortOptions = { title: -1 };
    } else if (sort === "publishedCount_desc") {
      sortOptions = { publishedCount: -1 };
    } else {
      sortOptions = { title: 1 }; // Default sort
    }
    pipeline.push({ $sort: sortOptions });

    // Pagination
    const totalCountPipeline = [...pipeline]; // Clone pipeline for total count
    totalCountPipeline.push({ $count: "total" });

    const totalResults = await Book.aggregate(totalCountPipeline);
    const total = totalResults.length > 0 ? totalResults[0].total : 0;

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const items = await Book.aggregate(pipeline);

    res.json({
      books: items,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalBooks: total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const borrowBook = async (req, res) => {
  try {
    // This now refers to borrowing a SPECIFIC copy, not a book TYPE
    const bookIdToBorrow = req.params.id; // This 'id' is a specific copy's ID

    const book = await Book.findById(bookIdToBorrow);
    if (!book) return res.status(404).json({ message: "Book copy not found" });
    
    if (book.status !== 'Available') {
      return res.status(400).json({ message: "Book copy is currently unavailable" });
    }

    // Find student info (optional but good for records)
    const student = await Student.findOne({ email: req.user.email });
    
    // Create Borrow Record
    const borrowedRecord = new BorrowedBook({
      bookId: book._id, // This is the ID of the specific physical copy
      bookTitle: book.title,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentId: student ? student.rollNo : 'N/A', // Fallback if no student profile
      borrowDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 days
      returnStatus: 'Not Returned'
    });
    
    await borrowedRecord.save();

    // Update Book Copy Status
    book.status = 'Borrowed';
    book.borrower = req.user.email;
    book.dueDate = borrowedRecord.dueDate; // Set dueDate on the copy itself
    await book.save();

    res.json({ message: "Book borrowed successfully", book });

  } catch (error) {
    console.error("Borrow error:", error);
    res.status(500).json({ message: "Failed to borrow book" });
  }
};

export const createBook = async (req, res) => {
  try {
    // When creating a book, we are creating a new PHYSICAL COPY
    const newBook = new Book(req.body);
    await newBook.save();
    res.status(201).json(newBook); // Return the full new book object
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateBook = async (req, res) => {
  try {
    const updatedBook = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedBook) return res.status(404).json({ error: "Book copy not found" });
    res.json(updatedBook);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteBook = async (req, res) => {
  try {
    const deletedBook = await Book.findByIdAndDelete(req.params.id);
    if (!deletedBook) return res.status(404).json({ error: "Book copy not found" });
    res.json({ message: "Book copy deleted successfully", deletedBook });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const bulkCreateBooks = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "Request body must be a non-empty array of books" });
    }
    // Bulk create still adds individual book copies
    await validateAndInsertBooks(req.body, res);
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk insert books", error: error.message });
  }
};

export const bulkDeleteBooks = async (req, res) => {
  try {
    const { ids } = req.body; // These are IDs of individual book copies
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Please provide an array of book IDs to delete" });
    }
    await Book.deleteMany({ _id: { $in: ids } });
    res.json({ message: "Book copies deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New: Update metadata for all copies of a grouped book
export const updateGroupedBookMetadata = async (req, res) => {
  try {
    const groupedId = JSON.parse(decodeURIComponent(req.params.groupedId)); // Reconstruct the grouped _id object
    const { title, author, genre, publisher, height, description, imageUrl, publishedCount, isbn, location, category, type } = req.body;

    // Use the groupedId as a filter to update all matching book copies
    const filter = {
      title: groupedId.title,
      author: groupedId.author,
      // Add other relevant fields from groupedId to ensure uniqueness if needed
      // This assumes title and author are sufficient to identify the "book type"
    };

    const updateFields = {
      title, author, genre, publisher, height, description, imageUrl, publishedCount, isbn, location, category, type
    };

    await Book.updateMany(filter, { $set: updateFields });

    res.json({ message: "Grouped book metadata updated successfully" });
  } catch (error) {
    console.error("Error updating grouped book metadata:", error);
    res.status(500).json({ error: error.message });
  }
};

// New: Delete all copies of a grouped book
export const deleteGroupedBooks = async (req, res) => {
  try {
    const groupedId = JSON.parse(decodeURIComponent(req.params.groupedId)); // Reconstruct the grouped _id object

    const filter = {
      title: groupedId.title,
      author: groupedId.author,
      // Add other relevant fields from groupedId to ensure uniqueness if needed
    };

    const result = await Book.deleteMany(filter);
    res.json({ message: `${result.deletedCount} book copies deleted successfully` });
  } catch (error) {
    console.error("Error deleting grouped books:", error);
    res.status(500).json({ error: error.message });
  }
};

// New: Get all individual copies of a grouped book
export const getIndividualCopies = async (req, res) => {
  try {
    const groupedId = JSON.parse(decodeURIComponent(req.params.groupedId)); // Reconstruct the grouped _id object

    const filter = {
      title: groupedId.title,
      author: groupedId.author,
      // Add other relevant fields from groupedId to ensure uniqueness if needed
    };

    const copies = await Book.find(filter).select('-__v'); // Exclude __v, include all other fields
    res.json(copies);
  } catch (error) {
    console.error("Error fetching individual copies:", error);
    res.status(500).json({ error: error.message });
  }
};

// Toggle Featured Status (Admin)
export const toggleFeature = async (req, res) => {
    try {
        const groupedId = JSON.parse(decodeURIComponent(req.params.groupedId));
        
        // Find if any copy is currently featured to toggle it
        // Note: Ideally all copies have same status, but we check one.
        const oneCopy = await Book.findOne({ title: groupedId.title, author: groupedId.author });
        if(!oneCopy) return res.status(404).json({ message: "Book not found" });

        const newStatus = !oneCopy.isFeatured;

        // Update ALL copies
        await Book.updateMany({ title: groupedId.title, author: groupedId.author }, { isFeatured: newStatus });

        res.json({ message: `Book ${newStatus ? 'featured' : 'unfeatured'} successfully`, isFeatured: newStatus });
    } catch (error) {
        console.error("Error toggling feature:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getFeaturedBook = async (req, res) => {
  try {
    const book = await Book.findOne({ isFeatured: true });
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: "Error fetching featured book" });
  }
};

export const getRandomBook = async (req, res) => {
  try {
    const count = await Book.countDocuments();
    if (count === 0) return res.status(404).json({ message: "No books found" });
    const random = Math.floor(Math.random() * count);
    const book = await Book.findOne().skip(random);
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: "Error fetching random book" });
  }
};