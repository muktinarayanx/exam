// ── Auth Guard ──
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'student') {
  window.location.href = '/index.html';
}

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Tabs ──
function showTab(tab) {
  document.getElementById('examsTab').style.display = tab === 'exams' ? 'block' : 'none';
  document.getElementById('resultsTab').style.display = tab === 'results' ? 'block' : 'none';
  document.getElementById('tabExams').classList.toggle('active', tab === 'exams');
  document.getElementById('tabResults').classList.toggle('active', tab === 'results');

  if (tab === 'results') loadResults();
}

// ── Load Available Exams ──
async function loadExams() {
  try {
    const exams = await apiRequest('/api/student/exams');
    const grid = document.getElementById('examsGrid');

    const available = exams.filter(e => !e.attempted).length;
    const completed = exams.filter(e => e.attempted).length;
    document.getElementById('statAvailable').textContent = available;
    document.getElementById('statCompleted').textContent = completed;

    if (exams.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>No exams available</h3>
          <p>Check back later for new exams.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = exams.map(exam => {
      // Badge based on status
      let badgeHtml = '';
      switch (exam.status) {
        case 'attempted':
          badgeHtml = '<span class="badge badge-attempted">Completed</span>';
          break;
        case 'scheduled':
          badgeHtml = '<span class="badge badge-purple">🕐 Scheduled</span>';
          break;
        case 'live':
          badgeHtml = '<span class="badge badge-active" style="animation: pulse 2s infinite;">🔴 LIVE</span>';
          break;
        case 'expired':
          badgeHtml = '<span class="badge badge-inactive">Expired</span>';
          break;
        default:
          badgeHtml = '<span class="badge badge-active">Available</span>';
      }

      // Scheduled time info
      let scheduleInfo = '';
      if (exam.scheduledStart) {
        const startTime = new Date(exam.scheduledStart);
        const endTime = new Date(startTime.getTime() + exam.duration * 60000);
        scheduleInfo = `
          <span class="exam-meta-item">🕐 Starts: ${startTime.toLocaleString()}</span>
          <span class="exam-meta-item">🏁 Ends: ${endTime.toLocaleString()}</span>
        `;
      }

      // Footer action based on status
      let footerHtml = '';
      switch (exam.status) {
        case 'attempted':
          footerHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">Already attempted</span>
               <a href="/results.html?id=${exam.resultId}" class="btn btn-ghost btn-sm">📋 Review Answers</a>`;
          break;
        case 'scheduled':
          footerHtml = `<span style="color: var(--accent-purple); font-size: 0.85rem;" id="countdown-${exam._id}">⏳ Starting soon...</span>`;
          break;
        case 'live':
          footerHtml = `<button class="btn btn-primary btn-sm" onclick="startExam('${exam._id}')">🔴 Start Now →</button>`;
          break;
        case 'expired':
          footerHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">⏰ Exam window has ended</span>`;
          break;
        default:
          footerHtml = `<button class="btn btn-primary btn-sm" onclick="startExam('${exam._id}')">Start Exam →</button>`;
      }

      return `
        <div class="card" ${exam.status === 'expired' ? 'style="opacity: 0.6;"' : ''}>
          <div class="card-header">
            <div>
              <div class="card-title">${escapeHtml(exam.title)}</div>
              <div class="card-subtitle">${exam.description ? escapeHtml(exam.description) : 'No description'}</div>
            </div>
            ${badgeHtml}
          </div>
          <div class="exam-meta">
            <span class="exam-meta-item">⏱ ${exam.duration} min</span>
            <span class="exam-meta-item">❓ ${exam.questionCount} questions</span>
            <span class="exam-meta-item">📝 ${exam.totalMarks} marks</span>
            ${scheduleInfo}
          </div>
          <div class="card-footer">
            ${footerHtml}
          </div>
        </div>
      `;
    }).join('');

    // Start countdowns for scheduled exams
    exams.filter(e => e.status === 'scheduled').forEach(exam => {
      startCountdown(exam._id, new Date(exam.scheduledStart));
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Countdown Timer ──
function startCountdown(examId, startTime) {
  const el = document.getElementById(`countdown-${examId}`);
  if (!el) return;

  const update = () => {
    const now = new Date();
    const diff = startTime - now;

    if (diff <= 0) {
      el.innerHTML = '🔴 Exam is LIVE! Refreshing...';
      setTimeout(() => loadExams(), 1500);
      return;
    }

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    let timeStr = '';
    if (hours > 0) timeStr += `${hours}h `;
    timeStr += `${mins}m ${secs}s`;

    el.textContent = `⏳ Starts in ${timeStr}`;
  };

  update();
  setInterval(update, 1000);
}

// ── Start Exam ──
function startExam(examId) {
  if (confirm('Are you ready to start this exam? The timer will begin immediately.')) {
    window.location.href = `/take-exam.html?id=${examId}`;
  }
}

// ── Load Results ──
async function loadResults() {
  try {
    const results = await apiRequest('/api/student/results');
    const container = document.getElementById('resultsContainer');

    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No results yet</h3>
          <p>Take an exam to see your results here.</p>
        </div>
      `;
      return;
    }

    // Update stats
    const avgScore = Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length);
    const passRate = Math.round((results.filter(r => r.passed).length / results.length) * 100);
    document.getElementById('statAvgScore').textContent = `${avgScore}%`;
    document.getElementById('statPassRate').textContent = `${passRate}%`;

    container.innerHTML = `
      <table class="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Exam</th>
            <th>Score</th>
            <th>Percentage</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${results.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td style="font-weight: 500;">${escapeHtml(r.exam?.title || 'Unknown')}</td>
              <td>${r.score}/${r.totalMarks}</td>
              <td style="font-weight: 600;">${r.percentage}%</td>
              <td><span class="badge ${r.passed ? 'badge-passed' : 'badge-failed'}">${r.passed ? 'Passed' : 'Failed'}</span></td>
              <td style="color: var(--text-muted);">${new Date(r.createdAt).toLocaleDateString()}</td>
              <td><a href="/results.html?id=${r._id}" class="btn btn-ghost btn-sm">View Details</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Init ──
loadExams();
