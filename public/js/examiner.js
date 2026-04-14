// ── Auth Guard ──
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'examiner') {
  window.location.href = '/index.html';
}

// Setup navbar
document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
document.getElementById('userName').textContent = user.name;

function logout() {
  localStorage.clear();
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

// ── State ──
let exams = [];
let questionCount = 0;
let editingExamId = null; // null = creating, string = editing

// ── Load Exams ──
async function loadExams() {
  try {
    exams = await apiRequest('/api/exams');
    renderExams();
    updateStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateStats() {
  document.getElementById('statTotalExams').textContent = exams.length;
  document.getElementById('statActiveExams').textContent = exams.filter(e => e.isActive).length;
  const totalQ = exams.reduce((sum, e) => sum + (e.questions ? e.questions.length : 0), 0);
  document.getElementById('statTotalQuestions').textContent = totalQ;
}

function renderExams() {
  const grid = document.getElementById('examsGrid');

  if (exams.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No exams yet</h3>
        <p>Create your first exam to get started with the platform.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = exams.map(exam => `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHtml(exam.title)}</div>
          <div class="card-subtitle">${exam.description ? escapeHtml(exam.description) : 'No description'}</div>
        </div>
        <span class="badge ${exam.isActive ? 'badge-active' : 'badge-inactive'}">
          ${exam.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div class="exam-meta">
        <span class="exam-meta-item">⏱ ${exam.duration} min</span>
        <span class="exam-meta-item">❓ ${exam.questions ? exam.questions.length : 0} questions</span>
        <span class="exam-meta-item">📅 ${new Date(exam.createdAt).toLocaleDateString()}</span>
        ${exam.scheduledStart ? `<span class="exam-meta-item">🕐 ${new Date(exam.scheduledStart).toLocaleString()}</span>` : ''}
      </div>
      <div class="card-footer" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-ghost btn-sm" onclick="viewResults('${exam._id}')">📊 Results</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditExamModal('${exam._id}')" title="Edit Exam">✏️ Edit</button>
        <button class="btn btn-sm ${exam.isActive ? 'btn-ghost' : 'btn-success'}" 
                onclick="toggleExam('${exam._id}')">
          ${exam.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteExam('${exam._id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// ── Create Exam Modal ──
function openCreateExamModal() {
  editingExamId = null;
  questionCount = 0;
  document.getElementById('questionsContainer').innerHTML = '';
  document.getElementById('createExamForm').reset();
  document.getElementById('examModalTitle').textContent = '📝 Create New Exam';
  document.getElementById('examSubmitBtn').textContent = 'Create Exam';
  addQuestion(); // Start with 1 question
  document.getElementById('createExamModal').classList.add('active');
}

function closeCreateExamModal() {
  document.getElementById('createExamModal').classList.remove('active');
  editingExamId = null;
}

// ── Edit Exam Modal ──
async function openEditExamModal(examId) {
  try {
    // Fetch full exam data (with correct answers)
    const exam = await apiRequest(`/api/exams/${examId}`);

    editingExamId = examId;
    questionCount = 0;
    document.getElementById('questionsContainer').innerHTML = '';
    document.getElementById('createExamForm').reset();

    // Set modal title & button
    document.getElementById('examModalTitle').textContent = '✏️ Edit Exam';
    document.getElementById('examSubmitBtn').textContent = 'Save Changes';

    // Fill in exam details
    document.getElementById('examTitle').value = exam.title || '';
    document.getElementById('examDuration').value = exam.duration || '';
    document.getElementById('examDescription').value = exam.description || '';

    if (exam.scheduledStart) {
      // Format for datetime-local input (YYYY-MM-DDTHH:MM)
      const dt = new Date(exam.scheduledStart);
      const offset = dt.getTimezoneOffset();
      const local = new Date(dt.getTime() - offset * 60000);
      document.getElementById('examScheduledStart').value = local.toISOString().slice(0, 16);
    }

    // Add each question with pre-filled data
    if (exam.questions && exam.questions.length > 0) {
      exam.questions.forEach(q => addQuestionWithData(q));
    } else {
      addQuestion();
    }

    document.getElementById('createExamModal').classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Question Builder ──
function addQuestion() {
  addQuestionWithData(null);
}

function addQuestionWithData(data) {
  questionCount++;
  const container = document.getElementById('questionsContainer');
  const qDiv = document.createElement('div');
  qDiv.className = 'question-builder';
  qDiv.id = `question-${questionCount}`;

  const qText = data ? escapeHtmlAttr(data.questionText) : '';
  const qMarks = data ? (data.marks || 1) : 1;
  const opts = data ? data.options : ['', '', '', ''];
  const correctAnswer = data ? data.correctAnswer : -1;
  const qImage = data && data.questionImage ? data.questionImage : '';

  qDiv.innerHTML = `
    <div class="question-builder-header">
      <span class="question-builder-number">Question ${questionCount}</span>
      <button type="button" class="remove-question-btn" onclick="removeQuestion(${questionCount})" title="Remove">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label">Question Text *</label>
      <textarea class="form-textarea q-text" placeholder="Enter your question..." rows="2" required>${qText}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Marks</label>
        <input type="number" class="form-input q-marks" value="${qMarks}" min="1" style="max-width: 100px;">
      </div>
      <div class="form-group">
        <label class="form-label">📷 Question Image (optional)</label>
        <input type="file" class="form-input q-image" accept="image/*" onchange="previewQuestionImage(this)">
      </div>
    </div>
    <div class="q-image-preview" style="display: ${qImage ? 'block' : 'none'}; margin-bottom: 16px;">
      <img src="${qImage}" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid var(--border-glass);">
      <button type="button" class="btn btn-ghost btn-sm" style="margin-top: 8px;" onclick="removeQuestionImage(this)">✕ Remove Image</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Option A *</label>
        <input type="text" class="form-input q-opt" placeholder="Option A" value="${escapeHtmlAttr(opts[0] || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Option B *</label>
        <input type="text" class="form-input q-opt" placeholder="Option B" value="${escapeHtmlAttr(opts[1] || '')}" required>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Option C *</label>
        <input type="text" class="form-input q-opt" placeholder="Option C" value="${escapeHtmlAttr(opts[2] || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Option D *</label>
        <input type="text" class="form-input q-opt" placeholder="Option D" value="${escapeHtmlAttr(opts[3] || '')}" required>
      </div>
    </div>
    <div class="form-group">
      <div class="correct-answer-label">Correct Answer *</div>
      <div class="correct-answer-options">
        <label><input type="radio" name="correct-${questionCount}" value="0" ${correctAnswer === 0 ? 'checked' : ''}><span>A</span></label>
        <label><input type="radio" name="correct-${questionCount}" value="1" ${correctAnswer === 1 ? 'checked' : ''}><span>B</span></label>
        <label><input type="radio" name="correct-${questionCount}" value="2" ${correctAnswer === 2 ? 'checked' : ''}><span>C</span></label>
        <label><input type="radio" name="correct-${questionCount}" value="3" ${correctAnswer === 3 ? 'checked' : ''}><span>D</span></label>
      </div>
    </div>
  `;
  container.appendChild(qDiv);
}

function removeQuestion(id) {
  const el = document.getElementById(`question-${id}`);
  if (el) el.remove();
  // Re-number remaining questions
  const builders = document.querySelectorAll('.question-builder');
  builders.forEach((b, i) => {
    b.querySelector('.question-builder-number').textContent = `Question ${i + 1}`;
  });
}

// ── Image Handling ──
function previewQuestionImage(input) {
  const preview = input.closest('.question-builder').querySelector('.q-image-preview');
  const img = preview.querySelector('img');

  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function removeQuestionImage(btn) {
  const builder = btn.closest('.question-builder');
  const preview = builder.querySelector('.q-image-preview');
  const input = builder.querySelector('.q-image');
  preview.style.display = 'none';
  preview.querySelector('img').src = '';
  input.value = '';
}

// ── Submit (Create or Update) ──
async function submitExam() {
  const title = document.getElementById('examTitle').value.trim();
  const duration = parseInt(document.getElementById('examDuration').value);
  const description = document.getElementById('examDescription').value.trim();
  const scheduledStartVal = document.getElementById('examScheduledStart').value;
  const scheduledStart = scheduledStartVal ? new Date(scheduledStartVal).toISOString() : null;

  if (!title || !duration) {
    showToast('Please fill in the exam title and duration.', 'error');
    return;
  }

  const questionBuilders = document.querySelectorAll('.question-builder');
  if (questionBuilders.length === 0) {
    showToast('Please add at least one question.', 'error');
    return;
  }

  const questions = [];
  for (const qb of questionBuilders) {
    const text = qb.querySelector('.q-text').value.trim();
    const marks = parseInt(qb.querySelector('.q-marks').value) || 1;
    const opts = Array.from(qb.querySelectorAll('.q-opt')).map(i => i.value.trim());
    const correctRadio = qb.querySelector('input[type="radio"]:checked');

    // Get image if uploaded
    const imgPreview = qb.querySelector('.q-image-preview img');
    const questionImage = (imgPreview && imgPreview.src && imgPreview.src.startsWith('data:')) ? imgPreview.src : 
                          (imgPreview && imgPreview.src && !imgPreview.src.startsWith('data:') && imgPreview.src !== window.location.href) ? imgPreview.src : '';

    if (!text || opts.some(o => !o) || !correctRadio) {
      showToast('Please fill in all fields for each question and select the correct answer.', 'error');
      return;
    }

    questions.push({
      questionText: text,
      questionImage,
      options: opts,
      correctAnswer: parseInt(correctRadio.value),
      marks
    });
  }

  const submitBtn = document.getElementById('examSubmitBtn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = editingExamId ? 'Saving...' : 'Creating...';

  try {
    if (editingExamId) {
      // Update existing exam
      await apiRequest(`/api/exams/${editingExamId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, description, duration, scheduledStart, questions })
      });
      showToast('Exam updated successfully!', 'success');
    } else {
      // Create new exam
      await apiRequest('/api/exams', {
        method: 'POST',
        body: JSON.stringify({ title, description, duration, scheduledStart, questions })
      });
      showToast('Exam created successfully!', 'success');
    }

    closeCreateExamModal();
    loadExams();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ── Toggle & Delete ──
async function toggleExam(id) {
  try {
    const data = await apiRequest(`/api/exams/${id}/toggle`, { method: 'PUT' });
    showToast(data.message, 'success');
    loadExams();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteExam(id) {
  if (!confirm('Are you sure you want to delete this exam? All results will also be deleted.')) return;
  try {
    await apiRequest(`/api/exams/${id}`, { method: 'DELETE' });
    showToast('Exam deleted.', 'success');
    loadExams();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── View Results ──
async function viewResults(examId) {
  try {
    const data = await apiRequest(`/api/exams/${examId}/results`);
    const modal = document.getElementById('resultsModal');
    const body = document.getElementById('resultsModalBody');

    if (data.results.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No results yet</h3>
          <p>No students have taken this exam yet.</p>
        </div>
      `;
    } else {
      const avgScore = Math.round(data.results.reduce((s, r) => s + r.percentage, 0) / data.results.length);
      const passCount = data.results.filter(r => r.passed).length;

      body.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 8px;">${escapeHtml(data.exam.title)}</h3>
          <div class="exam-meta">
            <span class="exam-meta-item">👥 ${data.results.length} students</span>
            <span class="exam-meta-item">📊 Avg: ${avgScore}%</span>
            <span class="exam-meta-item">✅ ${passCount} passed</span>
          </div>
        </div>
        <table class="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Email</th>
              <th>Score</th>
              <th>%</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.results.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td style="font-weight: 500;">${escapeHtml(r.student.name)}</td>
                <td style="color: var(--text-muted);">${escapeHtml(r.student.email)}</td>
                <td>${r.score}/${r.totalMarks}</td>
                <td style="font-weight: 600;">${r.percentage}%</td>
                <td><span class="badge ${r.passed ? 'badge-passed' : 'badge-failed'}">${r.passed ? 'Passed' : 'Failed'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    modal.classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeResultsModal() {
  document.getElementById('resultsModal').classList.remove('active');
}

// ── Escape HTML ──
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Init ──
loadExams();
