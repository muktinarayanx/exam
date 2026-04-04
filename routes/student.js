const express = require('express');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const { authenticate, authorize } = require('../middleware/auth');
const { sendResultEmail } = require('../utils/mailer');

const router = express.Router();

// All routes require student role
router.use(authenticate, authorize('student'));

// GET /api/student/exams — Get all active exams for students
router.get('/exams', async (req, res) => {
  try {
    const exams = await Exam.find({ isActive: true })
      .select('title description duration questions createdAt scheduledStart')
      .sort({ createdAt: -1 });

    // Check which exams the student already attempted (include result ID)
    const results = await Result.find({ student: req.user._id }).select('exam _id');
    const attemptedMap = {};
    results.forEach(r => { attemptedMap[r.exam.toString()] = r._id.toString(); });

    const now = new Date();

    const examsWithStatus = exams.map(exam => {
      let status = 'available';
      let scheduledStart = exam.scheduledStart ? exam.scheduledStart : null;
      
      if (scheduledStart) {
        const startTime = new Date(scheduledStart);
        const endTime = new Date(startTime.getTime() + exam.duration * 60000);
        
        if (now < startTime) {
          status = 'scheduled'; // Not started yet
        } else if (now > endTime) {
          status = 'expired'; // Time window passed
        } else {
          status = 'live'; // Currently running
        }
      }

      return {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        scheduledStart: scheduledStart,
        questionCount: exam.questions.length,
        totalMarks: exam.questions.reduce((sum, q) => sum + (q.marks || 1), 0),
        createdAt: exam.createdAt,
        attempted: !!attemptedMap[exam._id.toString()],
        resultId: attemptedMap[exam._id.toString()] || null,
        status: attemptedMap[exam._id.toString()] ? 'attempted' : status
      };
    });

    res.json(examsWithStatus);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/student/exams/:id — Get exam questions (without correct answers)
router.get('/exams/:id', async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, isActive: true });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not active.' });
    }

    // Check scheduling
    if (exam.scheduledStart) {
      const now = new Date();
      const startTime = new Date(exam.scheduledStart);
      const endTime = new Date(startTime.getTime() + exam.duration * 60000);

      if (now < startTime) {
        return res.status(403).json({ message: `Exam has not started yet. It starts at ${startTime.toLocaleString()}.` });
      }
      if (now > endTime) {
        return res.status(403).json({ message: 'Exam window has expired. You can no longer take this exam.' });
      }
    }

    // Check if already attempted
    const existingResult = await Result.findOne({ student: req.user._id, exam: exam._id });
    if (existingResult) {
      return res.status(400).json({ message: 'You have already attempted this exam.' });
    }

    // Strip correct answers
    const sanitizedQuestions = exam.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      questionImage: q.questionImage || '',
      options: q.options,
      marks: q.marks
    }));

    res.json({
      _id: exam._id,
      title: exam.title,
      description: exam.description,
      duration: exam.duration,
      questions: sanitizedQuestions
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/student/exams/:id/submit — Submit exam answers
router.post('/exams/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body; // [{ questionId, selectedAnswer }]

    const exam = await Exam.findOne({ _id: req.params.id, isActive: true });
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not active.' });
    }

    // Check scheduling for submission
    if (exam.scheduledStart) {
      const now = new Date();
      const startTime = new Date(exam.scheduledStart);
      // Allow a 5 min grace period for submission after window ends
      const endTime = new Date(startTime.getTime() + (exam.duration + 5) * 60000);

      if (now < startTime) {
        return res.status(403).json({ message: 'Exam has not started yet.' });
      }
      if (now > endTime) {
        return res.status(403).json({ message: 'Exam submission window has expired.' });
      }
    }

    // Check if already attempted
    const existingResult = await Result.findOne({ student: req.user._id, exam: exam._id });
    if (existingResult) {
      return res.status(400).json({ message: 'You have already attempted this exam.' });
    }

    // Grade the exam
    let score = 0;
    let totalMarks = 0;

    exam.questions.forEach(question => {
      const studentAnswer = answers.find(a => a.questionId === question._id.toString());
      totalMarks += (question.marks || 1);

      if (studentAnswer && studentAnswer.selectedAnswer === question.correctAnswer) {
        score += (question.marks || 1);
      }
    });

    const percentage = Math.round((score / totalMarks) * 100);
    const passed = percentage >= 40;

    const result = await Result.create({
      student: req.user._id,
      exam: exam._id,
      answers: answers || [],
      score,
      totalMarks,
      percentage,
      passed
    });

    // Send email (non-blocking)
    sendResultEmail(
      req.user.email,
      req.user.name,
      exam.title,
      score,
      totalMarks,
      percentage,
      passed
    ).catch(err => console.error('Email send failed:', err));

    res.json({
      message: 'Exam submitted successfully! Results have been emailed to you.',
      result: {
        score,
        totalMarks,
        percentage,
        passed
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/student/results — Get all results for this student
router.get('/results', async (req, res) => {
  try {
    const results = await Result.find({ student: req.user._id })
      .populate('exam', 'title description duration')
      .sort({ createdAt: -1 });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/student/results/:id — Get detailed result
router.get('/results/:id', async (req, res) => {
  try {
    const result = await Result.findOne({ _id: req.params.id, student: req.user._id })
      .populate('exam');

    if (!result) {
      return res.status(404).json({ message: 'Result not found.' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
