const express = require('express');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require examiner role
router.use(authenticate, authorize('examiner'));

// POST /api/exams — Create a new exam
router.post('/', async (req, res) => {
  try {
    const { title, description, duration, questions, scheduledStart } = req.body;

    if (!title || !duration || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title, duration, and at least one question are required.' });
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.options || q.options.length !== 4 || q.correctAnswer === undefined) {
        return res.status(400).json({ message: `Question ${i + 1} is invalid. Needs text, 4 options, and a correct answer.` });
      }
    }

    const exam = await Exam.create({
      title,
      description: description || '',
      duration,
      scheduledStart: scheduledStart || null,
      questions,
      createdBy: req.user._id
    });

    res.status(201).json({ message: 'Exam created successfully!', exam });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/exams — Get all exams by this examiner
router.get('/', async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user._id })
      .select('-questions.correctAnswer')
      .sort({ createdAt: -1 });

    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/exams/:id — Get exam details (with correct answers for examiner)
router.get('/:id', async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found.' });
    }
    res.json(exam);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/exams/:id/results — Get all results for an exam
router.get('/:id/results', async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found.' });
    }

    const results = await Result.find({ exam: req.params.id })
      .populate('student', 'name email')
      .sort({ percentage: -1 });

    res.json({ exam: { title: exam.title, id: exam._id }, results });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /api/exams/:id — Update an existing exam
router.put('/:id', async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found.' });
    }

    const { title, description, duration, questions, scheduledStart } = req.body;

    if (!title || !duration || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title, duration, and at least one question are required.' });
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.options || q.options.length !== 4 || q.correctAnswer === undefined) {
        return res.status(400).json({ message: `Question ${i + 1} is invalid. Needs text, 4 options, and a correct answer.` });
      }
    }

    exam.title = title;
    exam.description = description || '';
    exam.duration = duration;
    exam.scheduledStart = scheduledStart || null;
    exam.questions = questions;

    await exam.save();

    res.json({ message: 'Exam updated successfully!', exam });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /api/exams/:id/toggle — Toggle exam active status
router.put('/:id/toggle', async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found.' });
    }

    exam.isActive = !exam.isActive;
    await exam.save();

    res.json({ message: `Exam ${exam.isActive ? 'activated' : 'deactivated'}.`, isActive: exam.isActive });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /api/exams/:id — Delete an exam
router.delete('/:id', async (req, res) => {
  try {
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found.' });
    }

    // Also delete all results for this exam
    await Result.deleteMany({ exam: req.params.id });

    res.json({ message: 'Exam deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
