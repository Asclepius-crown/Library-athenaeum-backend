import express from "express";
import {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  addToWishlist,
  removeFromWishlist,
  getWishlist
} from "../controllers/students.js";
import authMiddleware from "../middleware/auth.js"; // if you want auth
import checkRole from "../middleware/role.js";

const router = express.Router();

router.get("/", authMiddleware, checkRole(['admin']), getStudents);
router.post("/", authMiddleware, checkRole(['admin']), addStudent);
router.put("/:rollNo", authMiddleware, checkRole(['admin']), updateStudent);
router.delete("/:rollNo", authMiddleware, checkRole(['admin']), deleteStudent);

router.post("/wishlist", authMiddleware, addToWishlist);
router.delete("/wishlist", authMiddleware, removeFromWishlist);
router.get("/wishlist/:rollNo", authMiddleware, getWishlist);

export default router;
