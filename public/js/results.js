// ── Auth Guard ──
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'student') {
  window.location.href = '/index.html';
}

document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
document.getElementById('userName').textContent = user.name;

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

// ── API Request ──
async function apiRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Load Result ──
const urlParams = new URLSearchParams(window.location.search);
const resultId = urlParams.get('id');

async function loadResult() {
  if (!resultId) {
    window.location.href = '/student-dashboard.html';
    return;
  }

  try {
    const result = await apiRequest(`/api/student/results/${resultId}`);
    renderResult(result);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderResult(result) {
  const container = document.getElementById('resultContent');
  const exam = result.exam;

  container.innerHTML = `
    <div class="result-summary">
      <div style="font-size: 3rem; margin-bottom: 8px;">${result.passed ? '🎉' : '😔'}</div>
      <h2 style="margin-bottom: 4px;">${escapeHtml(exam.title)}</h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">
        Submitted on ${new Date(result.createdAt).toLocaleString()}
      </p>
      <div class="result-score">${result.percentage}%</div>
      <div class="result-status ${result.passed ? 'passed' : 'failed'}">
        ${result.passed ? 'PASSED ✅' : 'FAILED ❌'}
      </div>
      <div class="result-details">
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
    </div>

    <h2 class="section-title">📋 Question Review</h2>
    <div>
      ${exam.questions.map((q, i) => {
        const studentAnswer = result.answers.find(a => a.questionId === q._id);
        const studentSelected = studentAnswer ? studentAnswer.selectedAnswer : -1;
        const isCorrect = studentSelected === q.correctAnswer;

        return `
          <div class="question-card" style="border-color: ${isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
            <div style="margin-bottom: 16px;">
              <span class="question-marks">${q.marks || 1} mark${(q.marks || 1) > 1 ? 's' : ''}</span>
              <span class="question-number" style="background: ${isCorrect ? 'var(--gradient-success)' : 'var(--gradient-danger)'}">${i + 1}</span>
              <span class="question-text">${escapeHtml(q.questionText)}</span>
            </div>
            ${q.questionImage ? `<div style="margin-bottom: 16px;"><img src="${q.questionImage}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid var(--border-glass);"></div>` : ''}
            <div class="options-list">
              ${q.options.map((opt, j) => {
                let classes = 'option-item';
                let suffix = '';
                if (j === q.correctAnswer) {
                  classes += ' selected';
                  suffix = ' ✅';
                }
                if (j === studentSelected && j !== q.correctAnswer) {
                  suffix = ' ❌ (your answer)';
                }
                if (j === studentSelected && j === q.correctAnswer) {
                  suffix = ' ✅ (your answer)';
                }
                return `
                  <div class="${classes}" style="cursor: default; ${j === q.correctAnswer ? 'border-color: var(--accent-green); background: rgba(16, 185, 129, 0.08);' : ''} ${j === studentSelected && j !== q.correctAnswer ? 'border-color: var(--accent-red); background: rgba(239, 68, 68, 0.08);' : ''}">
                    <div class="option-indicator" style="${j === q.correctAnswer ? 'border-color: var(--accent-green); background: var(--accent-green);' : ''}"></div>
                    <span>${escapeHtml(opt)}${suffix}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Init ──
loadResult();
