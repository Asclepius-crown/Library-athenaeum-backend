import Student from "../models/Student.js";

// Get all students
export const getStudents = async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
};

// Add student
export const addStudent = async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update student
export const updateStudent = async (req, res) => {
  try {
    const updated = await Student.findOneAndUpdate(
      { rollNo: req.params.rollNo },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Student not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete student
export const deleteStudent = async (req, res) => {
  try {
    const deleted = await Student.findOneAndDelete({ rollNo: req.params.rollNo });
    if (!deleted) return res.status(404).json({ error: "Student not found" });
    res.json({ message: "Student deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add book to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { rollNo, bookId } = req.body;
    const student = await Student.findOne({ rollNo });
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    if (!student.wishlist.includes(bookId)) {
      student.wishlist.push(bookId);
      await student.save();
    }
    res.json(student);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Remove book from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { rollNo, bookId } = req.body;
    const student = await Student.findOne({ rollNo });
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    student.wishlist = student.wishlist.filter(id => id.toString() !== bookId);
    await student.save();
    res.json(student);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get student's wishlist
export const getWishlist = async (req, res) => {
  try {
    const student = await Student.findOne({ rollNo: req.params.rollNo }).populate('wishlist');
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json(student.wishlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
