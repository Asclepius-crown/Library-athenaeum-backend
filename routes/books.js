import express from "express";
import authMiddleware from "../middleware/auth.js";
import checkRole from "../middleware/role.js";
import multer from "multer";
import {
  uploadBooks,
  getBulkBooks,
  borrowBook,
  createBook,
  updateBook,
  deleteBook,
  bulkCreateBooks,
  bulkDeleteBooks,
  updateGroupedBookMetadata, // New import
  deleteGroupedBooks,     // New import
  getIndividualCopies,       // New import
  toggleFeature,
  getFeaturedBook,
  getRandomBook
} from "../controllers/books.js";

import { logAudit } from '../middleware/audit.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Bulk Upload (Admin)
router.post("/upload", authMiddleware, checkRole(['admin']), upload.single("file"), logAudit('BULK_UPLOAD_BOOKS'), uploadBooks);

// Get Books (All Users)
router.get("/bulk", authMiddleware, getBulkBooks);

// Borrow Book (All Users) - still operates on specific copy ID
router.post("/:id/borrow", authMiddleware, logAudit('BORROW_BOOK'), borrowBook);

// Create Book (Admin) - creates a new physical copy
router.post("/", authMiddleware, checkRole(['admin']), logAudit('CREATE_BOOK'), createBook);

// Update a single physical book copy (Admin)
router.put("/:id", authMiddleware, checkRole(['admin']), logAudit('UPDATE_BOOK'), updateBook);

// Delete a single physical book copy (Admin)
router.delete("/:id", authMiddleware, checkRole(['admin']), logAudit('DELETE_BOOK'), deleteBook);

// Bulk Create (Admin) - creates new physical copies
router.post("/bulk", authMiddleware, checkRole(['admin']), logAudit('BULK_CREATE_BOOKS'), bulkCreateBooks);

// Bulk Delete (Admin) - deletes multiple physical copies by their IDs
router.post("/bulk-delete", authMiddleware, checkRole(['admin']), logAudit('BULK_DELETE_BOOKS'), bulkDeleteBooks);

// New Grouped Operations (Admin Only)
// Update metadata for all copies of a grouped book
router.put("/grouped/:groupedId", authMiddleware, checkRole(['admin']), logAudit('UPDATE_GROUPED_BOOK'), updateGroupedBookMetadata);
// Delete all copies of a grouped book
router.delete("/grouped/:groupedId", authMiddleware, checkRole(['admin']), logAudit('DELETE_GROUPED_BOOK'), deleteGroupedBooks);
// Get all individual copies of a grouped book
router.get("/copies/:groupedId", authMiddleware, checkRole(['admin']), getIndividualCopies);
// Toggle Featured Status (Admin)
router.put("/grouped/:groupedId/feature", authMiddleware, checkRole(['admin']), logAudit('TOGGLE_FEATURE'), toggleFeature);

// Get Featured Book (Public)
router.get("/featured", getFeaturedBook);

// Get Random Book (All Users)
router.get("/random", authMiddleware, getRandomBook);

export default router;
