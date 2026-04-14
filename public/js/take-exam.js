// ── Auth Guard ──
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'student') {
  window.location.href = '/index.html';
}

// ── Toast ──
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── API Request (with timeout) ──
async function apiRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  // 30-second timeout to prevent infinite loading
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
}

// ── State ──
let examData = null;
let answers = {};
let timerInterval = null;
let timeRemaining = 0;
let isSubmitting = false; // Prevent double submissions

// ── Get exam ID from URL ──
const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('id');

if (!examId) {
  window.location.href = '/student-dashboard.html';
}

// ── Load Exam ──
async function loadExam() {
  try {
    examData = await apiRequest(`/api/student/exams/${examId}`);
    document.getElementById('examTitle').textContent = examData.title;
    document.title = `Exam: ${examData.title}`;

    renderQuestions();
    startTimer(examData.duration * 60);
    updateProgress();
  } catch (err) {
    showToast(err.message, 'error');
    setTimeout(() => {
      window.location.href = '/student-dashboard.html';
    }, 2000);
  }
}

function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  container.innerHTML = examData.questions.map((q, i) => `
    <div class="question-card" id="qcard-${q._id}">
      <div style="margin-bottom: 16px;">
        <span class="question-marks">${q.marks || 1} mark${(q.marks || 1) > 1 ? 's' : ''}</span>
        <span class="question-number">${i + 1}</span>
        <span class="question-text">${escapeHtml(q.questionText)}</span>
      </div>
      ${q.questionImage ? `<div style="margin-bottom: 16px;"><img src="${q.questionImage}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid var(--border-glass);"></div>` : ''}
      <div class="options-list">
        ${q.options.map((opt, j) => `
          <div class="option-item" onclick="selectOption('${q._id}', ${j}, this)" id="opt-${q._id}-${j}">
            <div class="option-indicator"></div>
            <span>${escapeHtml(opt)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function selectOption(questionId, optionIndex, element) {
  answers[questionId] = optionIndex;

  // Update UI
  const card = document.getElementById(`qcard-${questionId}`);
  card.classList.add('answered');
  card.querySelectorAll('.option-item').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');

  updateProgress();
}

function updateProgress() {
  const total = examData.questions.length;
  const answered = Object.keys(answers).length;
  const pct = Math.round((answered / total) * 100);

  document.getElementById('progressBar').style.width = `${pct}%`;
  document.getElementById('answeredCount').textContent = `${answered}/${total} answered`;
}

// ── Timer ──
function startTimer(seconds) {
  timeRemaining = seconds;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeRemaining--;

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      showToast('Time is up! Auto-submitting...', 'info');
      submitExam();
      return;
    }

    updateTimerDisplay();

    // Visual warnings
    const timer = document.getElementById('timer');
    if (timeRemaining <= 60) {
      timer.className = 'timer danger';
    } else if (timeRemaining <= 300) {
      timer.className = 'timer warning';
    }
  }, 1000);
}

function updateTimerDisplay() {
  const min = Math.floor(timeRemaining / 60);
  const sec = timeRemaining % 60;
  document.getElementById('timerDisplay').textContent =
    `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// ── Submit ──
function confirmSubmit() {
  if (isSubmitting) return; // Prevent opening modal during submission

  const total = examData.questions.length;
  const answered = Object.keys(answers).length;

  document.getElementById('confirmAnswered').textContent = answered;
  document.getElementById('confirmTotal').textContent = total;
  document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('active');
}

// Helper to set all submit buttons state
function setSubmitButtonsState(disabled, text) {
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = disabled;
  submitBtn.textContent = text;
  // Also disable/enable the header submit button
  document.querySelectorAll('[onclick="confirmSubmit()"]').forEach(btn => {
    btn.disabled = disabled;
    if (disabled) btn.style.opacity = '0.5';
    else btn.style.opacity = '1';
  });
}

async function submitExam() {
  // Prevent double submissions
  if (isSubmitting) return;
  isSubmitting = true;

  clearInterval(timerInterval);
  closeConfirmModal();
  setSubmitButtonsState(true, 'Submitting...');

  try {
    const formattedAnswers = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
      questionId,
      selectedAnswer
    }));

    const data = await apiRequest(`/api/student/exams/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers: formattedAnswers })
    });

    // Show result modal
    const result = data.result;
    if (!result) {
      throw new Error('Invalid response from server. Please contact your examiner.');
    }

    const resultContent = document.getElementById('resultContent');
    resultContent.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 16px;">${result.passed ? '🎉' : '😔'}</div>
      <div class="result-score">${result.percentage}%</div>
      <div class="result-status ${result.passed ? 'passed' : 'failed'}">
        ${result.passed ? 'PASSED' : 'FAILED'}
      </div>
      <div class="result-details" style="margin-top: 24px;">
        <div class="result-detail-item">
          <div class="result-detail-value">${result.score}</div>
          <div class="result-detail-label">Score</div>
        </div>
        <div class="result-detail-item">
          <div class="result-detail-value">${result.totalMarks}</div>
          <div class="result-detail-label">Total Marks</div>
        </div>
        <div class="result-detail-item">
          <div class="result-detail-value">${result.percentage}%</div>
          <div class="result-detail-label">Percentage</div>
        </div>
      </div>
      <p style="color: var(--text-muted); margin-top: 24px; font-size: 0.85rem;">
        📧 Results will be emailed to <strong>${user.email}</strong> shortly
      </p>
    `;

    document.getElementById('resultModal').classList.add('active');
  } catch (err) {
    isSubmitting = false; // Allow retry on error
    showToast(err.message || 'Submission failed. Please try again.', 'error');
    setSubmitButtonsState(false, 'Submit Exam');
  }
}

function goToDashboard() {
  window.location.href = '/student-dashboard.html';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Warn before leaving
window.addEventListener('beforeunload', (e) => {
  if (examData && !document.getElementById('resultModal').classList.contains('active')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Init ──
loadExam();
