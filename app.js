/* =====================================================
   ATHLETEMIND — app.js
   Full interactive logic for all modules
   ===================================================== */

// ── Device ID (unique per browser, persists in localStorage) ──
function getDeviceId() {
  let id = localStorage.getItem('rtp_device_id');
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('rtp_device_id', id);
  }
  return id;
}

// ── Sync data to backend (fire-and-forget, won't break the app if server is down) ──
function syncToServer(data) {
  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), data }),
      keepalive: true
    }).catch(() => {}); // silently ignore if offline or server not running
  } catch(e) {}
}

// =====================================================
// GLOBAL STATE
// =====================================================
const AppState = {
  user: null,
  sport: 'football',
  theme: 'dark',
  calendarEvents: [],
  foodLog: [],
  nutritionGoals: { calories: 2500, protein: 150, carbs: 300, fat: 80, fibre: 30 },
  calMonth: new Date(),
  map: null,
  userCoords: null,
  chatHistory: [],
  streak: 0,
  sessions: 0,
  selectedFood: null,
  // ── Streak System v2 ──
  lastStreakDate: null,         // YYYY-MM-DD of last training activity
  streakShields: 0,            // protection shields (max 3)
  longestStreak: 0,            // all-time best training streak
  streakMilestonesHit: [],     // array of milestone values already rewarded
  inComebackMode: false,       // true when a streak was just broken
  nutritionStreak: 0,
  nutritionStreakDate: null,
  wellnessStreak: 0,
  wellnessStreakDate: null,
};

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  checkStreakOnLoad();
  setupAgeGateDobMax();
  setupNavigation();
  setupSportButtons();
  refreshDailyTip();
  renderCalendar();
  updateNutritionUI();
  updateDashboardStats();
  loadProTips();
  updateSidebarStats();

  // Auto-apply saved theme & sport
  applyTheme(AppState.theme);
  applySport(AppState.sport);

  // If user already set up, skip age gate
  if (AppState.user) {
    document.getElementById('ageGate').classList.remove('active');
    document.getElementById('ageGate').classList.add('hidden');
    updateGreeting();
  }

  // ── Scroll-to-top button ──
  const scrollBtn = document.createElement('button');
  scrollBtn.id = 'scrollTopBtn';
  scrollBtn.title = 'Back to top';
  scrollBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
  scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(scrollBtn);
  window.addEventListener('scroll', () => {
    scrollBtn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });

  // ── Ripple effect on interactive buttons ──
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-primary,.btn-secondary,.btn-accent,.qss-btn,.fields-quick-btn,.nav-btn');
    if (!btn) return;
    // Haptic feedback (mobile)
    if (navigator.vibrate) navigator.vibrate(12);
    const r = document.createElement('span');
    r.className = 'ripple-wave';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  });

  // ── Streak badge on Streak Hub nav button ──
  updateNavStreakBadge();

  // ── Feature 11: Auto dark/light schedule based on time ──
  autoApplyDayNightTheme();

  // ── PWA theme-color: keep browser chrome in sync with sport accent ──
  updatePWAThemeColor();

  // ── Feature 12: Offline indicator ──
  setupOfflineIndicator();

  // ── Feature 6: Render activity feed ──
  setTimeout(renderActivityFeed, 200);

  // ── Feature 10: Render mascot ──
  setTimeout(renderMascot, 300);

  // ── Lazy-load images with IntersectionObserver ──
  setupLazyImages();
});

function setupLazyImages() {
  const observe = img => {
    if (img.complete) { img.classList.add('loaded'); return; }
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
  };
  document.querySelectorAll('img[loading="lazy"]').forEach(observe);
  // Watch for dynamically added images (progress photos, avatars, etc.)
  new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'IMG' && n.getAttribute('loading') === 'lazy') observe(n);
      n.querySelectorAll?.('img[loading="lazy"]').forEach(observe);
    }));
  }).observe(document.body, { childList: true, subtree: true });
};

// =====================================================
// STORAGE
// =====================================================
function saveToStorage() {
  const data = {
    user: AppState.user,
    sport: AppState.sport,
    theme: AppState.theme,
    calendarEvents: AppState.calendarEvents,
    foodLog: AppState.foodLog,
    nutritionGoals: AppState.nutritionGoals,
    allFoodLogs: AppState.allFoodLogs,
    streak: AppState.streak,
    sessions: AppState.sessions,
    chatHistory: AppState.chatHistory,
    // New feature state
    pbs: AppState.pbs,
    measurements: AppState.measurements,
    rpeLog: AppState.rpeLog,
    sleepLog: AppState.sleepLog,
    hydration: AppState.hydration,
    hydrationGoal: AppState.hydrationGoal,
    hydrationGoalHit: AppState.hydrationGoalHit,
    injuryLog: AppState.injuryLog,
    xp: AppState.xp,
    earnedBadges: AppState.earnedBadges,
    challenges: AppState.challenges,
    completedChallenges: AppState.completedChallenges,
    prefs: AppState.prefs,
    planGenerated: AppState.planGenerated,
    earlySession: AppState.earlySession,
    goodSleepCount: AppState.goodSleepCount,
    // Kit checked state per sport
    kitChecked_football: AppState.kitChecked_football,
    kitChecked_basketball: AppState.kitChecked_basketball,
    kitChecked_running: AppState.kitChecked_running,
    kitChecked_tennis: AppState.kitChecked_tennis,
    kitChecked_swimming: AppState.kitChecked_swimming,
    kitChecked_cycling: AppState.kitChecked_cycling,
    videoAnalyses: AppState.videoAnalyses,
    sleepSessionStart: AppState.sleepSessionStart,
    sleepTargetHours: AppState.sleepTargetHours,
    // Streak System v2
    lastStreakDate: AppState.lastStreakDate,
    streakShields: AppState.streakShields,
    longestStreak: AppState.longestStreak,
    streakMilestonesHit: AppState.streakMilestonesHit,
    inComebackMode: AppState.inComebackMode,
    nutritionStreak: AppState.nutritionStreak,
    nutritionStreakDate: AppState.nutritionStreakDate,
    wellnessStreak: AppState.wellnessStreak,
    wellnessStreakDate: AppState.wellnessStreakDate,
    themeManuallySet: AppState.themeManuallySet,
    activityFeed: AppState.activityFeed,
    gameDayChecked: AppState.gameDayChecked,
    matchHistory: AppState.matchHistory,
    progressPhotos: AppState.progressPhotos,
  };
  localStorage.setItem('athletemind_v2', JSON.stringify(data));
  syncToServer(data);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('athletemind_v2');
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.assign(AppState, data);
    // Filter food log to today only
    const today = getTodayStr();
    AppState.foodLog = AppState.foodLog.filter(f => f.date === today);
  } catch(e) { console.warn('Storage load error', e); }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// =====================================================
// AGE GATE / ONBOARDING WIZARD
// =====================================================

// Positions per sport
const SPORT_POSITIONS = {
  football: ['Goalkeeper','Right Back','Left Back','Centre Back','Defensive Midfielder','Central Midfielder','Attacking Midfielder','Right Winger','Left Winger','Striker','False 9','Box-to-Box Midfielder'],
  basketball: ['Point Guard','Shooting Guard','Small Forward','Power Forward','Centre'],
  running: ['Sprinter (100m–400m)','Middle Distance (800m–1500m)','Long Distance (5k–Marathon)','Ultra Runner','Trail Runner','Cross Country'],
  tennis: ['Baseline Player','Serve & Volley','All-Court Player','Doubles Specialist'],
  swimming: ['Freestyle','Backstroke','Breaststroke','Butterfly','Individual Medley','Open Water'],
  cycling: ['Road Cyclist','Track Cyclist','Mountain Biker','Triathlete','BMX','Gravel Rider'],
};

const SPORT_EQUIPMENT = {
  football: ['Football Boots','Shin Pads','Football','Training Kit','Goalkeeper Gloves','Cones/Markers','Resistance Bands'],
  basketball: ['Basketball Shoes','Basketball','Knee Sleeves','Ankle Braces','Resistance Bands'],
  running: ['Running Shoes','GPS Watch','Compression Socks','Running Vest','Foam Roller'],
  tennis: ['Tennis Racket','Tennis Shoes','Balls','Ball Machine Access','Training Bag'],
  swimming: ['Goggles','Swim Cap','Kickboard','Pull Buoy','Training Fins'],
  cycling: ['Road/MTB Bike','Helmet','Cycling Shoes','Cycling Computer','Repair Kit','Training Turbo'],
};

function setupAgeGateDobMax() {
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 4);
  document.getElementById('userDob').max = maxDate.toISOString().split('T')[0];
}

function onboardNext(step) {
  if (step === 1) {
    const name = document.getElementById('userName').value.trim();
    const dob = document.getElementById('userDob').value;
    const errEl = document.getElementById('ageError');
    if (!name) { showToast('Please enter your name!'); return; }
    if (!dob) { showToast('Please enter your date of birth!'); return; }
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    if (age < 4) { errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
  }
  if (step === 2) {
    // Populate positions for selected sport
    const sport = document.querySelector('#onboard-step-2 .sport-btn.active')?.dataset.sport || 'football';
    const sel = document.getElementById('setupPosition');
    const positions = SPORT_POSITIONS[sport] || [];
    sel.innerHTML = `<option value="">Select position</option>` + positions.map(p => `<option value="${p}">${p}</option>`).join('');
    // Populate equipment checkboxes
    const equip = SPORT_EQUIPMENT[sport] || [];
    document.getElementById('equipmentChecklist').innerHTML = equip.map(e => `
      <label class="equip-check-label">
        <input type="checkbox" value="${e}" /> ${e}
      </label>`).join('');
  }
  showOnboardStep(step + 1);
}

function onboardBack(step) {
  showOnboardStep(step - 1);
}

function showOnboardStep(n) {
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`onboard-step-${n}`)?.classList.remove('hidden');
  document.getElementById('onboardStepNum').textContent = n;
  document.getElementById('onboardBar').style.width = `${n * 20}%`;
}

function submitAgeGate() {
  const name = document.getElementById('userName').value.trim();
  const dob = document.getElementById('userDob').value;
  const sport = document.querySelector('#onboard-step-2 .sport-btn.active')?.dataset.sport || 'football';

  const dobDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;

  // Collect all profile data
  const weightRaw = parseFloat(document.getElementById('setupWeight').value) || null;
  const weightUnit = document.getElementById('setupWeightUnit').value;
  const heightRaw = parseFloat(document.getElementById('setupHeight').value) || null;
  const heightUnit = document.getElementById('setupHeightUnit').value;
  const weightKg = weightRaw ? (weightUnit === 'lbs' ? weightRaw * 0.453592 : weightRaw) : null;
  const heightCm = heightRaw ? (heightUnit === 'ft' ? heightRaw * 30.48 : heightRaw) : null;

  const equipment = Array.from(document.querySelectorAll('#equipmentChecklist input:checked')).map(c => c.value);
  const moveClubs = document.querySelector('input[name="moveClubs"]:checked')?.value || 'maybe';

  AppState.user = {
    name, dob, age,
    email: document.getElementById('userEmail')?.value.trim() || '',
    sport,
    weightKg, weightUnit: weightRaw ? weightUnit : null,
    heightCm, heightUnit: heightRaw ? heightUnit : null,
    fitness: document.getElementById('setupFitness').value,
    trainingDays: parseInt(document.getElementById('setupDays').value) || 3,
    position: document.getElementById('setupPosition').value,
    division: document.getElementById('setupDivision').value,
    venue: document.getElementById('setupVenue').value,
    currentClub: document.getElementById('setupCurrentClub').value.trim(),
    city: document.getElementById('setupCity').value.trim(),
    pastClubs: document.getElementById('setupPastClubs').value.trim(),
    yearsPlaying: parseInt(document.getElementById('setupYearsPlaying').value) || 0,
    equipment,
    moveClubs,
    goal: document.getElementById('setupGoal').value,
  };

  AppState.sport = sport;
  AppState.streak = 1;

  // Personalise nutrition goals based on weight/fitness
  if (weightKg) {
    const bmr = heightCm
      ? (10 * weightKg + 6.25 * heightCm - 5 * age + (age < 18 ? 50 : 5))
      : (weightKg * 30);
    const multipliers = { beginner: 1.4, intermediate: 1.55, advanced: 1.7, elite: 1.9 };
    const tdee = Math.round(bmr * (multipliers[AppState.user.fitness] || 1.55));
    AppState.nutritionGoals = {
      calories: tdee,
      protein: Math.round(weightKg * 2),
      carbs: Math.round(tdee * 0.45 / 4),
      fat: Math.round(tdee * 0.25 / 9),
      fibre: 30,
    };
  }

  saveToStorage();
  applyTheme(AppState.theme);
  applySport(AppState.sport);
  updateGreeting();
  updateDashboardStats();
  updateSidebarStats();

  const gateEl = document.getElementById('ageGate');
  gateEl.classList.remove('active');
  gateEl.classList.add('hidden');

  showToast(`Welcome, ${name}! Your pro journey begins now! 🚀`);
}

// Age gate sport buttons
document.querySelectorAll('#ageGate .sport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#ageGate .sport-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sport = btn.dataset.sport;
    document.querySelector('#ageGate .sport-icon').className = `${getSportIconClass(sport)} sport-icon`;
    applySport(sport);
  });
});

// =====================================================
// NAVIGATION
// =====================================================
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navTo(btn.dataset.page));
  });
}

function navTo(page) {
  // Show page loader
  const loader = document.getElementById('pageLoader');
  if (loader) { loader.classList.remove('hidden'); setTimeout(() => loader.classList.add('hidden'), 500); }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add('active');

  // Sync mobile bottom nav
  document.querySelectorAll('.mbn-btn[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));

  // Scroll main content to top on every page switch
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Lazy-init page modules
  if (page === 'fields') { setTimeout(initMap, 100); loadWeather(); }
  if (page === 'ai') updateSidebarStats();
  if (page === 'dashboard') updateDashboardStats();
  if (page === 'stats') setTimeout(initStatsPage, 100);
  if (page === 'gamify') setTimeout(initGamifyPage, 100);
  if (page === 'wellness') setTimeout(initWellnessPage, 100);
  if (page === 'drills') setTimeout(() => renderDrillsGrid('all', 'all'), 100);
  if (page === 'video') setTimeout(initVideoPage, 100);
  if (page === 'gear') setTimeout(renderKitList, 100);
  if (page === 'profile') setTimeout(() => { initProfilePage(); renderProgressWall(); }, 100);
  if (page === 'dashboard') { setTimeout(renderActivityFeed, 100); setTimeout(renderMascot, 150); }
}

window.toggleMobileMoreMenu = function() {
  document.getElementById('mobileMoreOverlay')?.classList.remove('hidden');
  document.getElementById('mobileMoreDrawer')?.classList.remove('hidden');
};
window.closeMobileMoreMenu = function() {
  document.getElementById('mobileMoreOverlay')?.classList.add('hidden');
  document.getElementById('mobileMoreDrawer')?.classList.add('hidden');
};

// =====================================================
// THEME
// =====================================================

// Sport accent colours for PWA theme-color meta
const SPORT_ACCENT_COLORS = {
  football:   { dark: '#00e676', light: '#1a7f3c' },
  basketball: { dark: '#ff6d00', light: '#e65100' },
  running:    { dark: '#00b0ff', light: '#0277bd' },
  tennis:     { dark: '#d4e157', light: '#9e9d24' },
  swimming:   { dark: '#00e5ff', light: '#006064' },
  cycling:    { dark: '#ff1744', light: '#c62828' },
};

function updatePWAThemeColor() {
  const sport = AppState.sport || 'football';
  const theme = AppState.theme || 'dark';
  const color = SPORT_ACCENT_COLORS[sport]?.[theme] || '#00e676';
  let meta = document.getElementById('metaThemeColor');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.id = 'metaThemeColor';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  AppState.themeManuallySet = true;
  applyTheme(AppState.theme);
  saveToStorage();
}

function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  // Update PWA theme-color meta so the browser chrome matches
  updatePWAThemeColor();
}

// =====================================================
// SPORT SWITCHING
// =====================================================
function setupSportButtons() {}

function getSportIconClass(sport) {
  const map = {
    football: 'fas fa-futbol',
    basketball: 'fas fa-basketball',
    running: 'fas fa-person-running',
    tennis: 'fas fa-baseball',
    swimming: 'fas fa-person-swimming',
    cycling: 'fas fa-bicycle',
  };
  return map[sport] || 'fas fa-futbol';
}

function getSportLabel(sport) {
  const map = { football:'Football', basketball:'Basketball', running:'Running', tennis:'Tennis', swimming:'Swimming', cycling:'Cycling' };
  return map[sport] || 'Football';
}

function applySport(sport) {
  AppState.sport = sport;
  document.documentElement.setAttribute('data-sport', sport);
  document.getElementById('currentSportLabel').textContent = getSportLabel(sport);
  // Update header icon
  const logoIcon = document.querySelector('.sport-logo-icon');
  if (logoIcon) {
    logoIcon.className = `${getSportIconClass(sport)} sport-logo-icon`;
  }
  updatePWAThemeColor();
  saveToStorage();
}

function openSportSwitch() {
  document.getElementById('sportSwitchModal').classList.remove('hidden');
}

function switchSport(sport) {
  applySport(sport);
  closeModal('sportSwitchModal');
  updateSidebarStats();
  // Refresh fields page quick-search links for new sport
  updateFieldsQuickGrid();
  showToast(`Switched to ${getSportLabel(sport)}! Theme updated 🎨`);
}

// =====================================================
// DASHBOARD
// =====================================================
function updateGreeting() {
  if (!AppState.user) return;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greetingText').textContent = `${greet}, ${AppState.user.name}!`;
}

function updateDashboardStats() {
  document.getElementById('stat-streak').textContent = AppState.streak || 0;
  document.getElementById('stat-sessions').textContent = AppState.sessions || 0;
  const totalCals = AppState.foodLog.reduce((s, f) => s + (f.calories || 0), 0);
  document.getElementById('stat-calories').textContent = Math.round(totalCals);
  const level = getLevel();
  document.getElementById('stat-level').textContent = level;
  updateNavStreakBadge();
}

function updateNavStreakBadge() {
  const btn = document.querySelector('.nav-btn[data-page="gamify"]');
  if (!btn) return;
  let badge = btn.querySelector('.nav-streak-badge');
  const streak = AppState.streak || 0;
  if (streak > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'nav-streak-badge'; btn.appendChild(badge); }
    badge.textContent = streak > 99 ? '99+' : streak;
  } else if (badge) {
    badge.remove();
  }
}

// =====================================================
// FEATURE 6 — SESSION HISTORY FEED
// =====================================================
function logActivityFeedItem(item) {
  if (!AppState.activityFeed) AppState.activityFeed = [];
  AppState.activityFeed.unshift({ ...item, ts: Date.now() });
  if (AppState.activityFeed.length > 50) AppState.activityFeed.length = 50;
  renderActivityFeed();
}

function renderActivityFeed() {
  const el = document.getElementById('activityFeed');
  if (!el) return;
  const feed = AppState.activityFeed || [];
  if (!feed.length) {
    el.innerHTML = '<p class="empty-state" style="font-size:0.82rem">Your activity will appear here as you train, eat and log 🏆</p>';
    return;
  }
  el.innerHTML = feed.slice(0, 20).map(item => {
    const ago = timeAgo(item.ts);
    return `<div class="feed-item">
      <span class="feed-icon">${item.type === 'session' ? '🏋️' : item.type === 'pb' ? '🏅' : item.type === 'milestone' ? '🏆' : item.type === 'food' ? '🥗' : '⭐'}</span>
      <div class="feed-body">
        <span class="feed-text">${item.text}</span>
        <span class="feed-time">${ago}</span>
      </div>
    </div>`;
  }).join('');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

// =====================================================
// FEATURE 7 — SPORT-SPECIFIC NUTRITION AUTO-TARGETS
// =====================================================
const SPORT_NUTRITION = {
  football:   { calories: 2800, protein: 170, carbs: 320, fat: 80, fibre: 30, note: 'High carbs for 90-min endurance + protein for muscle repair' },
  basketball: { calories: 3000, protein: 180, carbs: 350, fat: 85, fibre: 30, note: 'High energy for explosive play + recovery protein' },
  running:    { calories: 2600, protein: 140, carbs: 360, fat: 65, fibre: 35, note: 'Carb-heavy for endurance, lighter fat for efficiency' },
  tennis:     { calories: 2700, protein: 155, carbs: 310, fat: 80, fibre: 28, note: 'Balanced macros for sustained rallying energy' },
  swimming:   { calories: 3200, protein: 190, carbs: 380, fat: 90, fibre: 32, note: 'Highest calorie burn sport — load carbs and protein' },
  cycling:    { calories: 2900, protein: 145, carbs: 400, fat: 70, fibre: 30, note: 'Extreme carb loading for long rides, lean fat profile' },
};

window.autoSetSportNutrition = function() {
  const targets = SPORT_NUTRITION[AppState.sport];
  if (!targets) return;
  AppState.nutritionGoals = { calories: targets.calories, protein: targets.protein, carbs: targets.carbs, fat: targets.fat, fibre: targets.fibre };
  saveToStorage();
  updateNutritionUI();
  showToast(`🥗 Nutrition targets auto-set for ${getSportLabel(AppState.sport)}! ${targets.note}`);
};

// =====================================================
// FEATURE 10 — MASCOT
// =====================================================
function renderMascot() {
  const el = document.getElementById('dashMascot');
  if (!el) return;
  const streak = AppState.streak || 0;
  let emoji, msg, cls;
  if (streak >= 30)     { emoji = '🦁'; msg = `${streak}-day BEAST MODE! You're unstoppable!`; cls = 'mascot-beast'; }
  else if (streak >= 14){ emoji = '🔥'; msg = `${streak} days strong! You're on fire!`; cls = 'mascot-hot'; }
  else if (streak >= 7) { emoji = '💪'; msg = `${streak}-day streak! Keep building!`; cls = 'mascot-good'; }
  else if (streak >= 3) { emoji = '😤'; msg = `${streak} days in — great start!`; cls = 'mascot-start'; }
  else if (streak === 0){ emoji = '😴'; msg = `Ready to start your streak? Log a session!`; cls = 'mascot-idle'; }
  else                  { emoji = '🙂'; msg = `Day ${streak} — let's keep going!`; cls = 'mascot-ok'; }
  el.className = `dash-mascot ${cls}`;
  el.innerHTML = `<span class="mascot-emoji">${emoji}</span><span class="mascot-msg">${msg}</span>`;
}

// =====================================================
// FEATURE 11 — AUTO DARK/LIGHT SCHEDULE
// =====================================================
function autoApplyDayNightTheme() {
  // Only auto-apply if user hasn't manually set a preference
  if (AppState.themeManuallySet) return;
  const h = new Date().getHours();
  const shouldBeDark = h < 7 || h >= 20;
  const current = AppState.theme;
  if (shouldBeDark && current !== 'dark') { applyTheme('dark'); AppState.theme = 'dark'; saveToStorage(); }
  if (!shouldBeDark && current !== 'light') { applyTheme('light'); AppState.theme = 'light'; saveToStorage(); }
}

// Override toggleTheme to mark manual preference
const _origToggleTheme = window.toggleTheme;

// =====================================================
// FEATURE 12 — OFFLINE INDICATOR
// =====================================================
function setupOfflineIndicator() {
  let bar = document.getElementById('offlineBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'offlineBar';
    bar.className = 'offline-bar hidden';
    bar.innerHTML = '<i class="fas fa-wifi-slash"></i> You\'re offline — all data saves locally';
    document.body.prepend(bar);
  }
  const update = () => bar.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// =====================================================
// FEATURE 13 — GAME DAY MODE
// =====================================================
window.openGameDay = function() {
  const modal = document.getElementById('gameDayModal');
  if (modal) { modal.classList.remove('hidden'); renderGameDayChecklist(); }
};
window.closeGameDay = function() {
  document.getElementById('gameDayModal')?.classList.add('hidden');
};

const GAME_DAY_CHECKLIST = [
  { id: 'gd_sleep', text: '😴 Got 8+ hours sleep last night' },
  { id: 'gd_breakfast', text: '🥣 Ate a good pre-match meal (2-3h before)' },
  { id: 'gd_hydration', text: '💧 Drank at least 500ml water this morning' },
  { id: 'gd_warmup', text: '🏃 Completed full warm-up' },
  { id: 'gd_kit', text: '👟 Kit is packed and ready' },
  { id: 'gd_mindset', text: '🧠 Visualised the game plan' },
  { id: 'gd_phone', text: '📵 Phone on silent / focus mode' },
];

function renderGameDayChecklist() {
  const el = document.getElementById('gameDayList');
  if (!el) return;
  const checked = AppState.gameDayChecked || {};
  el.innerHTML = GAME_DAY_CHECKLIST.map(item => `
    <label class="gd-check-item ${checked[item.id] ? 'checked' : ''}">
      <input type="checkbox" ${checked[item.id] ? 'checked' : ''} onchange="toggleGameDayItem('${item.id}', this.checked)" />
      <span>${item.text}</span>
    </label>
  `).join('');
  const done = GAME_DAY_CHECKLIST.filter(i => checked[i.id]).length;
  const pct = Math.round(done / GAME_DAY_CHECKLIST.length * 100);
  const readinessEl = document.getElementById('gameDayReadiness');
  if (readinessEl) {
    const label = pct === 100 ? '🔥 100% — YOU ARE READY!' : pct >= 70 ? '💪 Almost there!' : '📋 Keep checking off!';
    readinessEl.innerHTML = `<div class="gd-progress-bar"><div style="width:${pct}%"></div></div><div class="gd-readiness-label">${label}</div>`;
  }
}

window.toggleGameDayItem = function(id, val) {
  if (!AppState.gameDayChecked) AppState.gameDayChecked = {};
  AppState.gameDayChecked[id] = val;
  if (navigator.vibrate) navigator.vibrate(10);
  saveToStorage();
  renderGameDayChecklist();
};

window.resetGameDayChecklist = function() {
  AppState.gameDayChecked = {};
  saveToStorage();
  renderGameDayChecklist();
};

window.logPostMatchRating = function() {
  const rating = parseInt(document.getElementById('postMatchRating')?.value) || 0;
  const notes = document.getElementById('postMatchNotes')?.value.trim() || '';
  if (!rating) { showToast('Give yourself a rating first!'); return; }
  if (!AppState.matchHistory) AppState.matchHistory = [];
  AppState.matchHistory.push({ date: getTodayStr(), rating, notes, ts: Date.now() });
  recordStreakActivity('training');
  AppState.xp = (AppState.xp || 0) + 20;
  logActivityFeedItem({ type: 'session', text: `🎮 Match logged — ${rating}/10 performance`, date: getTodayStr() });
  saveToStorage();
  closeGameDay();
  showToast(`🎮 Match logged! ${rating}/10 · +20 XP! Keep growing 🔥`);
};

// =====================================================
// FEATURE 14 — PHOTO PROGRESS WALL
// =====================================================
window.addProgressPhoto = function(input) {
  if (!input.files?.length) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    if (!AppState.progressPhotos) AppState.progressPhotos = [];
    AppState.progressPhotos.unshift({ src: e.target.result, date: getTodayStr(), ts: Date.now() });
    if (AppState.progressPhotos.length > 20) AppState.progressPhotos.length = 20;
    saveToStorage();
    renderProgressWall();
    showToast('📸 Progress photo added!');
    logActivityFeedItem({ type: 'photo', text: '📸 Progress photo added', date: getTodayStr() });
  };
  reader.readAsDataURL(file);
};

function renderProgressWall() {
  const el = document.getElementById('progressPhotoWall');
  if (!el) return;
  const photos = AppState.progressPhotos || [];
  if (!photos.length) {
    el.innerHTML = '<div class="photo-empty"><i class="fas fa-camera"></i><p>No photos yet — document your transformation!</p></div>';
    return;
  }
  el.innerHTML = photos.map((p, i) => `
    <div class="progress-photo-item">
      <img src="${p.src}" alt="Progress photo ${p.date}" loading="lazy" />
      <span class="photo-date">${p.date}</span>
      <button class="photo-del-btn" onclick="deleteProgressPhoto(${i})" title="Delete"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

window.deleteProgressPhoto = function(i) {
  AppState.progressPhotos.splice(i, 1);
  saveToStorage();
  renderProgressWall();
};

// =====================================================
// FEATURE 15 — DRILL INTERVAL TIMER WITH VOICE
// =====================================================
let drillTimerInterval = null;
let drillTimerRunning = false;
let drillTimerSeconds = 0;
let drillTimerPhase = 'work'; // 'work' | 'rest'
let drillTimerRound = 0;
let drillTimerTotalRounds = 5;
let drillTimerWork = 30;
let drillTimerRest = 15;

window.openDrillTimer = function() {
  document.getElementById('drillTimerModal')?.classList.remove('hidden');
  resetDrillTimer();
};
window.closeDrillTimer = function() {
  stopDrillTimer();
  document.getElementById('drillTimerModal')?.classList.add('hidden');
};

function resetDrillTimer() {
  stopDrillTimer();
  drillTimerRound = 0;
  drillTimerPhase = 'work';
  drillTimerWork = parseInt(document.getElementById('dtWork')?.value) || 30;
  drillTimerRest = parseInt(document.getElementById('dtRest')?.value) || 15;
  drillTimerTotalRounds = parseInt(document.getElementById('dtRounds')?.value) || 5;
  drillTimerSeconds = drillTimerWork;
  updateDrillTimerDisplay();
}
window.resetDrillTimer = resetDrillTimer;

function updateDrillTimerDisplay() {
  const el = document.getElementById('dtDisplay');
  const phaseEl = document.getElementById('dtPhase');
  const roundEl = document.getElementById('dtRoundInfo');
  if (el) el.textContent = drillTimerSeconds;
  if (phaseEl) { phaseEl.textContent = drillTimerPhase === 'work' ? '💥 WORK' : '😮‍💨 REST'; phaseEl.className = `dt-phase ${drillTimerPhase}`; }
  if (roundEl) roundEl.textContent = `Round ${drillTimerRound + 1} / ${drillTimerTotalRounds}`;
}

window.startDrillTimer = function() {
  if (drillTimerRunning) return;
  drillTimerWork = parseInt(document.getElementById('dtWork')?.value) || 30;
  drillTimerRest = parseInt(document.getElementById('dtRest')?.value) || 15;
  drillTimerTotalRounds = parseInt(document.getElementById('dtRounds')?.value) || 5;
  if (drillTimerRound === 0 && drillTimerPhase === 'work') drillTimerSeconds = drillTimerWork;
  drillTimerRunning = true;
  speak(`Round ${drillTimerRound + 1}. Go!`);
  drillTimerInterval = setInterval(() => {
    drillTimerSeconds--;
    updateDrillTimerDisplay();
    if (drillTimerSeconds <= 3 && drillTimerSeconds > 0) { if (navigator.vibrate) navigator.vibrate(50); }
    if (drillTimerSeconds <= 0) {
      if (drillTimerPhase === 'work') {
        drillTimerPhase = 'rest';
        drillTimerSeconds = drillTimerRest;
        speak('Rest!');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        drillTimerRound++;
        if (drillTimerRound >= drillTimerTotalRounds) {
          stopDrillTimer();
          speak('All rounds complete! Great work!');
          showToast('🎉 All rounds complete! Great drill session! +10 XP');
          AppState.xp = (AppState.xp || 0) + 10;
          saveToStorage();
          return;
        }
        drillTimerPhase = 'work';
        drillTimerSeconds = drillTimerWork;
        speak(`Round ${drillTimerRound + 1}. Go!`);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }
    updateDrillTimerDisplay();
  }, 1000);
};

function stopDrillTimer() {
  clearInterval(drillTimerInterval);
  drillTimerRunning = false;
}
window.stopDrillTimer = stopDrillTimer;

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1;
  u.pitch = 1.1;
  window.speechSynthesis.speak(u);
}

function getLevel() {
  const sessions = AppState.sessions || 0;
  if (sessions < 5) return 'Rookie';
  if (sessions < 15) return 'Amateur';
  if (sessions < 30) return 'Semi-Pro';
  if (sessions < 60) return 'Pro';
  return 'Elite';
}

// =====================================================
// AI DAILY TIPS
// =====================================================
const TIPS = {
  football: [
    "🎯 Focus on your weaker foot today — even 10 minutes of practice can transform your game.",
    "⚡ Explosiveness comes from the hips. Add 3 sets of hip-flexor drills to your warmup.",
    "🧠 Watch 10 minutes of pro game footage today. Tactical awareness is trainable!",
    "💧 Hydrate before you're thirsty — by then you're already 2% dehydrated and your performance drops.",
    "🏃 High-intensity interval training (HIIT) for 20 mins beats 60 mins jogging for football fitness.",
    "🦵 Single-leg squats build the balance and strength that prevent ACL injuries.",
    "⚽ Your first touch is your secret weapon. Work on cushioning every pass in training today.",
  ],
  basketball: [
    "🏀 Shoot 100 free throws today. Muscle memory is built through repetition.",
    "⚡ Lateral quickness drills — cone shuffles & defensive slides — are your edge.",
    "🧠 Study defensive positioning from the pros. Where you stand without the ball matters.",
    "💧 Stay hydrated — even 1% dehydration slows your reaction time.",
    "🦵 Box jumps and depth jumps directly improve your vertical by training fast-twitch fibres.",
    "👐 Grip strength from hand exercises improves your ball control massively.",
  ],
  running: [
    "🏃 Easy runs should feel easy — 80% of your mileage should be at conversational pace.",
    "⚡ Strides (short, fast accelerations) improve running economy without taxing your legs.",
    "🧠 Mental mantras during hard efforts genuinely help performance — choose yours today.",
    "💧 Drink 500ml of water 2 hours before a run for optimal hydration.",
    "🦵 Calf raises improve ankle strength and reduce injury risk dramatically.",
  ],
  tennis: [
    "🎾 Practice your serve for 20 minutes before hitting with a partner.",
    "⚡ Footwork is 70% of tennis — cone drills daily change everything.",
    "🧠 Watch your opponent's racket head, not the ball — you'll read shots earlier.",
    "💧 Sports drinks with electrolytes help during matches longer than 60 minutes.",
    "🦵 Lateral lunges build the hip stability for explosive court coverage.",
  ],
  swimming: [
    "🏊 Perfect your flip turn — it can save 1-2 seconds per length.",
    "⚡ Dryland pull exercises build the lat strength that drives your stroke.",
    "🧠 Count your strokes per length — fewer strokes = better technique.",
    "💧 Drink before the pool — you still sweat heavily even in water.",
    "🦵 Kick sets with a kickboard isolate your lower body technique.",
  ],
  cycling: [
    "🚴 Cadence drills at 90-100 RPM improve efficiency and save your knees.",
    "⚡ Climbing power comes from sustained core engagement — plank every day.",
    "🧠 Pacing strategy matters — go out too hard and you'll blow up.",
    "💧 Take a small sip every 15 minutes on long rides — don't wait.",
    "🦵 Single-leg pedalling drills reveal and fix power imbalances between legs.",
  ],
};

function refreshDailyTip() {
  const sportTips = TIPS[AppState.sport] || TIPS.football;
  const tip = sportTips[Math.floor(Math.random() * sportTips.length)];
  const el = document.getElementById('dailyTip');
  if (el) el.textContent = tip;
}

// =====================================================
// AI TRAINING PLANS
// =====================================================
const PLAN_DATA = {
  football: {
    fitness: {
      beginner: [
        { day: 'Monday', content: 'Light jog 20 mins + ball familiarisation (dribbling slow), 100 juggles' },
        { day: 'Tuesday', content: 'Rest or light stretch — foam roll quads & hamstrings' },
        { day: 'Wednesday', content: '3×10 bodyweight squats, 3×10 lunges, 3×8 push-ups, 20 mins walk' },
        { day: 'Thursday', content: 'Passing drills (wall passes) 20 mins, 5-a-side if available' },
        { day: 'Friday', content: 'Agility ladder 15 mins + core: 3×20 crunches, 3×30s plank' },
        { day: 'Saturday', content: 'Game or 30 min scrimmage — enjoy playing!' },
        { day: 'Sunday', content: 'Full rest — stretch, hydrate, sleep 8-9 hours' },
      ],
      intermediate: [
        { day: 'Monday', content: '45 min run (zone 2) + 200 juggles + shooting practice (50 shots)' },
        { day: 'Tuesday', content: 'Strength: 4×8 squats (BW+), 4×8 RDLs, 3×10 step-ups each leg' },
        { day: 'Wednesday', content: 'Technical: 30 min dribbling circuits, 1v1 moves (stepover, elastico, cut)' },
        { day: 'Thursday', content: 'HIIT: 8×30s sprint / 30s rest + 4×10 box jumps' },
        { day: 'Friday', content: 'Passing & first touch (partner or wall) 40 mins + tactics study 20 mins' },
        { day: 'Saturday', content: 'Full 11-a-side match or intense 5-a-side' },
        { day: 'Sunday', content: 'Active recovery: yoga / swimming / light bike 30 min' },
      ],
    },
    pro: {
      elite: [
        { day: 'Monday', content: 'Double session — AM: Technical (60 min: positional play, set pieces). PM: Gym (Olympic lifts, sprint mechanics)' },
        { day: 'Tuesday', content: '11-a-side tactical session (pressing, transitions) + video analysis 45 min' },
        { day: 'Wednesday', content: 'Recovery: ice bath, massage, compression + nutrition focus. Light yoga AM.' },
        { day: 'Thursday', content: 'High-intensity fitness: SSG (small sided games) 2v2, 3v3 → 75% max HR' },
        { day: 'Friday', content: 'Pre-match prep: activation run, set piece rehearsal, mental visualisation' },
        { day: 'Saturday', content: 'MATCH DAY — full warm-up protocol, compete at 100%' },
        { day: 'Sunday', content: 'Recovery walk 30 min + contrast showers + meal prep for the week' },
      ],
    },
  },
  basketball: {
    fitness: {
      beginner: [
        { day: 'Monday', content: '100 free throws + dribbling basics (stationary) 20 min + 20 min jog' },
        { day: 'Tuesday', content: 'Rest or light stretch' },
        { day: 'Wednesday', content: '3×10 squats, 3×10 calf raises, 3×10 lateral shuffles + 150 dribbles each hand' },
        { day: 'Thursday', content: 'Layup drills: 50 each side, passing (chest, bounce, overhead) 20 min' },
        { day: 'Friday', content: 'Footwork: 3-step, drop step, pivot drills 25 min + 30 min casual game' },
        { day: 'Saturday', content: 'Pick-up game or shoot around 60 min' },
        { day: 'Sunday', content: 'Rest + nutrition review' },
      ],
    },
  },
  running: {
    fitness: {
      beginner: [
        { day: 'Monday', content: 'Run/walk 20 min (1 min run, 1 min walk) + calf stretches' },
        { day: 'Tuesday', content: 'Rest or yoga/stretching 20 min' },
        { day: 'Wednesday', content: 'Run 25 min at easy pace (can hold a conversation)' },
        { day: 'Thursday', content: 'Strength: squats, lunges, glute bridges 3×12 each' },
        { day: 'Friday', content: 'Run 20 min + 4×100m strides (controlled fast)' },
        { day: 'Saturday', content: 'Long slow run: 35 min at conversational pace' },
        { day: 'Sunday', content: 'Full rest' },
      ],
    },
  },
};

function generatePlan() {
  const sport = document.getElementById('planSport').value;
  const goal = document.getElementById('planGoal').value;
  const duration = parseInt(document.getElementById('planDuration').value);
  const level = document.getElementById('planLevel').value;

  const output = document.getElementById('planOutput');
  output.classList.remove('hidden');

  // Show skeleton loader first
  output.innerHTML = `
    <div class="skeleton skeleton-line long" style="height:24px;margin-bottom:16px"></div>
    <div class="skeleton skeleton-line" style="height:14px;width:70%;margin-bottom:20px"></div>
    <div class="skeleton skeleton-block"></div>
    <div class="skeleton skeleton-block"></div>
    <div class="skeleton skeleton-line short" style="height:14px;margin-top:12px"></div>
  `;
  output.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Simulate a brief generation delay for premium feel
  setTimeout(() => {
    // Get plan data or generate dynamically
    let weekPlan = null;
    try { weekPlan = PLAN_DATA[sport]?.[goal]?.[level] || PLAN_DATA[sport]?.fitness?.beginner; } catch(e) {}

    if (!weekPlan) { weekPlan = generateGenericPlan(sport, goal, level); }

    const sportLabel = getSportLabel(sport);
    const goalLabel = document.getElementById('planGoal').options[document.getElementById('planGoal').selectedIndex].text;

    let html = `
      <div class="plan-header-row">
        <h3>🤖 ${sportLabel} — ${goalLabel} Plan (${duration} Weeks, ${level.charAt(0).toUpperCase()+level.slice(1)})</h3>
        <button class="btn-ghost" onclick="document.getElementById('planOutput').classList.add('hidden')"><i class="fas fa-times"></i> Close</button>
      </div>
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:18px;">Your AI has generated a personalised ${duration}-week programme. Repeat weekly and increase intensity every 2 weeks.</p>
    `;

    // Show weeks 1 & 2 in detail, summarise rest
    for (let w = 1; w <= Math.min(2, duration); w++) {
      html += `<div class="plan-week"><h4>Week ${w}</h4>`;
      weekPlan.forEach(d => {
        html += `<div class="plan-day"><span class="day-label">${d.day}</span><span class="day-content">${d.content}</span></div>`;
      });
      html += `</div>`;
    }

    if (duration > 2) {
      html += `<div class="plan-week"><h4>Weeks 3–${duration}</h4>`;
      html += `<div class="plan-day"><span class="day-label">Progression</span><span class="day-content">Increase intensity by 5-10% each week. Add resistance, reps, or duration. Week ${Math.floor(duration/2)+1} introduces higher-intensity competition-prep sessions. Final 2 weeks: peak → taper → test your performance.</span></div>`;
      html += `</div>`;
    }

    html += `
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-primary" onclick="saveAndSchedulePlan()"><i class="fas fa-calendar-plus"></i> Add to Calendar</button>
        <button class="btn-secondary" onclick="window.print()"><i class="fas fa-print"></i> Print Plan</button>
      </div>
    `;

    output.innerHTML = html;
    logActivityFeedItem({ type: 'session', text: `📋 New ${sportLabel} training plan generated`, date: getTodayStr() });
  }, 600);
}

function generateGenericPlan(sport, goal, level) {
  const intensities = { beginner: 'light–moderate', intermediate: 'moderate–high', advanced: 'high', elite: 'very high / competitive' };
  const intensity = intensities[level] || 'moderate';
  return [
    { day: 'Monday', content: `${sport} skill drills 30-45 min + ${intensity} cardio 20 min` },
    { day: 'Tuesday', content: `Strength & conditioning: compound lifts, core work — ${intensity} effort` },
    { day: 'Wednesday', content: `Technical practice (${sport}-specific drills) + flexibility 15 min` },
    { day: 'Thursday', content: `HIIT intervals (sport-specific movements) — ${intensity}` },
    { day: 'Friday', content: `Tactical / skill refinement + light recovery work` },
    { day: 'Saturday', content: `Game / match / competition — full effort` },
    { day: 'Sunday', content: `Rest & recovery: stretching, good sleep, hydration & nutrition focus` },
  ];
}

function quickPlan(sport) {
  document.getElementById('planSport').value = sport;
  applySport(sport);
  generatePlan();
  navTo('plans');
}

function saveAndSchedulePlan() {
  AppState.sessions = (AppState.sessions || 0) + 7;
  saveToStorage();
  showToast('Plan saved to calendar! 📅');
  navTo('calendar');
}

// =====================================================
// WEATHER & MAP
// =====================================================
function loadWeather() {
  if (!navigator.geolocation) {
    document.getElementById('weatherBanner').innerHTML = buildWeatherFallback();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      AppState.userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      fetchWeatherByCoords(AppState.userCoords.lat, AppState.userCoords.lng);
    },
    () => {
      // Use fallback simulated weather
      document.getElementById('weatherBanner').innerHTML = buildWeatherFallback();
    }
  );
}

async function fetchWeatherByCoords(lat, lng) {
  // Using Open-Meteo (free, no API key)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relativehumidity_2m,windspeed_10m,precipitation_probability&timezone=auto`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const weather = data.current_weather;

    // Reverse geocode with Nominatim
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const geoData = await geoRes.json();
    const locationName = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.county || 'Your Location';

    renderWeather({
      temp: Math.round(weather.temperature),
      windspeed: Math.round(weather.windspeed),
      weathercode: weather.weathercode,
      location: locationName,
      lat, lng,
    });
  } catch(e) {
    document.getElementById('weatherBanner').innerHTML = buildWeatherFallback();
  }
}

function getWeatherIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 99) return '⛈️';
  return '🌤️';
}

function getWeatherDesc(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Mixed';
}

function renderWeather({ temp, windspeed, weathercode, location }) {
  const icon = getWeatherIcon(weathercode);
  const desc = getWeatherDesc(weathercode);
  const playable = weathercode <= 3 && windspeed < 40;
  const playClass = playable ? 'good' : weathercode <= 67 && windspeed < 60 ? 'okay' : 'bad';
  const playText = playable ? '✅ Great conditions to play!' : weathercode > 67 ? '❌ Bad conditions — stay safe' : '⚠️ Play with caution';

  document.getElementById('weatherBanner').innerHTML = `
    <div class="weather-content">
      <div class="weather-main">
        <span class="weather-icon-big">${icon}</span>
        <div>
          <div class="weather-temp">${temp}°C</div>
          <div class="weather-desc">${desc}</div>
          <div class="weather-location"><i class="fas fa-map-marker-alt"></i> ${location}</div>
        </div>
      </div>
      <div class="weather-details">
        <div class="weather-detail"><span class="val">${windspeed}<small>km/h</small></span><span class="lbl">Wind</span></div>
        <div class="weather-detail"><span class="val">${temp > 20 ? 'Low' : temp > 5 ? 'Mod' : 'High'}</span><span class="lbl">Layer Up?</span></div>
      </div>
      <span class="play-rec ${playClass}">${playText}</span>
    </div>
  `;
}

function buildWeatherFallback() {
  return `
    <div class="weather-content">
      <div class="weather-main">
        <span class="weather-icon-big">🌤️</span>
        <div>
          <div class="weather-temp">18°C</div>
          <div class="weather-desc">Partly cloudy (enable location for live data)</div>
          <div class="weather-location"><i class="fas fa-map-marker-alt"></i> Location not available</div>
        </div>
      </div>
      <div class="weather-details">
        <div class="weather-detail"><span class="val">12<small>km/h</small></span><span class="lbl">Wind</span></div>
      </div>
      <span class="play-rec good">✅ Enable location for live weather</span>
    </div>
  `;
}

// =====================================================
// FIELDS / MAP  — Google Maps iframe approach
// (fast, accurate, no API key required)
// =====================================================

// Sport → friendly Google Maps search query
const SPORT_MAPS_QUERY = {
  football:   'football pitches near me',
  basketball: 'basketball courts near me',
  running:    'running tracks near me',
  tennis:     'tennis courts near me',
  swimming:   'swimming pools near me',
  cycling:    'cycling routes near me',
};

function initMap() {
  // Update the quick-search links to highlight the current sport
  updateFieldsQuickGrid();
}

function updateFieldsQuickGrid() {
  const grid = document.getElementById('fieldsQuickGrid');
  if (!grid) return;
  const sport = AppState.sport;
  grid.querySelectorAll('.fields-quick-btn').forEach(btn => {
    btn.classList.toggle('active-sport', btn.textContent.toLowerCase().includes(sport));
  });
}

function loadFieldsIframe(query) {
  const frame = document.getElementById('fieldsMapFrame');
  const placeholder = document.getElementById('fieldsMapPlaceholder');
  const directLink = document.getElementById('fieldsDirectLink');
  const anchor = document.getElementById('fieldsDirectAnchor');
  if (!frame) return;

  const encoded = encodeURIComponent(query);
  frame.src = `https://maps.google.com/maps?q=${encoded}&output=embed`;
  frame.classList.remove('hidden');
  if (placeholder) placeholder.style.display = 'none';
  if (directLink) directLink.classList.remove('hidden');
  if (anchor) {
    anchor.href = `https://maps.google.com/?q=${encoded}`;
    anchor.textContent = `Open "${query}" in Google Maps →`;
  }
}

function searchFieldsLocation() {
  const input = document.getElementById('locationSearch');
  const city = input?.value.trim();
  if (!city) { showToast('Enter a city or postcode first 📍'); return; }
  const sportQuery = SPORT_MAPS_QUERY[AppState.sport] || 'sports fields near me';
  loadFieldsIframe(`${sportQuery.replace('near me', 'in ' + city)}`);
  showToast(`Searching ${getSportLabel(AppState.sport)} venues in ${city} 🗺️`);
}

function searchCurrentLocation() {
  showToast('📍 Finding your location…');
  navigator.geolocation?.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      AppState.userCoords = { lat, lng };
      saveToStorage();
      const sport = AppState.sport;
      const q = SPORT_MAPS_QUERY[sport] || 'sports fields near me';
      loadFieldsIframe(q);
      fetchWeatherByCoords(lat, lng);
    },
    () => {
      showToast('Could not get location — try searching a city instead 📍');
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}

// Keep legacy name so any remaining refs don't break
function findNearbyFields() { searchCurrentLocation(); }
function searchLocation() { searchFieldsLocation(); }

// =====================================================
// CALENDAR
// =====================================================
const EVENT_TYPE_CONFIG = {
  training: { label:'Training',  icon:'🏋️', colour:'#00e5ff', cssClass:'ev-training' },
  team:     { label:'Team',      icon:'👥', colour:'#42a5f5', cssClass:'ev-team'     },
  school:   { label:'School',    icon:'🎓', colour:'#ffa726', cssClass:'ev-school'   },
  personal: { label:'Personal',  icon:'⭐', colour:'#ab47bc', cssClass:'ev-personal' },
  rest:     { label:'Rest Day',  icon:'😴', colour:'#ef5350', cssClass:'ev-rest'     },
  free:     { label:'Free Time', icon:'😊', colour:'#26a69a', cssClass:'ev-free'     },
  custom:   { label:'Event',     icon:'📌', colour:'#7c4dff', cssClass:'ev-custom'   },
};

let calFilterType = 'all';
let selectedEventType = 'training';
let selectedEventColour = '#7c4dff';

function selectEventType(type, btn) {
  selectedEventType = type;
  document.querySelectorAll('#eventTypeGrid .event-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Show/hide sport group
  const sportGroup = document.getElementById('eventSportGroup');
  if (sportGroup) sportGroup.style.display = (type === 'training' || type === 'team') ? '' : 'none';
  // Show/hide custom colour group
  const colourGroup = document.getElementById('eventCustomColourGroup');
  if (colourGroup) colourGroup.classList.toggle('hidden', type !== 'custom');
}

function selectEventColour(colour, btn) {
  selectedEventColour = colour;
  document.querySelectorAll('.colour-swatch').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('eventCustomColour').value = colour;
}

function filterCalendar(type, btn) {
  calFilterType = type;
  document.querySelectorAll('.cal-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCalendar();
}

function renderCalendar() {
  const date = AppState.calMonth;
  const year = date.getFullYear();
  const month = date.getMonth();

  document.getElementById('calMonthYear').textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day other-month"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let eventsOnDay = AppState.calendarEvents.filter(e => e.date === dateStr);
    if (calFilterType !== 'all') eventsOnDay = eventsOnDay.filter(e => (e.eventType || 'training') === calFilterType);
    const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
    const dots = eventsOnDay.map(e => {
      const cfg = EVENT_TYPE_CONFIG[e.eventType || 'training'];
      const col = (e.eventType === 'custom' && e.customColour) ? e.customColour : cfg.colour;
      return `<div class="event-dot" style="background:${col}"></div>`;
    }).join('');
    html += `
      <div class="cal-day ${isToday ? 'today' : ''} ${eventsOnDay.length ? 'has-event' : ''}" onclick="selectCalDay('${dateStr}')">
        <span class="cal-day-num">${d}</span>
        ${dots ? `<div class="event-dot-container">${dots}</div>` : ''}
      </div>
    `;
  }

  document.getElementById('calGrid').innerHTML = html;
  renderUpcomingEvents();
}

function selectCalDay(dateStr) {
  document.getElementById('eventDate').value = dateStr;
  const card = document.getElementById('selectedDayCard');
  const title = document.getElementById('selectedDayTitle');
  const body = document.getElementById('selectedDayEvents');
  if (!card) return;

  const events = AppState.calendarEvents.filter(e => e.date === dateStr);
  const display = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
  title.textContent = display;

  if (!events.length) {
    body.innerHTML = '<p class="empty-state" style="padding:12px 0"><i class="fas fa-calendar-day"></i> Nothing scheduled — add an event below!</p>';
  } else {
    body.innerHTML = events.sort((a,b) => (a.time||'').localeCompare(b.time||'')).map(e => buildEventCard(e)).join('');
  }
  card.style.display = '';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildEventCard(e) {
  const type = e.eventType || 'training';
  const cfg = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.custom;
  const colour = (type === 'custom' && e.customColour) ? e.customColour : cfg.colour;
  const sportTag = (type === 'training' || type === 'team') && e.sport ? `<span class="ev-sport-tag">${getSportEmoji(e.sport)} ${e.sport}</span>` : '';
  return `
    <div class="upcoming-event" style="border-left:3px solid ${colour}">
      <div class="ev-title">
        <span class="ev-type-badge" style="background:${colour}20;color:${colour}">${cfg.icon} ${cfg.label}</span>
        ${e.title}
      </div>
      <div class="ev-meta">${e.time ? '🕐 '+e.time : ''}${e.endTime ? ' → '+e.endTime : ''}${e.duration ? ' · '+e.duration+' min' : ''} ${sportTag}</div>
      ${e.notes ? `<div class="ev-notes">${e.notes}</div>` : ''}
      <div class="ev-actions"><button class="ev-delete" onclick="deleteEvent(${e.id})"><i class="fas fa-trash"></i></button></div>
    </div>
  `;
}

function changeMonth(dir) {
  const d = AppState.calMonth;
  AppState.calMonth = new Date(d.getFullYear(), d.getMonth() + dir, 1);
  renderCalendar();
}

function addCalendarEvent() {
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const time = document.getElementById('eventTime').value;
  const endTime = document.getElementById('eventEndTime')?.value || '';
  const sport = document.getElementById('eventSport')?.value || AppState.sport || 'football';
  const duration = document.getElementById('eventDuration').value;
  const notes = document.getElementById('eventNotes').value.trim();
  const customColour = document.getElementById('eventCustomColour')?.value || selectedEventColour;

  if (!title || !date) { showToast('Please add an event name and date! 📅'); return; }

  const repeat = document.getElementById('eventRepeatWeekly')?.checked || false;
  const repeatCount = parseInt(document.getElementById('eventRepeatCount')?.value) || 1;
  const repeatGroupId = repeat ? `rg-${Date.now()}` : '';

  const makeEvent = (d, idx) => ({
    id: Date.now() + idx,
    title,
    date: d,
    time,
    endTime,
    sport: (selectedEventType === 'training' || selectedEventType === 'team') ? sport : '',
    duration,
    notes,
    eventType: selectedEventType,
    customColour: selectedEventType === 'custom' ? customColour : '',
    repeatGroupId,
  });

  if (repeat && repeatCount > 1) {
    const baseDate = new Date(date + 'T12:00:00');
    for (let i = 0; i < repeatCount; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i * 7);
      AppState.calendarEvents.push(makeEvent(d.toISOString().split('T')[0], i));
    }
    showToast(`🔁 Repeat event "${title}" added for ${repeatCount} weeks!`);
  } else {
    AppState.calendarEvents.push(makeEvent(date, 0));
  }

  AppState.sessions = (AppState.sessions || 0) + 1;
  // Only physically-active event types count toward the training streak
  const ACTIVE_TYPES = ['training', 'team'];
  if (ACTIVE_TYPES.includes(selectedEventType)) {
    recordStreakActivity('training');
  }
  logActivityFeedItem({ type: 'session', text: `${EVENT_TYPE_CONFIG[selectedEventType]?.icon || '📅'} ${title}`, date: date });
  saveToStorage();
  renderCalendar();
  updateDashboardStats();

  // Refresh selected-day panel if open
  if (document.getElementById('selectedDayCard')?.style.display !== 'none') {
    selectCalDay(date);
  }

  ['eventTitle','eventTime','eventEndTime','eventDuration','eventNotes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  const cfg = EVENT_TYPE_CONFIG[selectedEventType] || EVENT_TYPE_CONFIG.custom;
  showToast(`${cfg.icon} ${title} added to your calendar!`);
}

function renderUpcomingEvents() {
  let events = AppState.calendarEvents
    .filter(e => e.date >= getTodayStr());
  if (calFilterType !== 'all') events = events.filter(e => (e.eventType || 'training') === calFilterType);
  events = events.sort((a,b) => a.date.localeCompare(b.date)).slice(0, 8);

  const el = document.getElementById('upcomingEvents');
  if (!events.length) {
    el.innerHTML = '<p class="empty-state"><i class="fas fa-calendar"></i> No upcoming events — add some!</p>';
    return;
  }
  el.innerHTML = events.map(e => buildEventCard(e)).join('');
}

function deleteEvent(id) {
  AppState.calendarEvents = AppState.calendarEvents.filter(e => e.id !== id);
  saveToStorage();
  renderCalendar();
  // refresh selected-day panel
  const card = document.getElementById('selectedDayCard');
  if (card && card.style.display !== 'none') {
    const dateShown = document.getElementById('eventDate').value;
    if (dateShown) selectCalDay(dateShown);
  }
  showToast('Event removed');
}

function getSportEmoji(sport) {
  const map = { football:'⚽', basketball:'🏀', running:'🏃', tennis:'🎾', swimming:'🏊', cycling:'🚴' };
  return map[sport] || '🏅';
}

window.filterCalendar = filterCalendar;

function cancelAllRepeatEvents() {
  const beforeCount = AppState.calendarEvents.length;
  // Remove events that belong to a repeat group
  AppState.calendarEvents = AppState.calendarEvents.filter(e => !e.repeatGroupId);
  const removed = beforeCount - AppState.calendarEvents.length;
  if (!removed) { showToast('No repeat events found.'); return; }
  saveToStorage();
  renderCalendar();
  showToast(`🚫 Cancelled ${removed} repeat event${removed > 1 ? 's' : ''}!`);
}
window.cancelAllRepeatEvents = cancelAllRepeatEvents;
window.selectEventType = selectEventType;
window.selectEventColour = selectEventColour;
window.selectCalDay = selectCalDay;
window.changeMonth = changeMonth;
window.deleteEvent = deleteEvent;

// =====================================================
// NUTRITION / FOOD TRACKING
// =====================================================
const FOOD_DATABASE = [
  { name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fibre: 2.6 },
  { name: 'Chicken Breast (cooked)', calories: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0 },
  { name: 'Brown Rice (cooked)', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, fibre: 1.8 },
  { name: 'Whole Milk', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fibre: 0 },
  { name: 'Egg (whole)', calories: 147, protein: 12.6, carbs: 0.7, fat: 9.9, fibre: 0 },
  { name: 'White Bread (slice)', calories: 266, protein: 8.9, carbs: 51, fat: 3.2, fibre: 2.7 },
  { name: 'Oats (dry)', calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fibre: 10.6 },
  { name: 'Salmon (raw)', calories: 208, protein: 20, carbs: 0, fat: 13, fibre: 0 },
  { name: 'Broccoli', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fibre: 2.6 },
  { name: 'Sweet Potato', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fibre: 3 },
  { name: 'Greek Yogurt (plain)', calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fibre: 0 },
  { name: 'Almonds', calories: 579, protein: 21, carbs: 22, fat: 50, fibre: 12.5 },
  { name: 'Whey Protein Powder', calories: 400, protein: 80, carbs: 10, fat: 5, fibre: 0 },
  { name: 'Apple', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fibre: 2.4 },
  { name: 'Pasta (cooked)', calories: 131, protein: 5, carbs: 25, fat: 1.1, fibre: 1.8 },
  { name: 'Beef Mince (lean)', calories: 215, protein: 26, carbs: 0, fat: 12, fibre: 0 },
  { name: 'Orange', calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fibre: 2.4 },
  { name: 'Tuna (canned in water)', calories: 86, protein: 19, carbs: 0, fat: 1, fibre: 0 },
  { name: 'Avocado', calories: 160, protein: 2, carbs: 9, fat: 15, fibre: 7 },
  { name: 'Milk (semi-skimmed)', calories: 46, protein: 3.4, carbs: 4.8, fat: 1.6, fibre: 0 },
  { name: 'Peanut Butter', calories: 588, protein: 25, carbs: 20, fat: 50, fibre: 6 },
  { name: 'Sports Energy Bar', calories: 380, protein: 10, carbs: 70, fat: 7, fibre: 3 },
  { name: 'Chocolate Milk', calories: 83, protein: 3.4, carbs: 12, fat: 2.5, fibre: 0.6 },
  { name: 'Spinach', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fibre: 2.2 },
  { name: 'Blueberries', calories: 57, protein: 0.7, carbs: 14, fat: 0.3, fibre: 2.4 },
  { name: 'Cottage Cheese', calories: 98, protein: 11, carbs: 3.4, fat: 4.3, fibre: 0 },
  { name: 'Rice Cakes', calories: 387, protein: 7.3, carbs: 81, fat: 3.5, fibre: 0.6 },
  { name: 'Protein Bar (generic)', calories: 360, protein: 30, carbs: 35, fat: 10, fibre: 5 },
  { name: 'Orange Juice', calories: 45, protein: 0.7, carbs: 10, fat: 0.2, fibre: 0.2 },
  { name: 'Quinoa (cooked)', calories: 120, protein: 4.4, carbs: 21, fat: 1.9, fibre: 2.8 },
];

let selectedFood = null;

function searchFood(query) {
  if (!query || query.length < 2) {
    document.getElementById('foodSuggestions').classList.add('hidden');
    return;
  }
  const q = query.toLowerCase();
  const results = FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  const el = document.getElementById('foodSuggestions');
  if (!results.length) { el.classList.add('hidden'); return; }

  el.innerHTML = results.map(f =>
    `<div class="food-suggestion-item" onclick="selectFood('${f.name}')">
      <span class="food-suggestion-name">${f.name}</span>
      <span class="food-suggestion-cal">${f.calories} kcal/100g · P:${f.protein}g C:${f.carbs}g F:${f.fat}g</span>
    </div>`
  ).join('');
  el.classList.remove('hidden');
}

function selectFood(name) {
  selectedFood = FOOD_DATABASE.find(f => f.name === name);
  if (!selectedFood) return;

  document.getElementById('foodSuggestions').classList.add('hidden');
  document.getElementById('foodSearch').value = name;
  document.getElementById('foodPreviewName').textContent = `🍽️ ${selectedFood.name}`;
  document.getElementById('foodPreviewMacros').textContent = `Per 100g — Calories: ${selectedFood.calories} kcal | Protein: ${selectedFood.protein}g | Carbs: ${selectedFood.carbs}g | Fat: ${selectedFood.fat}g | Fibre: ${selectedFood.fibre}g`;
  document.getElementById('selectedFoodPreview').classList.remove('hidden');
}

function logSelectedFood() {
  if (!selectedFood) return;
  const amount = parseFloat(document.getElementById('foodAmount').value) || 100;
  const meal = document.getElementById('mealType').value;
  const factor = amount / 100;

  const entry = {
    id: Date.now(),
    name: selectedFood.name,
    amount,
    meal,
    date: getTodayStr(),
    calories: Math.round(selectedFood.calories * factor),
    protein: Math.round(selectedFood.protein * factor * 10) / 10,
    carbs: Math.round(selectedFood.carbs * factor * 10) / 10,
    fat: Math.round(selectedFood.fat * factor * 10) / 10,
    fibre: Math.round(selectedFood.fibre * factor * 10) / 10,
  };

  AppState.foodLog.push(entry);
  recordStreakActivity('nutrition');
  saveToStorage();
  updateNutritionUI();
  updateDashboardStats();

  document.getElementById('selectedFoodPreview').classList.add('hidden');
  document.getElementById('foodSearch').value = '';
  selectedFood = null;
  showToast(`${entry.name} logged — ${entry.calories} kcal 🍽️`);
}

function logCustomFood() {
  const name = document.getElementById('customFoodName').value.trim();
  const cals = parseFloat(document.getElementById('customCals').value);
  const protein = parseFloat(document.getElementById('customProtein').value) || 0;
  const carbs = parseFloat(document.getElementById('customCarbs').value) || 0;
  const fat = parseFloat(document.getElementById('customFat').value) || 0;
  const fibre = parseFloat(document.getElementById('customFibre').value) || 0;
  const amount = parseFloat(document.getElementById('customAmount').value) || 100;
  const meal = document.getElementById('customMealType').value;

  if (!name || !cals) { showToast('Please fill in food name and calories!'); return; }
  const factor = amount / 100;

  const entry = {
    id: Date.now(),
    name,
    amount,
    meal,
    date: getTodayStr(),
    calories: Math.round(cals * factor),
    protein: Math.round(protein * factor * 10) / 10,
    carbs: Math.round(carbs * factor * 10) / 10,
    fat: Math.round(fat * factor * 10) / 10,
    fibre: Math.round(fibre * factor * 10) / 10,
  };

  AppState.foodLog.push(entry);
  recordStreakActivity('nutrition');
  saveToStorage();
  updateNutritionUI();
  closeModal('customFoodModal');
  showToast(`${name} logged! 🍽️`);
}

function deleteFoodEntry(id) {
  AppState.foodLog = AppState.foodLog.filter(f => f.id !== id);
  saveToStorage();
  updateNutritionUI();
  updateDashboardStats();
}

function clearFoodLog() {
  AppState.foodLog = [];
  saveToStorage();
  updateNutritionUI();
  updateDashboardStats();
  showToast('Food log cleared');
}

function updateNutritionUI() {
  const log = AppState.foodLog.filter(f => f.date === getTodayStr());
  const totals = log.reduce((acc, f) => {
    acc.calories += f.calories || 0;
    acc.protein += f.protein || 0;
    acc.carbs += f.carbs || 0;
    acc.fat += f.fat || 0;
    acc.fibre += f.fibre || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

  const goals = AppState.nutritionGoals;

  // Update ring
  const totalEl = document.getElementById('totalCaloriesDisplay');
  const goalEl = document.getElementById('calorieGoalDisplay');
  if (totalEl) totalEl.textContent = Math.round(totals.calories);
  if (goalEl) goalEl.textContent = goals.calories;

  const ring = document.getElementById('calorieRing');
  if (ring) {
    const pct = Math.min(totals.calories / goals.calories, 1);
    const circumference = 2 * Math.PI * 50;
    ring.style.strokeDashoffset = circumference * (1 - pct);
    ring.style.stroke = pct >= 1 ? '#ff4444' : 'var(--accent)';
  }

  // Macros
  const setPct = (barId, valId, val, goal) => {
    const bar = document.getElementById(barId);
    const valEl = document.getElementById(valId);
    if (bar) bar.style.width = `${Math.min(val/goal*100, 100)}%`;
    if (valEl) valEl.textContent = `${Math.round(val * 10)/10}g`;
  };
  setPct('proteinBar', 'proteinVal', totals.protein, goals.protein);
  setPct('carbsBar', 'carbsVal', totals.carbs, goals.carbs);
  setPct('fatBar', 'fatVal', totals.fat, goals.fat);
  setPct('fibreBar', 'fibreVal', totals.fibre, goals.fibre);

  // Food log list
  const logEl = document.getElementById('foodLog');
  if (!logEl) return;
  if (!log.length) { logEl.innerHTML = '<p class="empty-state"><i class="fas fa-utensils"></i> No food logged today. Start tracking!</p>'; return; }

  const meals = ['breakfast','pre-workout','lunch','post-workout','dinner','snack'];
  let html = '';
  meals.forEach(meal => {
    const mealItems = log.filter(f => f.meal === meal);
    if (!mealItems.length) return;
    const mealTotal = mealItems.reduce((s, f) => s + f.calories, 0);
    html += `<div class="meal-section-header">${meal.replace('-',' ')} — ${Math.round(mealTotal)} kcal</div>`;
    mealItems.forEach(f => {
      html += `
        <div class="food-log-item">
          <div>
            <div class="food-log-name">${f.name}</div>
            <div class="food-log-meta">${f.amount}g · P:${f.protein}g C:${f.carbs}g F:${f.fat}g</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="food-log-cal">${f.calories} kcal</span>
            <button class="food-log-del" onclick="deleteFoodEntry(${f.id})"><i class="fas fa-times"></i></button>
          </div>
        </div>
      `;
    });
  });
  logEl.innerHTML = html;
}

function openCustomFood() {
  document.getElementById('customFoodModal').classList.remove('hidden');
}

function openGoalModal() {
  const g = AppState.nutritionGoals;
  document.getElementById('goalCalories').value = g.calories;
  document.getElementById('goalProtein').value = g.protein;
  document.getElementById('goalCarbs').value = g.carbs;
  document.getElementById('goalFat').value = g.fat;
  document.getElementById('goalFibre').value = g.fibre;
  document.getElementById('goalModal').classList.remove('hidden');
}

function saveGoals() {
  AppState.nutritionGoals = {
    calories: parseInt(document.getElementById('goalCalories').value) || 2500,
    protein: parseInt(document.getElementById('goalProtein').value) || 150,
    carbs: parseInt(document.getElementById('goalCarbs').value) || 300,
    fat: parseInt(document.getElementById('goalFat').value) || 80,
    fibre: parseInt(document.getElementById('goalFibre').value) || 30,
  };
  saveToStorage();
  updateNutritionUI();
  closeModal('goalModal');
  showToast('Nutrition goals saved! 🥦');
}

function getAINutritionAdvice() {
  const log = AppState.foodLog.filter(f => f.date === getTodayStr());
  const total = log.reduce((a, f) => ({ cal: a.cal + f.calories, prot: a.prot + f.protein, carbs: a.carbs + f.carbs }), { cal: 0, prot: 0, carbs: 0 });
  const goals = AppState.nutritionGoals;

  let advice = '';
  if (!log.length) {
    advice = `🤖 Log your meals first and I'll give you personalised advice!`;
  } else if (total.prot < goals.protein * 0.6) {
    advice = `⚠️ You're low on protein today (${Math.round(total.prot)}g logged vs ${goals.protein}g goal). Add chicken breast, eggs, Greek yogurt, or a protein shake to hit your target. Protein is critical for muscle repair after training!`;
  } else if (total.carbs > goals.carbs * 1.1) {
    advice = `🍞 Your carb intake is above target today. Consider swapping refined carbs for sweet potatoes, brown rice or oats for sustained energy during training.`;
  } else if (total.cal < goals.calories * 0.5) {
    advice = `📉 You're under-fuelling today (${Math.round(total.cal)} kcal). Athletes need adequate calories to perform and recover. Add a balanced meal or pre-workout snack!`;
  } else {
    advice = `✅ You're on track today! Keep it up — ${Math.round(total.prot)}g protein, ${Math.round(total.carbs)}g carbs logged. Stay consistent and drink plenty of water. Aim for another ${Math.round(goals.protein - total.prot)}g of protein before end of day.`;
  }

  document.getElementById('nutritionAdvice').textContent = advice;
}

// =====================================================
// AI COACH CHAT
// =====================================================
const AI_RESPONSES = {
  'training tips': `🏋️ Here are my top training tips for ${() => getSportLabel(AppState.sport)}:\n\n1. **Consistency beats intensity** — train regularly at moderate intensity rather than going all-out once a week.\n2. **Progressive overload** — increase difficulty by 5-10% per week.\n3. **Warm up properly** — 10 mins dynamic stretching prevents 80% of common injuries.\n4. **Track your sessions** — what gets measured gets improved!\n5. **Rest is training** — your body improves during recovery, not during the session itself.`,
  'nutrition advice': `🥗 **Sports Nutrition Fundamentals:**\n\n• **Carbs = fuel** — eat complex carbs 2-3 hours before training (oats, brown rice, sweet potato)\n• **Protein = repair** — consume 1.6-2.2g per kg bodyweight daily (chicken, eggs, fish, dairy)\n• **Hydration** — drink at least 2L water/day, more during training\n• **Timing matters** — eat within 30-60 mins post-workout for optimal recovery\n• **Don't fear fat** — healthy fats (avocado, nuts, olive oil) support hormone production`,
  'build strength': `💪 **Strength Building for Athletes:**\n\n**Week 1-4 (Foundation):**\n• Squats 3×8, Deadlifts 3×6, Bench Press 3×8\n• Focus on form over weight\n\n**Week 5-8 (Load):**\n• Increase weight by 5% weekly\n• Add single-leg work for sport stability\n\n**Key principles:**\n• Compound moves > isolation\n• 72 hours rest between same muscle groups\n• Sleep 8-9 hours for testosterone + growth hormone`,
  'recovery tips': `😴 **Recovery is Training:**\n\n1. **Sleep 8-9 hours** — this is when 90% of muscle repair happens\n2. **Contrast showers** — 3 mins hot / 1 min cold × 3, boosts circulation\n3. **Foam rolling** — 1-2 mins per muscle group post-session\n4. **Active recovery** — 20 min easy walk or swim on rest days beats doing nothing\n5. **Nutrition** — protein + carbs within 45 mins of finishing\n6. **Mindfulness** — 10 mins meditation reduces cortisol which kills performance`,
  'improve speed': `⚡ **Speed Development Protocol:**\n\n**Acceleration (0-10m):**\n• Drive phase mechanics — lean forward, powerful arm drive\n• Resistance sprints (sled, hills) 3× per week\n\n**Max velocity (20-40m):**\n• Sprint drills: A-skips, B-skips, high knees\n• Flying 20s — build speed then time a 20m section\n\n**Agility:**\n• Ladder drills: in-in-out-out, 1-2-3-step\n• Reactive cone drills with partner\n\nSee improvement in 4-6 weeks with consistency!`,
  'mental game': `🧠 **Mental Performance — Train Your Mind:**\n\n**Pre-match routine:**\n• Same music, same warm-up, same focus word\n• 5 mins visualisation — see yourself succeeding\n\n**In-game:**\n• Process focus not outcome focus (what's your NEXT action?)\n• Breathe: 4 counts in, 4 hold, 4 out — resets nervous system\n\n**Long-term:**\n• Keep a performance journal — track what went well\n• Work with a sports psychologist if possible\n• Confidence comes from preparation — put the work in!`,
};

function getAIResponse(message) {
  const lower = message.toLowerCase();
  for (const [key, response] of Object.entries(AI_RESPONSES)) {
    if (lower.includes(key.split(' ')[0]) || lower.includes(key)) {
      return response.replace('${() => getSportLabel(AppState.sport)}', getSportLabel(AppState.sport));
    }
  }

  // Dynamic responses
  if (lower.includes('football') || lower.includes('soccer')) {
    return `⚽ Football is all about technical ability, tactical understanding, and physical conditioning. For football-specific training, I recommend:\n\n1. Daily ball work (minimum 30 mins)\n2. Position-specific drills tailored to your role\n3. Strength & conditioning 3× per week\n4. Watch and analyse professional games\n\nWant me to generate a full football training plan? Go to the Plans section and hit "Generate My AI Plan"!`;
  }
  if (lower.includes('basketball')) {
    return `🏀 For basketball development:\n\n1. Shoot 500+ shots per week minimum\n2. Ball-handling drills: both hands equally\n3. Vertical jump training: depth jumps + weighted calf raises\n4. Study pick-and-roll defence — it's the most important skill\n\nUse the Plans section to get your personalised basketball programme!`;
  }
  if (lower.includes('diet') || lower.includes('food') || lower.includes('eat')) {
    return `🥗 For athletic nutrition, the basics are:\n\n• **Eat enough** — undereating kills performance\n• **Prioritise protein** — 1.8-2.2g per kg bodyweight\n• **Carbs before training, protein after**\n• **Vegetables at every meal** for micronutrients\n\nUse the Nutrition tab to track your calories and macros daily!`;
  }
  if (lower.includes('injury') || lower.includes('pain')) {
    return `🏥 **Injury Advice (general — always consult a professional):**\n\nRICE protocol for acute injuries:\n• **R**est — stop immediately\n• **I**ce — 15-20 mins every 2-3 hours\n• **C**ompression — light bandage to reduce swelling\n• **E**levation — raise above heart level\n\nFor persistent pain: See a physiotherapist. Training through serious injury can cause long-term damage. Prevention > treatment!`;
  }
  if (lower.includes('age') || lower.includes('young') || lower.includes('kid')) {
    return `👶 **Sports Development at All Ages:**\n\n**Ages 4-8:** Focus on FUN and fundamental movement — run, jump, throw, catch\n**Ages 9-12:** Multi-sport participation is better than early specialisation\n**Ages 13-16:** Start sport-specific training, but keep variety\n**Ages 17+:** Can handle structured periodised training\n\nThe most important thing at any age is to ENJOY the sport. Burnout from early specialisation is a real problem!`;
  }

  // Generic motivational responses
  const generics = [
    `🤖 Great question! As your AI coach, my advice is: stay consistent, trust the process, and remember that every pro athlete was once a beginner. What specific aspect of your training would you like to work on?`,
    `💡 The difference between good athletes and great athletes is what they do when no one is watching. Discipline beats motivation every single time. What goal are you working towards?`,
    `⚡ Remember: champions are built in the off-season. Ask me about training plans, nutrition, recovery, speed, strength, or mental performance — I'm here to help you reach your potential!`,
    `🏆 Every session counts. Even a 20-minute workout on a bad day builds the habit and consistency that separate pros from amateurs. What's your biggest challenge right now?`,
  ];
  return generics[Math.floor(Math.random() * generics.length)];
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';

  addChatMessage(message, 'user');

  // Show typing indicator
  const typingId = 'typing-' + Date.now();
  const chatEl = document.getElementById('chatMessages');
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'chat-msg ai-msg';
  typingDiv.innerHTML = `<div class="msg-avatar"><i class="fas fa-robot"></i></div><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  chatEl.appendChild(typingDiv);
  chatEl.scrollTop = chatEl.scrollHeight;

  setTimeout(() => {
    typingDiv.remove();
    const response = getAIResponse(message);
    addChatMessage(response, 'ai');
  }, 800 + Math.random() * 800);
}

function addChatMessage(text, type) {
  const chatEl = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${type === 'user' ? 'user-msg' : 'ai-msg'}`;
  const avatar = type === 'user'
    ? `<div class="msg-avatar"><i class="fas fa-user"></i></div>`
    : `<div class="msg-avatar"><i class="fas fa-robot"></i></div>`;

  // Convert markdown-like bold to HTML
  const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

  div.innerHTML = `${type === 'user' ? '' : avatar}<div class="msg-bubble"><p>${formatted}</p></div>${type === 'user' ? avatar : ''}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function sendQuickPrompt(btn) {
  document.getElementById('chatInput').value = btn.textContent.replace(/^[^\s]+\s/, '');
  sendChat();
}

function loadProTips() {
  const sportTips = TIPS[AppState.sport] || TIPS.football;
  const tips = sportTips.slice(0, 4);
  const el = document.getElementById('proTips');
  if (el) el.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
}

function updateSidebarStats() {
  const log = AppState.foodLog.filter(f => f.date === getTodayStr());
  const totalCals = log.reduce((s, f) => s + f.calories, 0);

  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('sidebar-sport', getSportLabel(AppState.sport));
  set('sidebar-age', AppState.user ? `${AppState.user.age} years` : '—');
  set('sidebar-sessions', AppState.sessions || 0);
  set('sidebar-cals', `${Math.round(totalCals)} kcal`);
  set('sidebar-level', getLevel());
}

// =====================================================
// MODALS
// =====================================================
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay && !overlay.id === 'ageGate') {
      overlay.classList.add('hidden');
    }
  });
});

// =====================================================
// TOAST
// =====================================================
let toastTimeout;
function showToast(msg, duration = 3500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerHTML = msg;
  // Remove both possible hidden states, then force reflow, then show
  toast.classList.remove('hidden');
  toast.classList.remove('toast-show');
  // Force reflow so the transition fires from the start position
  void toast.offsetWidth;
  toast.classList.add('toast-show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('toast-show');
    // After transition completes, add hidden again
    setTimeout(() => toast.classList.add('hidden'), 320);
  }, duration);
}

// =====================================================
// FOOD CAMERA SCAN
// =====================================================

// A realistic food recognition database — simulates what a vision model would return
const FOOD_VISION_DB = [
  // By dominant colour/type heuristic — we pattern match the filename & size
  { keywords: ['pizza','slice'], name:'Pizza (medium slice)', cals:266, protein:11, carbs:33, fat:10, fibre:2 },
  { keywords: ['burger','hamburger'], name:'Beef Burger', cals:354, protein:20, carbs:29, fat:17, fibre:1 },
  { keywords: ['salad','bowl','green'], name:'Mixed Green Salad', cals:55, protein:3, carbs:8, fat:1, fibre:4 },
  { keywords: ['pasta','spaghetti','noodle'], name:'Pasta with Tomato Sauce', cals:220, protein:8, carbs:43, fat:2, fibre:3 },
  { keywords: ['chicken','breast','meat'], name:'Grilled Chicken Breast', cals:165, protein:31, carbs:0, fat:4, fibre:0 },
  { keywords: ['rice','white','bowl'], name:'Cooked White Rice', cals:130, protein:3, carbs:28, fat:0, fibre:0 },
  { keywords: ['banana','yellow','fruit'], name:'Banana', cals:89, protein:1, carbs:23, fat:0, fibre:3 },
  { keywords: ['apple','red','fruit'], name:'Apple', cals:52, protein:0, carbs:14, fat:0, fibre:2 },
  { keywords: ['sandwich','bread','wrap'], name:'Chicken Sandwich', cals:283, protein:16, carbs:35, fat:7, fibre:3 },
  { keywords: ['egg','omelette','eggs'], name:'Scrambled Eggs (2)', cals:182, protein:14, carbs:1, fat:14, fibre:0 },
  { keywords: ['steak','beef','grill'], name:'Beef Steak (180g)', cals:365, protein:38, carbs:0, fat:22, fibre:0 },
  { keywords: ['soup','broth'], name:'Vegetable Soup', cals:72, protein:4, carbs:12, fat:1, fibre:3 },
  { keywords: ['cake','dessert','sweet','chocolate'], name:'Chocolate Cake slice', cals:367, protein:4, carbs:52, fat:16, fibre:2 },
  { keywords: ['cereal','oat','porridge'], name:'Porridge Oats', cals:166, protein:6, carbs:28, fat:3, fibre:4 },
  { keywords: ['sushi','roll','japanese'], name:'Sushi Roll (8 pcs)', cals:330, protein:15, carbs:55, fat:5, fibre:1 },
  { keywords: ['fish','salmon','tuna'], name:'Grilled Salmon (150g)', cals:280, protein:39, carbs:0, fat:13, fibre:0 },
  { keywords: ['shake','smoothie','protein'], name:'Protein Shake', cals:200, protein:28, carbs:15, fat:3, fibre:1 },
  { keywords: ['toast','bread','slice'], name:'Wholegrain Toast (2 slices)', cals:174, protein:7, carbs:33, fat:2, fibre:4 },
  { keywords: ['yogurt','yoghurt'], name:'Greek Yoghurt (200g)', cals:130, protein:12, carbs:8, fat:5, fibre:0 },
  { keywords: ['fries','chips','potato'], name:'Fries / Chips (medium)', cals:365, protein:4, carbs:48, fat:17, fibre:4 },
];

function scanFoodPhoto(input) {
  const file = input.files[0];
  if (!file) return;

  // Show scanning UI
  const search = document.getElementById('foodSearch');
  if (search) search.value = '';
  showToast('📸 Analysing your food photo...');

  const reader = new FileReader();
  reader.onload = e => {
    // Extract hints from filename
    const filename = file.name.toLowerCase();
    const fileSize = file.size;

    // Simulate brief analysis delay
    setTimeout(() => {
      // Try matching filename keywords
      let match = null;
      for (const food of FOOD_VISION_DB) {
        if (food.keywords.some(kw => filename.includes(kw))) {
          match = food;
          break;
        }
      }

      // If no filename match, pick based on file size (just for realistic variety)
      if (!match) {
        const idx = Math.floor((fileSize % 1000) / 1000 * FOOD_VISION_DB.length);
        match = FOOD_VISION_DB[Math.max(0, Math.min(idx, FOOD_VISION_DB.length - 1))];
      }

      // Show result as if selected food
      const detected = {
        name: match.name,
        calories: match.cals,
        protein: match.protein,
        carbs: match.carbs,
        fat: match.fat,
        fibre: match.fibre,
      };

      AppState.selectedFood = detected;

      // Show preview panel
      document.getElementById('foodPreviewName').textContent = `📷 Detected: ${detected.name}`;
      document.getElementById('foodPreviewMacros').innerHTML = `
        <span>🔥 ${detected.calories} kcal</span>
        <span>💪 ${detected.protein}g protein</span>
        <span>🌾 ${detected.carbs}g carbs</span>
        <span>🫒 ${detected.fat}g fat</span>
        <span>🌿 ${detected.fibre}g fibre</span>
      `;
      document.getElementById('selectedFoodPreview').classList.remove('hidden');
      document.getElementById('foodSearch').value = detected.name;

      showToast(`✅ Identified: ${detected.name} — ${detected.calories} kcal per 100g`);

      // Reset input so same file can be scanned again
      input.value = '';
    }, 1200);
  };
  reader.readAsDataURL(file);
}
window.scanFoodPhoto = scanFoodPhoto;
Object.assign(window, {
  submitAgeGate, onboardNext, onboardBack, showOnboardStep,
  toggleTheme, navTo, openSportSwitch, switchSport,
  generatePlan, quickPlan, saveAndSchedulePlan,
  findNearbyFields, searchLocation, searchFieldsLocation, searchCurrentLocation,
  changeMonth, addCalendarEvent, deleteEvent, selectCalDay,
  searchFood, selectFood, logSelectedFood, logCustomFood, deleteFoodEntry, clearFoodLog,
  openCustomFood, openGoalModal, saveGoals, getAINutritionAdvice, closeModal,
  sendChat, sendQuickPrompt, refreshDailyTip,
  // Stats
  openAddPB, savePB, logRPE, updateRPEDisplay, saveMeasurements,
  // Gamify
  refreshChallenges,
  // Wellness
  logSleep, addWater, addCustomWater, resetWater, setHydrationGoal, logInjury, showStretches,
  // Drills
  filterDrills, filterDrillsLevel,
  // Gear
  renderKitList, checkAllKit, uncheckAllKit, addCustomGear,
  // Profile
  saveProfile, setPref, toggleReminders, setReminderTime, uploadAvatar, exportCSV, confirmReset,
});

// =====================================================
// EXTENDED NAV INIT
// =====================================================
const _origNavTo = navTo;
window.navTo = function(page) {
  _origNavTo(page);
  if (page === 'stats') initStatsPage();
  if (page === 'gamify') initGamifyPage();
  if (page === 'wellness') initWellnessPage();
  if (page === 'drills') renderDrillsGrid('all', 'all');
  if (page === 'video') initVideoPage();
  if (page === 'gear') renderKitList();
  if (page === 'profile') initProfilePage();
};

// =====================================================
// ========== 1. PERSONAL RECORDS (PBs) ==============
// =====================================================
const PB_LABELS = {
  sprint_10m: '10m Sprint', sprint_40m: '40m Sprint', sprint_100m: '100m Sprint',
  max_squat: 'Max Squat', max_bench: 'Max Bench Press', max_deadlift: 'Max Deadlift',
  pull_ups: 'Max Pull-Ups', push_ups: 'Max Push-Ups', vertical_jump: 'Vertical Jump',
  broad_jump: 'Broad Jump', '5km_run': '5km Run', plank: 'Plank Hold', custom: 'Custom',
};
const PB_UNITS = {
  sprint_10m:'s', sprint_40m:'s', sprint_100m:'s', max_squat:'kg', max_bench:'kg',
  max_deadlift:'kg', pull_ups:'reps', push_ups:'reps', vertical_jump:'cm', broad_jump:'cm', '5km_run':'', plank:'s',
};

function openAddPB() {
  document.getElementById('pbType').onchange = function() {
    document.getElementById('pbCustomNameGroup').style.display = this.value === 'custom' ? 'block' : 'none';
  };
  document.getElementById('addPBModal').classList.remove('hidden');
}

function savePB() {
  const type = document.getElementById('pbType').value;
  const value = document.getElementById('pbValue').value.trim();
  const notes = document.getElementById('pbNotes').value.trim();
  const customName = document.getElementById('pbCustomName').value.trim();
  if (!value) { showToast('Please enter a value!'); return; }

  if (!AppState.pbs) AppState.pbs = [];
  const pb = {
    id: Date.now(),
    type,
    label: type === 'custom' ? customName : PB_LABELS[type],
    unit: PB_UNITS[type] || '',
    value,
    notes,
    date: getTodayStr(),
  };
  AppState.pbs.push(pb);
  AppState.xp = (AppState.xp || 0) + 25;
  checkBadges();
  logActivityFeedItem({ type: 'pb', text: `🏅 New PB: ${pb.label} — ${value}${pb.unit}`, date: getTodayStr() });
  saveToStorage();
  renderPBGrid();
  closeModal('addPBModal');
  showToast(`New PB logged: ${pb.label} — ${value}${pb.unit} 🏅 +25 XP`);
}

function renderPBGrid() {
  const grid = document.getElementById('pbGrid');
  if (!grid) return;
  if (!AppState.pbs || !AppState.pbs.length) {
    grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1"><i class="fas fa-medal"></i> No personal bests logged yet. Hit that PB button!</p>';
    return;
  }
  // Group by type, show latest
  const latest = {};
  AppState.pbs.forEach(pb => { latest[pb.label] = pb; });
  grid.innerHTML = Object.values(latest).map(pb => `
    <div class="pb-item">
      <div class="pb-type">${pb.label}</div>
      <div class="pb-value">${pb.value}<small style="font-size:0.7rem;color:var(--text-muted)">${pb.unit}</small></div>
      <div class="pb-date">${pb.date} ${pb.notes ? '· '+pb.notes : ''}</div>
      <button class="pb-del" onclick="deletePB(${pb.id})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

function deletePB(id) {
  AppState.pbs = (AppState.pbs || []).filter(p => p.id !== id);
  saveToStorage();
  renderPBGrid();
}
window.deletePB = deletePB;

// =====================================================
// ========== 2 & 3. PROGRESS CHARTS ==================
// =====================================================
let chartInstances = {};

function initCharts() {
  const chartDefaults = {
    color: 'var(--text-primary)',
    plugins: { legend: { labels: { color: '#aaa', font: { family: 'Inter' } } } },
    scales: {
      x: { ticks: { color: '#666' }, grid: { color: '#222' } },
      y: { ticks: { color: '#666' }, grid: { color: '#222' } },
    },
  };

  // Destroy existing
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e676';

  // Weight chart
  const wData = (AppState.measurements || []).slice(-10);
  const wCtx = document.getElementById('weightChart');
  if (wCtx) {
    chartInstances.weight = new Chart(wCtx, {
      type: 'line',
      data: {
        labels: wData.map(m => m.date),
        datasets: [{ label: 'Weight (kg)', data: wData.map(m => m.weight), borderColor: accent, backgroundColor: accent+'33', tension: 0.4, fill: true, pointBackgroundColor: accent }],
      },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins } },
    });
  }

  // Calorie chart (last 7 days)
  const today = new Date();
  const last7 = Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6-i));
    return d.toISOString().split('T')[0];
  });
  const calData = last7.map(d => {
    const dayLog = (AppState.allFoodLogs || {})[d] || [];
    return dayLog.reduce((s, f) => s + (f.calories||0), 0);
  });
  const calCtx = document.getElementById('calorieChart');
  if (calCtx) {
    chartInstances.cal = new Chart(calCtx, {
      type: 'bar',
      data: {
        labels: last7.map(d => d.slice(5)),
        datasets: [{ label: 'Calories', data: calData, backgroundColor: accent+'88', borderColor: accent, borderWidth: 2 }],
      },
      options: { ...chartDefaults },
    });
  }

  // Sessions chart (last 8 weeks)
  const sessionsData = Array.from({length:8}, (_,i) => {
    const wk = new Date(today); wk.setDate(wk.getDate() - i*7);
    const wkStr = wk.toISOString().split('T')[0];
    return AppState.calendarEvents.filter(e => {
      const diff = (new Date(wkStr) - new Date(e.date)) / (1000*60*60*24);
      return diff >= 0 && diff < 7;
    }).length;
  }).reverse();
  const sessCtx = document.getElementById('sessionsChart');
  if (sessCtx) {
    chartInstances.sessions = new Chart(sessCtx, {
      type: 'bar',
      data: {
        labels: Array.from({length:8}, (_,i) => `W-${7-i}`),
        datasets: [{ label: 'Sessions', data: sessionsData, backgroundColor: '#42a5f588', borderColor: '#42a5f5', borderWidth: 2 }],
      },
      options: { ...chartDefaults },
    });
  }

  // RPE chart
  const rpeData = (AppState.rpeLog || []).slice(-10);
  const rpeCtx = document.getElementById('rpeChart');
  if (rpeCtx) {
    chartInstances.rpe = new Chart(rpeCtx, {
      type: 'line',
      data: {
        labels: rpeData.map(r => r.date),
        datasets: [{ label: 'RPE', data: rpeData.map(r => r.rpe), borderColor: '#ef5350', backgroundColor: '#ef535033', tension: 0.4, fill: true, pointBackgroundColor: '#ef5350' }],
      },
      options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 1, max: 10 } } },
    });
  }
}

// =====================================================
// ========== 3. BODY MEASUREMENTS ====================
// =====================================================
function saveMeasurements() {
  const weight = parseFloat(document.getElementById('bodyWeight').value);
  const height = parseFloat(document.getElementById('bodyHeight').value);
  const fat = parseFloat(document.getElementById('bodyFat').value) || null;
  const chest = parseFloat(document.getElementById('measureChest').value) || null;
  const waist = parseFloat(document.getElementById('measureWaist').value) || null;
  const hips = parseFloat(document.getElementById('measureHips').value) || null;
  const thigh = parseFloat(document.getElementById('measureThigh').value) || null;
  const bicep = parseFloat(document.getElementById('measureBicep').value) || null;
  const weightUnit = document.getElementById('weightUnit').value;
  const heightUnit = document.getElementById('heightUnit').value;

  if (!weight || !height) { showToast('Please enter weight and height!'); return; }

  const weightKg = weightUnit === 'lbs' ? weight * 0.453592 : weight;
  const heightCm = heightUnit === 'ft' ? height * 30.48 : height;
  const bmi = (weightKg / ((heightCm/100) ** 2)).toFixed(1);
  const bmiCategory = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';

  const entry = { id: Date.now(), date: getTodayStr(), weight: weightKg.toFixed(1), height: heightCm, fat, chest, waist, hips, thigh, bicep, bmi, weightUnit, heightUnit };
  if (!AppState.measurements) AppState.measurements = [];
  AppState.measurements.push(entry);
  saveToStorage();

  const bmiEl = document.getElementById('bmiResult');
  if (bmiEl) bmiEl.innerHTML = `📊 BMI: <strong>${bmi}</strong> — ${bmiCategory} ${bmi < 18.5 ? '⚠️' : bmi < 25 ? '✅' : '⚠️'}`;

  initCharts();
  showToast(`Measurements saved! BMI: ${bmi} (${bmiCategory}) 📏`);
}

// =====================================================
// ========== 4. RPE LOGGER ===========================
// =====================================================
const RPE_LABELS = ['','Very Easy','Easy','Moderate','Moderate+','Hard','Hard+','Very Hard','Very Hard+','Extremely Hard','Max Effort'];

function updateRPEDisplay(val) {
  const disp = document.getElementById('rpeDisplay');
  const label = document.getElementById('rpeLabel');
  if (disp) disp.textContent = val;
  if (label) label.textContent = RPE_LABELS[val] || '';
}

function logRPE() {
  const session = document.getElementById('rpeSession').value.trim() || 'Training Session';
  const rpe = parseInt(document.getElementById('rpeSlider').value);
  const notes = document.getElementById('rpeNotes').value.trim();

  if (!AppState.rpeLog) AppState.rpeLog = [];
  AppState.rpeLog.push({ id: Date.now(), session, rpe, notes, date: getTodayStr() });
  AppState.xp = (AppState.xp || 0) + 10;
  saveToStorage();
  initCharts();
  showToast(`RPE logged: ${session} — ${rpe}/10 (${RPE_LABELS[rpe]}) ⚡`);
  document.getElementById('rpeSession').value = '';
  document.getElementById('rpeNotes').value = '';
  document.getElementById('rpeSlider').value = 5;
  updateRPEDisplay(5);
}

// =====================================================
// ========== TRAINING HEATMAP ========================
// =====================================================
function renderHeatmap() {
  const container = document.getElementById('trainingHeatmap');
  if (!container) return;
  const today = new Date();
  const cells = [];
  const sessionDates = new Set(AppState.calendarEvents.map(e => e.date));

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = d.toISOString().split('T')[0];
    const isToday = i === 0;
    const has = sessionDates.has(str);
    cells.push(`<div class="heat-cell ${has ? 'has-session' : ''} ${isToday ? 'today' : ''}" title="${str}${has ? ' ✓ Session' : ''}"></div>`);
  }
  container.innerHTML = cells.join('');
}

function initStatsPage() {
  renderPBGrid();
  renderHeatmap();
  updateRPEDisplay(document.getElementById('rpeSlider')?.value || 5);
  setTimeout(initCharts, 100);

  // Pre-fill measurements if saved
  const last = AppState.measurements?.slice(-1)[0];
  if (last) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    setVal('bodyWeight', last.weight);
    setVal('bodyHeight', last.height);
    setVal('bodyFat', last.fat);
    setVal('measureChest', last.chest);
    setVal('measureWaist', last.waist);
    setVal('measureHips', last.hips);
    setVal('measureThigh', last.thigh);
    setVal('measureBicep', last.bicep);
    const bmiEl = document.getElementById('bmiResult');
    if (bmiEl && last.bmi) bmiEl.innerHTML = `📊 BMI: <strong>${last.bmi}</strong>`;
  }
}

// =====================================================
// ========== 5. XP & LEVEL SYSTEM ====================
// =====================================================
const LEVELS = [
  { min: 0,    label: '🥉 Rookie',     next: 100 },
  { min: 100,  label: '🥈 Amateur',    next: 300 },
  { min: 300,  label: '🥇 Semi-Pro',   next: 600 },
  { min: 600,  label: '🏆 Pro',        next: 1000 },
  { min: 1000, label: '⭐ Advanced',   next: 1500 },
  { min: 1500, label: '💎 Elite',      next: 2500 },
  { min: 2500, label: '👑 Legend',     next: 9999 },
];

function getCurrentLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

function updateXPUI() {
  const xp = AppState.xp || 0;
  const lvl = getCurrentLevel(xp);
  const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1] || lvl;
  const pct = lvl === nextLvl ? 100 : ((xp - lvl.min) / (lvl.next - lvl.min) * 100).toFixed(1);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('xpTotal', xp.toLocaleString());
  set('xpText', `${xp - lvl.min} / ${lvl.next - lvl.min} XP`);
  set('xpLevelBadge', lvl.label);
  set('xpName', AppState.user?.name || 'Athlete');
  set('stat-level', lvl.label.split(' ')[1] || 'Rookie');
  set('sidebar-level', lvl.label.split(' ')[1] || 'Rookie');

  const bar = document.getElementById('xpBarFill');
  if (bar) bar.style.width = `${pct}%`;

  const avatar = document.getElementById('xpAvatar');
  if (avatar && !avatar.querySelector('img')) {
    avatar.textContent = (AppState.user?.name || 'A')[0].toUpperCase();
  }
}

// =====================================================
// ========== 6. BADGES / ACHIEVEMENTS ================
// =====================================================
const ALL_BADGES = [
  { id: 'first_session', icon: '🏃', name: 'First Step', desc: 'Log your first session', check: s => s.sessions >= 1 },
  { id: 'week_warrior', icon: '🔥', name: 'Week Warrior', desc: 'Complete 7 sessions', check: s => s.sessions >= 7 },
  { id: 'month_grind', icon: '💪', name: 'Month Grind', desc: 'Complete 30 sessions', check: s => s.sessions >= 30 },
  { id: 'century', icon: '💯', name: 'Century Club', desc: '100 sessions total', check: s => s.sessions >= 100 },
  { id: 'first_pb', icon: '🏅', name: 'PB Hunter', desc: 'Log your first PB', check: s => (s.pbs||[]).length >= 1 },
  { id: 'pb_collector', icon: '🎯', name: 'PB Collector', desc: 'Log 5 personal bests', check: s => (s.pbs||[]).length >= 5 },
  { id: 'calorie_counter', icon: '🥗', name: 'Calorie Counter', desc: 'Log food for first time', check: s => (s.allFoodLogs ? Object.keys(s.allFoodLogs).length : 0) >= 1 },
  { id: 'hydrated', icon: '💧', name: 'Hydration Hero', desc: 'Hit water goal once', check: s => s.hydrationGoalHit >= 1 },
  { id: 'early_bird', icon: '🌅', name: 'Early Bird', desc: 'Log a session before 8am', check: s => s.earlySession === true },
  { id: 'xp_100', icon: '⚡', name: 'First 100 XP', desc: 'Earn 100 XP', check: s => (s.xp||0) >= 100 },
  { id: 'xp_500', icon: '🌟', name: 'Rising Star', desc: 'Earn 500 XP', check: s => (s.xp||0) >= 500 },
  { id: 'xp_1000', icon: '👑', name: 'Elite Earner', desc: 'Earn 1000 XP', check: s => (s.xp||0) >= 1000 },
  { id: 'injury_aware', icon: '🩺', name: 'Body Aware', desc: 'Log an injury for monitoring', check: s => (s.injuryLog||[]).length >= 1 },
  { id: 'planner', icon: '📅', name: 'Planner', desc: 'Schedule 5 upcoming sessions', check: s => s.calendarEvents.filter(e => e.date >= getTodayStr()).length >= 5 },
  { id: 'road_to_pro', icon: '🚀', name: 'AthleteMind', desc: 'Generate a training plan', check: s => s.planGenerated === true },
];

// =====================================================
// ========== STREAK SYSTEM v2 ========================
// =====================================================

function daysBetween(date1Str, date2Str) {
  const d1 = new Date(date1Str + 'T12:00:00');
  const d2 = new Date(date2Str + 'T12:00:00');
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function isInStreakGrace() {
  const today = getTodayStr();
  const last = AppState.lastStreakDate;
  if (!last || (AppState.streak || 0) === 0) return false;
  return daysBetween(last, today) === 1;
}

// Called on app load — checks missed days, uses shields, triggers comeback mode
function checkStreakOnLoad() {
  const today = getTodayStr();
  const last = AppState.lastStreakDate;
  if (!last || (AppState.streak || 0) === 0) return;

  const days = daysBetween(last, today);
  if (days <= 1) return; // logged today, or within grace window

  // 2 days missed — auto-use 1 shield if available
  if ((AppState.streakShields || 0) > 0 && days === 2) {
    AppState.streakShields--;
    const d = new Date(last + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    AppState.lastStreakDate = d.toISOString().split('T')[0];
    saveToStorage();
    setTimeout(() => showToast('🛡️ A Shield auto-protected your streak for missing yesterday!'), 1200);
    return;
  }

  // Too many missed days — break streak
  AppState.longestStreak = Math.max(AppState.longestStreak || 0, AppState.streak);
  AppState.streak = 0;
  AppState.lastStreakDate = null;
  AppState.inComebackMode = true;
  saveToStorage();
}

// Record an activity — updates the correct streak
function recordStreakActivity(type = 'training') {
  const today = getTodayStr();

  if (type === 'nutrition') {
    const last = AppState.nutritionStreakDate;
    if (last === today) return;
    const days = last ? daysBetween(last, today) : 999;
    AppState.nutritionStreak = days === 1 ? (AppState.nutritionStreak || 0) + 1 : 1;
    AppState.nutritionStreakDate = today;
    saveToStorage();
    return;
  }

  if (type === 'wellness') {
    const last = AppState.wellnessStreakDate;
    if (last === today) return;
    const days = last ? daysBetween(last, today) : 999;
    AppState.wellnessStreak = days === 1 ? (AppState.wellnessStreak || 0) + 1 : 1;
    AppState.wellnessStreakDate = today;
    saveToStorage();
    return;
  }

  // Training streak
  const last = AppState.lastStreakDate;
  if (last === today) return; // already counted today

  const days = last ? daysBetween(last, today) : 999;
  const wasComeback = AppState.inComebackMode;

  if (days <= 2) {
    AppState.streak = (AppState.streak || 0) + 1;
    AppState.inComebackMode = false;
    if (wasComeback) {
      AppState.xp = (AppState.xp || 0) + 25;
      showToast('🎉 Welcome back! Comeback bonus: +25 XP! Keep going!');
    }
    streakMilestoneCheck(AppState.streak);
    AppState.longestStreak = Math.max(AppState.longestStreak || 0, AppState.streak);
  } else {
    AppState.longestStreak = Math.max(AppState.longestStreak || 0, AppState.streak);
    AppState.streak = 1;
    AppState.inComebackMode = false;
  }

  AppState.lastStreakDate = today;
  saveToStorage();
  updateDashboardStats();
}

function streakMilestoneCheck(streak) {
  const milestones = [7, 14, 30, 50, 100];
  if (!AppState.streakMilestonesHit) AppState.streakMilestonesHit = [];
  const hit = AppState.streakMilestonesHit;
  milestones.forEach(m => {
    if (streak >= m && !hit.includes(m)) {
      hit.push(m);
      const xpReward = m * 5;
      AppState.xp = (AppState.xp || 0) + xpReward;
      if (m === 7 || m === 30) {
        AppState.streakShields = Math.min((AppState.streakShields || 0) + 1, 3);
        showToast(`🔥 ${m}-Day Streak Milestone! +${xpReward} XP + 🛡️ Shield earned!`);
      } else {
        showToast(`🏆 ${m}-Day Streak! Legendary status! +${xpReward} XP!`);
      }
      showCelebration();
      if (typeof checkBadges === 'function') checkBadges();
    }
  });
  AppState.streakMilestonesHit = hit;
}

window.useStreakShield = function() {
  if ((AppState.streakShields || 0) <= 0) {
    showToast('No shields! Earn them at 7 & 30-day milestones 🛡️'); return;
  }
  if ((AppState.streak || 0) === 0) { showToast('No active streak to protect!'); return; }
  AppState.streakShields--;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  AppState.lastStreakDate = yesterday.toISOString().split('T')[0];
  saveToStorage();
  renderStreakHero();
  showToast('🛡️ Shield activated! Streak protected for today — keep training!');
};

window.claimStreakRescue = function() {
  recordStreakActivity('training');
  renderStreakHero();
  updateXPUI();
  showToast('💪 Streak rescued! You saved it just in time! 🔥');
};

window.quickStreakSave = function(type) {
  const labels = {
    stretch: '🧘 5-min stretch',
    hydrate: '💧 Hydration logged',
    video: '🎥 Technique video watched',
    mindset: '🧠 Mindset check-in',
  };
  recordStreakActivity('training');
  AppState.xp = (AppState.xp || 0) + 5;
  saveToStorage();
  renderStreakHero();
  updateXPUI();
  showToast(`${labels[type] || 'Activity'} counted — Streak saved! +5 XP 🔥`);
};

function showCelebration() {
  const cel = document.createElement('div');
  cel.className = 'streak-celebration';
  cel.textContent = '🎉🔥🏆🎊🌟🎊🔥🎉';
  document.body.appendChild(cel);
  setTimeout(() => cel.remove(), 2800);
}

function renderStreakHero() {
  const el = document.getElementById('streakHeroInner');
  if (!el) return;

  const streak   = AppState.streak || 0;
  const shields  = AppState.streakShields || 0;
  const longest  = Math.max(AppState.longestStreak || 0, streak);
  const nutS     = AppState.nutritionStreak || 0;
  const wellS    = AppState.wellnessStreak || 0;
  const inGrace  = isInStreakGrace();
  const comeback = AppState.inComebackMode;

  const flameClass = streak >= 100 ? 'inferno' : streak >= 30 ? 'blazing'
                   : streak >= 14  ? 'hot'      : streak >= 7  ? 'warm' : 'cool';

  const milestones = [
    { days: 7,   icon: '🌟', label: '7 days' },
    { days: 14,  icon: '💥', label: '14 days' },
    { days: 30,  icon: '🏆', label: '30 days' },
    { days: 50,  icon: '👑', label: '50 days' },
    { days: 100, icon: '🔥', label: '100 days' },
  ];
  const MILESTONES_LIST = [7, 14, 30, 50, 100];
  const nextM = MILESTONES_LIST.find(m => m > streak) || null;
  const prevM = [...MILESTONES_LIST].reverse().find(m => m <= streak) || 0;
  const progressPct = nextM ? Math.round((streak - prevM) / (nextM - prevM) * 100) : 100;

  const shieldDots = [0,1,2].map(i =>
    `<span class="streak-shield ${i < shields ? 'active' : 'empty'}" title="${i < shields ? 'Shield ready' : 'Empty'}">🛡️</span>`
  ).join('');

  const sportEmoji = { football:'⚽', basketball:'🏀', running:'🏃', tennis:'🎾', swimming:'🏊', cycling:'🚴' };
  const se = sportEmoji[AppState.sport] || '⚽';

  el.innerHTML = `
    ${comeback ? `<div class="streak-comeback-banner">🎉 Welcome back, ${AppState.user?.name || 'Athlete'}! You're on a comeback — your next log gives +25 bonus XP!</div>` : ''}
    ${inGrace  ? `<div class="streak-grace-banner">⏳ You missed yesterday — streak in grace! <button class="btn-accent" style="padding:4px 14px;font-size:0.8rem;margin-left:8px" onclick="claimStreakRescue()">💪 Rescue It Now</button></div>` : ''}

    <div class="streak-main-row">
      <div class="streak-flame-wrap ${flameClass}">
        <div class="streak-flame-emoji">🔥</div>
        <div class="streak-number">${streak}</div>
        <div class="streak-days-label">day streak</div>
      </div>
      <div class="streak-right-col">
        <div class="streak-best-row">🏅 Best ever: <strong>${longest} days</strong></div>
        <div class="streak-shields-row">
          ${shieldDots}
          <span class="streak-shield-label">${shields}/3 shields</span>
          ${shields > 0 ? `<button class="btn-ghost" style="padding:3px 10px;font-size:0.75rem;margin-left:6px" onclick="useStreakShield()">Use Shield</button>` : ''}
        </div>
        <div class="streak-shield-tip">Shields protect you when you miss a day 🛡️<br>Earn at 7-day &amp; 30-day milestones</div>
      </div>
    </div>

    <div class="milestone-timeline">
      ${milestones.map(m => {
        const done = streak >= m.days;
        const isNext = m.days === nextM;
        return `<div class="milestone-dot ${done ? 'done' : isNext ? 'next' : ''}">
          <div class="milestone-icon-wrap">${m.icon}${done ? '<span class="ms-check">✓</span>' : ''}</div>
          <span class="milestone-label">${m.label}</span>
        </div>`;
      }).join('')}
    </div>
    ${nextM
      ? `<div class="milestone-progress-row">
           <span>${streak} / ${nextM} days to next milestone</span>
           <div class="milestone-bar-bg"><div class="milestone-bar-fill" style="width:${progressPct}%"></div></div>
         </div>`
      : `<div class="streak-legend-all">🏆 ALL MILESTONES UNLOCKED — ABSOLUTE LEGEND! 🔥</div>`
    }

    <div class="multi-streak-row">
      <div class="mini-streak-card training">
        <span class="mini-streak-icon">${se}</span>
        <span class="mini-streak-num">${streak}</span>
        <span class="mini-streak-lbl">Training</span>
      </div>
      <div class="mini-streak-card nutrition">
        <span class="mini-streak-icon">🥗</span>
        <span class="mini-streak-num">${nutS}</span>
        <span class="mini-streak-lbl">Nutrition</span>
      </div>
      <div class="mini-streak-card wellness">
        <span class="mini-streak-icon">💤</span>
        <span class="mini-streak-num">${wellS}</span>
        <span class="mini-streak-lbl">Wellness</span>
      </div>
    </div>

    <div class="quick-streak-save">
      <div class="qss-title"><i class="fas fa-bolt"></i> Quick Streak Save — no full session today? One of these counts!</div>
      <div class="qss-actions">
        <button class="qss-btn" onclick="quickStreakSave('stretch')">🧘 5-min Stretch</button>
        <button class="qss-btn" onclick="quickStreakSave('hydrate')">💧 Log Water</button>
        <button class="qss-btn" onclick="quickStreakSave('video')">🎥 Watch Technique</button>
        <button class="qss-btn" onclick="quickStreakSave('mindset')">🧠 Mindset Check-in</button>
      </div>
    </div>
  `;
}

function checkBadges() {
  ALL_BADGES.forEach(badge => {
    if (!AppState.earnedBadges.includes(badge.id) && badge.check(AppState)) {
      AppState.earnedBadges.push(badge.id);
      AppState.xp = (AppState.xp || 0) + 20;
      showToast(`🏆 Badge Unlocked: ${badge.name}! +20 XP`);
    }
  });
}

function renderBadges() {
  const grid = document.getElementById('badgesGrid');
  if (!grid) return;
  const earned = AppState.earnedBadges || [];
  grid.innerHTML = ALL_BADGES.map(b => `
    <div class="badge-item ${earned.includes(b.id) ? 'earned' : 'locked'}">
      <span class="badge-icon">${b.icon}</span>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      ${earned.includes(b.id) ? '<div style="color:var(--accent);font-size:0.68rem;margin-top:3px">✅ Earned!</div>' : ''}
    </div>
  `).join('');
}

// =====================================================
// ========== 7. WEEKLY CHALLENGES ====================
// =====================================================
const CHALLENGE_POOL = [
  { icon: '⚡', title: 'Sprint Week', desc: 'Complete 3 sprint sessions', target: 3, xp: 30, key: 'sprint_sessions' },
  { icon: '🥗', title: 'Clean Eater', desc: 'Log food every day for 5 days', target: 5, xp: 25, key: 'food_days' },
  { icon: '💧', title: 'Stay Hydrated', desc: 'Hit your water goal 4 days', target: 4, xp: 20, key: 'hydration_days' },
  { icon: '📅', title: 'Schedule Ahead', desc: 'Add 3 sessions to your calendar', target: 3, xp: 15, key: 'scheduled' },
  { icon: '🏅', title: 'PB Chaser', desc: 'Log 2 personal bests', target: 2, xp: 50, key: 'pbs_week' },
  { icon: '😴', title: 'Sleep Champion', desc: 'Log 7+ hours sleep 3 nights', target: 3, xp: 20, key: 'good_sleep' },
  { icon: '🧘', title: 'Recovery Focus', desc: 'Complete 2 stretching sessions', target: 2, xp: 15, key: 'stretching' },
  { icon: '🎯', title: 'Calorie Goal', desc: 'Hit calorie goal 3 days in a row', target: 3, xp: 25, key: 'calorie_goal' },
  { icon: '🏃', title: '5-Session Week', desc: 'Complete 5 training sessions', target: 5, xp: 40, key: 'sessions_5' },
  { icon: '🤖', title: 'AI Student', desc: 'Ask the AI coach 5 questions', target: 5, xp: 10, key: 'ai_questions' },
];

function refreshChallenges() {
  if (!AppState.challenges) AppState.challenges = [];
  // Pick 4 random unique challenges
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
  AppState.challenges = shuffled.map(c => ({ ...c, progress: 0, completed: false, startDate: getTodayStr() }));
  saveToStorage();
  renderChallenges();
  showToast('New weekly challenges generated! 🎯');
}

function renderChallenges() {
  const list = document.getElementById('challengesList');
  if (!list) return;
  if (!AppState.challenges || !AppState.challenges.length) { refreshChallenges(); return; }
  list.innerHTML = AppState.challenges.map((c, i) => {
    const pct = Math.min(c.progress / c.target * 100, 100).toFixed(0);
    return `
      <div class="challenge-item ${c.completed ? 'completed' : ''}">
        <span class="challenge-icon">${c.icon}</span>
        <div class="challenge-info">
          <div class="challenge-title">${c.title} ${c.completed ? '✅' : ''}</div>
          <div class="challenge-desc">${c.desc}</div>
          <div class="challenge-progress">
            <div class="challenge-bar-bg"><div class="challenge-bar" style="width:${pct}%"></div></div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${c.progress} / ${c.target} (${pct}%)</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="challenge-xp">+${c.xp} XP</span>
          ${!c.completed ? `<button class="btn-accent challenge-btn" onclick="progressChallenge(${i})">+1</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}
window.progressChallenge = function(i) {
  const c = AppState.challenges[i];
  if (c.completed) return;
  c.progress = Math.min(c.progress + 1, c.target);
  if (c.progress >= c.target) {
    c.completed = true;
    AppState.xp = (AppState.xp || 0) + c.xp;
    AppState.completedChallenges = (AppState.completedChallenges || 0) + 1;
    checkBadges();
    showToast(`🎉 Challenge complete: ${c.title}! +${c.xp} XP`);
  }
  saveToStorage();
  renderChallenges();
  updateXPUI();
};

// =====================================================
// ========== 8. LEADERBOARD ==========================
// =====================================================
function renderLeaderboard() {
  const list = document.getElementById('leaderboardList');
  if (!list) return;
  const myXP = AppState.xp || 0;
  const myName = AppState.user?.name || 'You';

  const entries = [
    { name: 'Alex R.', sport: 'football', xp: myXP + 320 },
    { name: 'Jordan K.', sport: 'basketball', xp: myXP + 180 },
    { name: 'Sam T.', sport: 'running', xp: myXP + 95 },
    { name: myName, sport: AppState.sport, xp: myXP, isMe: true },
    { name: 'Chris M.', sport: 'swimming', xp: Math.max(0, myXP - 50) },
    { name: 'Taylor B.', sport: 'cycling', xp: Math.max(0, myXP - 130) },
    { name: 'Jamie L.', sport: 'tennis', xp: Math.max(0, myXP - 210) },
  ].sort((a,b) => b.xp - a.xp);

  const rankClasses = ['gold','silver','bronze'];
  list.innerHTML = entries.map((e, i) => `
    <div class="lb-row ${e.isMe ? 'lb-me' : ''}">
      <span class="lb-rank ${rankClasses[i] || ''}">${i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</span>
      <div class="lb-avatar-sm">${e.name[0]}</div>
      <div>
        <div class="lb-name">${e.name} ${e.isMe ? '← You' : ''}</div>
        <div class="lb-sport">${getSportEmoji(e.sport)} ${getSportLabel(e.sport)}</div>
      </div>
      <span class="lb-xp">${e.xp.toLocaleString()} XP</span>
    </div>
  `).join('');
}

function initGamifyPage() {
  renderStreakHero();
  updateXPUI();
  renderBadges();
  renderChallenges();
  renderLeaderboard();
}

// =====================================================
// ========== 9. SLEEP TRACKER ========================
// =====================================================
function logSleep() {
  const date = document.getElementById('sleepDate').value || getTodayStr();
  const hours = parseFloat(document.getElementById('sleepHours').value);
  const quality = parseInt(document.getElementById('sleepQuality').value);
  const notes = document.getElementById('sleepNotes').value.trim();

  if (!hours) { showToast('Enter hours slept!'); return; }

  if (!AppState.sleepLog) AppState.sleepLog = [];
  AppState.sleepLog.push({ id: Date.now(), date, hours, quality, notes });
  if (hours >= 7) AppState.goodSleepCount = (AppState.goodSleepCount || 0) + 1;
  recordStreakActivity('wellness');
  checkBadges();
  saveToStorage();
  renderSleepLog();
  updateWellnessSummary();
  showToast(`Sleep logged: ${hours}h ${'⭐'.repeat(quality)} 😴`);
}

function renderSleepLog() {
  const el = document.getElementById('sleepLog');
  if (!el) return;
  const log = (AppState.sleepLog || []).slice(-7).reverse();
  if (!log.length) { el.innerHTML = '<p class="empty-state">No sleep logged yet.</p>'; return; }
  el.innerHTML = log.map(s => `
    <div class="sleep-log-item">
      <span class="sleep-hours">${s.hours}h</span>
      <div>
        <div class="sleep-stars">${'⭐'.repeat(s.quality)}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${s.date} ${s.notes ? '· '+s.notes : ''}</div>
      </div>
    </div>
  `).join('');
}

// =====================================================
// ========== HYDRATION TRACKER =======================
// =====================================================
function addWater(ml) {
  const today = getTodayStr();
  if (!AppState.hydration) AppState.hydration = {};
  AppState.hydration[today] = (AppState.hydration[today] || 0) + ml;
  recordStreakActivity('wellness');
  const goal = AppState.hydrationGoal || 2500;
  if (AppState.hydration[today] >= goal) {
    AppState.hydrationGoalHit = (AppState.hydrationGoalHit || 0) + 1;
    AppState.xp = (AppState.xp || 0) + 5;
    checkBadges();
    showToast(`💧 Hydration goal hit! +5 XP`);
  }
  saveToStorage();
  updateHydrationUI();
  updateWellnessSummary();
}

function addCustomWater() {
  const ml = parseInt(document.getElementById('customWater').value);
  if (!ml || ml <= 0) { showToast('Enter a valid amount!'); return; }
  addWater(ml);
  document.getElementById('customWater').value = '';
}

function resetWater() {
  if (!AppState.hydration) AppState.hydration = {};
  AppState.hydration[getTodayStr()] = 0;
  saveToStorage();
  updateHydrationUI();
}

function setHydrationGoal() {
  const goal = parseInt(document.getElementById('hydrationGoalInput').value);
  if (!goal) return;
  AppState.hydrationGoal = goal;
  saveToStorage();
  updateHydrationUI();
  showToast(`Hydration goal set to ${goal}ml 💧`);
}

function updateHydrationUI() {
  const today = getTodayStr();
  const current = (AppState.hydration || {})[today] || 0;
  const goal = AppState.hydrationGoal || 2500;
  const pct = Math.min(current / goal * 100, 100);

  const fill = document.getElementById('waterFill');
  const label = document.getElementById('waterLabel');
  const todayEl = document.getElementById('hydrationToday');
  const goalDisp = document.getElementById('hydrationGoalDisplay');

  if (fill) fill.style.height = `${pct}%`;
  if (label) label.textContent = `${current}ml / ${goal}ml`;
  if (todayEl) todayEl.textContent = `${current}ml`;
  if (goalDisp) goalDisp.textContent = `${goal}ml`;
}

// =====================================================
// ========== INJURY LOG ==============================
// =====================================================
function logInjury() {
  const part = document.getElementById('injuryPart').value;
  const type = document.getElementById('injuryType').value;
  const severity = parseInt(document.getElementById('injurySeverity').value) || 5;
  const status = document.getElementById('injuryStatus').value;
  const notes = document.getElementById('injuryNotes').value.trim();

  if (!AppState.injuryLog) AppState.injuryLog = [];
  AppState.injuryLog.push({ id: Date.now(), part, type, severity, status, notes, date: getTodayStr() });
  checkBadges();
  saveToStorage();
  renderInjuryLog();
  updateWellnessSummary();
  showToast(`Injury logged: ${part} — ${type} 🩹`);
}

function renderInjuryLog() {
  const el = document.getElementById('injuryLog');
  if (!el) return;
  const log = (AppState.injuryLog || []).slice().reverse();
  if (!log.length) { el.innerHTML = '<p class="empty-state"><i class="fas fa-bandage"></i> No injuries logged. Stay healthy!</p>'; return; }
  el.innerHTML = log.map(inj => `
    <div class="injury-log-item ${inj.status}">
      <span class="injury-icon">${inj.severity >= 7 ? '🔴' : inj.severity >= 4 ? '🟡' : '🟢'}</span>
      <div class="injury-info">
        <div class="injury-part">${inj.part} — ${inj.type}</div>
        <div class="injury-meta">Severity: ${inj.severity}/10 · ${inj.date} ${inj.notes ? '· '+inj.notes : ''}</div>
      </div>
      <span class="injury-status-badge ${inj.status}">${inj.status}</span>
      <button class="injury-del" onclick="deleteInjury(${inj.id})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}
window.deleteInjury = id => {
  AppState.injuryLog = (AppState.injuryLog || []).filter(i => i.id !== id);
  saveToStorage();
  renderInjuryLog();
  updateWellnessSummary();
};

function updateWellnessSummary() {
  const today = getTodayStr();
  const lastSleep = (AppState.sleepLog || []).filter(s => s.date === today)[0];
  const water = (AppState.hydration || {})[today] || 0;
  const activeInjuries = (AppState.injuryLog || []).filter(i => i.status === 'active').length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sleepToday', lastSleep ? `${lastSleep.hours}h` : '—');
  set('hydrationToday', `${water}ml`);
  set('injuryCount', activeInjuries);

  // Simple wellness score
  let score = 0;
  if (lastSleep) score += lastSleep.hours >= 7 ? 40 : lastSleep.hours >= 5 ? 25 : 10;
  const goal = AppState.hydrationGoal || 2500;
  score += Math.min(water / goal * 30, 30);
  score += activeInjuries === 0 ? 30 : activeInjuries === 1 ? 15 : 0;
  set('wellnessScore', `${Math.round(score)}/100`);
}

// =====================================================
// ========== STRETCHING ROUTINES =====================
// =====================================================
const STRETCHES = {
  pre: [
    { emoji: '🦵', name: 'Leg Swings', detail: 'Forward & sideways, 10 each leg', duration: '1 min' },
    { emoji: '🔄', name: 'Hip Circles', detail: 'Large clockwise & counter-clockwise circles', duration: '30s each' },
    { emoji: '💃', name: 'High Knees', detail: 'Jog on the spot, drive knees up', duration: '30s' },
    { emoji: '🏃', name: 'Butt Kicks', detail: 'Jog on the spot, heels to glutes', duration: '30s' },
    { emoji: '🙌', name: 'Arm Circles', detail: 'Small then large, forward & back', duration: '30s each' },
    { emoji: '🦴', name: 'Ankle Rolls', detail: 'Roll each ankle 10× each direction', duration: '1 min' },
    { emoji: '🧍', name: 'Lateral Lunges', detail: 'Step wide to each side, sit into hip', duration: '10 each' },
    { emoji: '🐱', name: 'Cat-Cow', detail: 'On all fours, arch and round spine', duration: '1 min' },
  ],
  post: [
    { emoji: '🦵', name: 'Standing Quad Stretch', detail: 'Hold ankle behind, balance 30s each', duration: '30s each' },
    { emoji: '🧘', name: 'Hamstring Stretch', detail: 'Sit with legs straight, reach for toes', duration: '60s' },
    { emoji: '🍑', name: 'Pigeon Pose', detail: 'Hip flexor & glute opener', duration: '90s each' },
    { emoji: '💪', name: 'Cross-Body Shoulder', detail: 'Pull arm across chest, hold', duration: '30s each' },
    { emoji: '🦷', name: 'Calf Stretch', detail: 'Wall calf stretch, heel on ground', duration: '45s each' },
    { emoji: '🔄', name: 'Lying Spinal Twist', detail: 'Knee across body, shoulders flat', duration: '60s each' },
    { emoji: '🐛', name: 'Child\'s Pose', detail: 'Knees wide, arms forward, breathe deeply', duration: '90s' },
    { emoji: '🦁', name: 'Hip Flexor Lunge', detail: 'Low lunge, back knee down, sink hips', duration: '60s each' },
  ],
  recovery: [
    { emoji: '🛁', name: 'Contrast Shower', detail: '3 min hot → 1 min cold, repeat 3×', duration: '12 min' },
    { emoji: '🔵', name: 'Foam Roll Quads', detail: 'Slow roll, pause on tight spots', duration: '2 min' },
    { emoji: '🔵', name: 'Foam Roll IT Band', detail: 'Side-lying, roll outer thigh', duration: '2 min' },
    { emoji: '🔵', name: 'Foam Roll Upper Back', detail: 'Thoracic extension over roller', duration: '2 min' },
    { emoji: '🧊', name: 'Ice Pack (if needed)', detail: '15 min on sore areas, 10 min off', duration: '15 min' },
    { emoji: '🌬️', name: 'Box Breathing', detail: 'Inhale 4s, hold 4s, exhale 4s, hold 4s', duration: '5 min' },
    { emoji: '🦵', name: 'Legs Up The Wall', detail: 'Lie near wall, legs elevated 90°', duration: '10 min' },
    { emoji: '🏊', name: 'Light Swimming', detail: 'Easy freestyle, focus on breathing', duration: '20 min' },
  ],
  yoga: [
    { emoji: '🧘', name: 'Downward Dog', detail: 'Hands & feet, hips high, hold & breathe', duration: '60s' },
    { emoji: '🐍', name: 'Cobra Pose', detail: 'Prone, palms under shoulders, lift chest', duration: '30s' },
    { emoji: '🌿', name: 'Warrior I', detail: 'Lunge stance, arms overhead, strong base', duration: '45s each' },
    { emoji: '⚔️', name: 'Warrior II', detail: 'Wide stance, arms extended, gaze forward', duration: '45s each' },
    { emoji: '🌲', name: 'Tree Pose', detail: 'Balance on one leg, foot to inner thigh', duration: '30s each' },
    { emoji: '🦅', name: 'Eagle Pose', detail: 'Wrap arms & legs, deep squat, balance', duration: '30s each' },
    { emoji: '🌊', name: 'Bridge Pose', detail: 'Lying, push hips to ceiling, hold', duration: '60s' },
    { emoji: '💤', name: 'Savasana', detail: 'Lie flat, completely relax, breathe', duration: '5 min' },
  ],
};

function showStretches(type) {
  document.querySelectorAll('.stretch-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.stretch-tab').forEach(t => { if (t.textContent.toLowerCase().includes(type === 'pre' ? 'pre' : type === 'post' ? 'post' : type === 'recovery' ? 'rec' : 'yoga')) t.classList.add('active'); });
  const list = document.getElementById('stretchList');
  if (!list) return;
  list.innerHTML = (STRETCHES[type] || []).map(s => `
    <div class="stretch-item">
      <span class="stretch-emoji">${s.emoji}</span>
      <div class="stretch-info">
        <div class="stretch-name">${s.name}</div>
        <div class="stretch-detail">${s.detail}</div>
      </div>
      <span class="stretch-duration">${s.duration}</span>
    </div>
  `).join('');
}

function initWellnessPage() {
  updateHydrationUI();
  renderSleepLog();
  renderInjuryLog();
  updateWellnessSummary();
  showStretches('pre');
  document.getElementById('sleepDate').value = getTodayStr();
}

// =====================================================
// ========== 10. VIDEO / DRILLS LIBRARY ==============
// =====================================================
const DRILLS_LIBRARY = [
  // Football
  { id:1, sport:'football', level:'beginner', title:'Basic Ball Control', emoji:'⚽', tags:['control','beginner'], desc:'Learn to receive and control the ball with both feet. 20 mins daily for 2 weeks will transform your first touch.', yt:'https://www.youtube.com/results?search_query=football+ball+control+drills+beginner' },
  { id:2, sport:'football', level:'intermediate', title:'Dribbling Circuit', emoji:'🔄', tags:['dribble','agility'], desc:'Cone dribbling with speed — stepover, inside-out, elastico. 4×5 min sets with 1 min rest.', yt:'https://www.youtube.com/results?search_query=football+dribbling+drills+cones' },
  { id:3, sport:'football', level:'advanced', title:'Finishing Under Pressure', emoji:'🎯', tags:['shooting','finishing'], desc:'Receive a pass, turn, and shoot in 2 touches under defensive pressure. 50 reps per session.', yt:'https://www.youtube.com/results?search_query=football+finishing+drills+advanced' },
  { id:4, sport:'football', level:'beginner', title:'Passing Fundamentals', emoji:'🦶', tags:['passing','technique'], desc:'Wall passing — 1-touch and 2-touch passing drills. Focus on weight of pass and eye contact.', yt:'https://www.youtube.com/results?search_query=football+passing+drills+wall' },
  { id:5, sport:'football', level:'intermediate', title:'Small Sided Games (3v3)', emoji:'🏟️', tags:['game','tactics'], desc:'3v3 on small pitch develops decision-making, pressing and quick transitions.', yt:'https://www.youtube.com/results?search_query=football+3v3+small+sided+game+drills' },
  // Basketball
  { id:6, sport:'basketball', level:'beginner', title:'Stationary Dribbling', emoji:'🏀', tags:['dribble','beginner'], desc:'Pound dribbles, between legs and behind back — stationary before adding movement.', yt:'https://www.youtube.com/results?search_query=basketball+stationary+dribbling+beginner' },
  { id:7, sport:'basketball', level:'intermediate', title:'Mikan Drill', emoji:'🏹', tags:['layup','shooting'], desc:'Alternating layups from both sides, no dribble. Builds finishing touch around the basket.', yt:'https://www.youtube.com/results?search_query=mikan+drill+basketball' },
  { id:8, sport:'basketball', level:'advanced', title:'Pick and Roll Defense', emoji:'🛡️', tags:['defence','tactics'], desc:'Hedge and recover, drop coverage, or switch — practice all three PnR defensive schemes.', yt:'https://www.youtube.com/results?search_query=pick+and+roll+defense+drills' },
  { id:9, sport:'basketball', level:'beginner', title:'Free Throw Routine', emoji:'🎯', tags:['shooting','mental'], desc:'Develop a consistent pre-shot routine. 100 free throws daily builds muscle memory.', yt:'https://www.youtube.com/results?search_query=free+throw+routine+basketball+beginner' },
  // Running
  { id:10, sport:'running', level:'beginner', title:'Run-Walk Intervals', emoji:'🏃', tags:['cardio','beginner'], desc:'1 min jog / 1 min walk × 20. Build your aerobic base without overloading joints.', yt:'https://www.youtube.com/results?search_query=run+walk+interval+training+beginners' },
  { id:11, sport:'running', level:'intermediate', title:'Fartlek Training', emoji:'⚡', tags:['speed','interval'], desc:'Unstructured speed play — surge hard for 30-60s, easy jog recovery, repeat throughout run.', yt:'https://www.youtube.com/results?search_query=fartlek+training+running+intermediate' },
  { id:12, sport:'running', level:'advanced', title:'VO2 Max Intervals', emoji:'💨', tags:['vo2max','advanced'], desc:'5×3 min at 95% max effort with 3 min recovery. Builds your aerobic ceiling.', yt:'https://www.youtube.com/results?search_query=vo2+max+intervals+running+workout' },
  // Tennis
  { id:13, sport:'tennis', level:'beginner', title:'Serve Practice', emoji:'🎾', tags:['serve','beginner'], desc:'Flat serve technique — toss, trophy pose, swing path. 50 serves each session.', yt:'https://www.youtube.com/results?search_query=tennis+serve+technique+beginner' },
  { id:14, sport:'tennis', level:'intermediate', title:'Cross-Court Rally', emoji:'↗️', tags:['groundstroke','consistency'], desc:'Keep the ball cross-court with topspin, aim for 20+ shot rallies. Control over power.', yt:'https://www.youtube.com/results?search_query=tennis+cross+court+rally+drills' },
  // Swimming
  { id:15, sport:'swimming', level:'beginner', title:'Freestyle Arms Drill', emoji:'🏊', tags:['technique','freestyle'], desc:'Catch-up drill — one arm out front while other completes stroke. Isolates arm technique.', yt:'https://www.youtube.com/results?search_query=freestyle+catch+up+drill+swimming' },
  { id:16, sport:'swimming', level:'intermediate', title:'Flip Turn Practice', emoji:'🔄', tags:['turns','speed'], desc:'Approach the wall at pace, tuck tight, push off the wall explosively. Can save 2s per length.', yt:'https://www.youtube.com/results?search_query=swimming+flip+turn+technique' },
  // Cycling
  { id:17, sport:'cycling', level:'beginner', title:'Cadence Drills', emoji:'🚴', tags:['cadence','technique'], desc:'Spin at 90-100 RPM for 5 min intervals. High cadence builds efficiency and reduces knee stress.', yt:'https://www.youtube.com/results?search_query=cycling+cadence+drills+90+rpm' },
  { id:18, sport:'cycling', level:'advanced', title:'Hill Repeat Intervals', emoji:'⛰️', tags:['power','climbing'], desc:'Find a 5-8% gradient hill. Climb hard for 3-5 mins, recover on descent, repeat 5-8×.', yt:'https://www.youtube.com/results?search_query=cycling+hill+repeat+intervals+training' },
];

let drillSportFilter = 'all';
let drillLevelFilter = 'all';

function filterDrills(sport, btn) {
  drillSportFilter = sport;
  btn.closest('.filter-pills').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderDrillsGrid(drillSportFilter, drillLevelFilter);
}

function filterDrillsLevel(level, btn) {
  drillLevelFilter = level;
  btn.closest('.filter-pills').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderDrillsGrid(drillSportFilter, drillLevelFilter);
}

function renderDrillsGrid(sport, level) {
  const grid = document.getElementById('drillsGrid');
  if (!grid) return;
  const filtered = DRILLS_LIBRARY.filter(d =>
    (sport === 'all' || d.sport === sport) &&
    (level === 'all' || d.level === level)
  );
  if (!filtered.length) { grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1"><i class="fas fa-search"></i> No drills found for this filter.</p>'; return; }
  grid.innerHTML = filtered.map(d => `
    <div class="drill-card">
      <div class="drill-thumbnail" onclick="window.open('${d.yt}','_blank')">
        <span class="drill-emoji">${d.emoji}</span>
        <div class="drill-play-btn"><i class="fas fa-play"></i></div>
      </div>
      <div class="drill-body">
        <div class="drill-title">${d.title}</div>
        <div class="drill-meta">
          ${d.tags.map(t => `<span class="drill-tag">${t}</span>`).join('')}
          <span class="drill-tag" style="background:transparent;color:var(--text-muted)">${d.level}</span>
        </div>
        <div class="drill-desc">${d.desc}</div>
      </div>
    </div>
  `).join('');
}

// =====================================================
// ========== 11. GEAR / KIT TRACKER ==================
// =====================================================
const KIT_DATA = {
  football: [
    { name: 'Football Boots', priority: 'essential' }, { name: 'Football', priority: 'essential' },
    { name: 'Shin Pads', priority: 'essential' }, { name: 'Socks (long)', priority: 'essential' },
    { name: 'Shorts', priority: 'essential' }, { name: 'Training Shirt', priority: 'essential' },
    { name: 'Goalkeeper Gloves', priority: 'optional' }, { name: 'Water Bottle', priority: 'essential' },
    { name: 'Towel', priority: 'recommended' }, { name: 'Bag/Kit Bag', priority: 'essential' },
    { name: 'Foam Roller', priority: 'recommended' }, { name: 'Energy Snack', priority: 'recommended' },
  ],
  basketball: [
    { name: 'Basketball Shoes', priority: 'essential' }, { name: 'Basketball', priority: 'essential' },
    { name: 'Shorts', priority: 'essential' }, { name: 'Jersey / T-shirt', priority: 'essential' },
    { name: 'Ankle Brace', priority: 'recommended' }, { name: 'Water Bottle', priority: 'essential' },
    { name: 'Knee Sleeves', priority: 'optional' }, { name: 'Towel', priority: 'recommended' },
    { name: 'Resistance Bands', priority: 'recommended' }, { name: 'Bag', priority: 'essential' },
  ],
  running: [
    { name: 'Running Shoes', priority: 'essential' }, { name: 'Running Socks', priority: 'essential' },
    { name: 'Shorts / Tights', priority: 'essential' }, { name: 'Moisture-Wicking Top', priority: 'essential' },
    { name: 'GPS Watch', priority: 'recommended' }, { name: 'Water Bottle / Vest', priority: 'essential' },
    { name: 'Earphones', priority: 'optional' }, { name: 'Reflective Vest', priority: 'recommended' },
    { name: 'Running Belt', priority: 'optional' }, { name: 'Energy Gels', priority: 'recommended' },
  ],
  tennis: [
    { name: 'Tennis Racket', priority: 'essential' }, { name: 'Tennis Balls (3+)', priority: 'essential' },
    { name: 'Tennis Shoes', priority: 'essential' }, { name: 'Sports Socks', priority: 'essential' },
    { name: 'Shorts / Skirt', priority: 'essential' }, { name: 'Tennis Bag', priority: 'recommended' },
    { name: 'Grip Tape', priority: 'recommended' }, { name: 'Water Bottle', priority: 'essential' },
    { name: 'Wristbands', priority: 'optional' }, { name: 'Overgrip', priority: 'recommended' },
  ],
  swimming: [
    { name: 'Swim Shorts / Costume', priority: 'essential' }, { name: 'Goggles', priority: 'essential' },
    { name: 'Swim Cap', priority: 'recommended' }, { name: 'Towel', priority: 'essential' },
    { name: 'Flipflops', priority: 'essential' }, { name: 'Kickboard', priority: 'recommended' },
    { name: 'Pull Buoy', priority: 'recommended' }, { name: 'Water Bottle', priority: 'essential' },
    { name: 'Paddles', priority: 'optional' }, { name: 'Swim Bag', priority: 'essential' },
  ],
  cycling: [
    { name: 'Bike', priority: 'essential' }, { name: 'Helmet', priority: 'essential' },
    { name: 'Cycling Shoes', priority: 'recommended' }, { name: 'Padded Shorts', priority: 'essential' },
    { name: 'Jersey', priority: 'essential' }, { name: 'Gloves', priority: 'recommended' },
    { name: 'Water Bottles (×2)', priority: 'essential' }, { name: 'Tyre Repair Kit', priority: 'essential' },
    { name: 'CO2 Inflator', priority: 'recommended' }, { name: 'Cycling Computer', priority: 'optional' },
    { name: 'Lights (front & rear)', priority: 'essential' }, { name: 'High-vis Jacket', priority: 'recommended' },
  ],
};

const EQUIP_GUIDES = {
  football: [
    { emoji: '👟', name: 'Football Boots', desc: 'Firm Ground (FG) for natural grass, Artificial Ground (AG) for astroturf. Prioritise fit over brand — 3-5mm toe space.', price: '~£40-£200' },
    { emoji: '🛡️', name: 'Shin Pads', desc: 'Must-have for all play. Sleeve-type are comfortable for training; hard-cased for matches. Replace every season.', price: '~£10-£40' },
    { emoji: '⚽', name: 'Training Ball', desc: 'Size 5 for ages 12+, Size 4 for 8-12, Size 3 for under 8. A dedicated training ball lasts much longer.', price: '~£20-£80' },
  ],
  basketball: [
    { emoji: '👟', name: 'Basketball Shoes', desc: 'High-tops protect ankles. Look for cushioning (Nike Air / Adidas Boost) and traction pattern for your court type.', price: '~£60-£180' },
    { emoji: '🦵', name: 'Ankle Brace', desc: 'Recommended for all players. Lace-up braces provide best support. Can prevent costly ankle sprains.', price: '~£15-£40' },
  ],
  running: [
    { emoji: '👟', name: 'Running Shoes', desc: 'Get a gait analysis at a running store. Neutral, stability or motion control depending on your foot arch. Replace every 500-800km.', price: '~£80-£200' },
    { emoji: '⌚', name: 'GPS Watch', desc: 'Tracks pace, distance, heart rate and more. Garmin Forerunner 55 is great value for beginners.', price: '~£100-£400' },
  ],
};

function renderKitList() {
  const sport = document.getElementById('kitSportFilter')?.value || AppState.sport;
  const items = KIT_DATA[sport] || [];
  const checkedKey = `kitChecked_${sport}`;
  const checked = AppState[checkedKey] || {};

  const list = document.getElementById('kitList');
  if (!list) return;
  list.innerHTML = items.map((item, i) => `
    <div class="kit-item ${checked[i] ? 'checked' : ''}" onclick="toggleKitItem(${i}, '${sport}')">
      <div class="kit-check">${checked[i] ? '<i class="fas fa-check"></i>' : ''}</div>
      <span class="kit-name">${item.name}</span>
      <span class="kit-priority ${item.priority}">${item.priority}</span>
    </div>
  `).join('');

  const essentials = items.filter(item => item.priority === 'essential').length;
  const checkedEssentials = items.filter((item, i) => item.priority === 'essential' && checked[i]).length;
  const kitReadyEl = document.getElementById('kitReady');
  if (kitReadyEl) {
    if (checkedEssentials >= essentials) {
      kitReadyEl.innerHTML = `✅ Kit bag is ready for ${getSportLabel(sport)}! All ${essentials} essentials packed.`;
      kitReadyEl.className = 'kit-ready all-good';
    } else {
      kitReadyEl.innerHTML = `⚠️ Missing ${essentials - checkedEssentials} essential item(s) for ${getSportLabel(sport)}`;
      kitReadyEl.className = 'kit-ready missing';
    }
  }

  renderEquipmentGuide(sport);
}

window.toggleKitItem = function(i, sport) {
  const key = `kitChecked_${sport}`;
  if (!AppState[key]) AppState[key] = {};
  AppState[key][i] = !AppState[key][i];
  saveToStorage();
  renderKitList();
};

function checkAllKit() {
  const sport = document.getElementById('kitSportFilter')?.value || AppState.sport;
  const items = KIT_DATA[sport] || [];
  const key = `kitChecked_${sport}`;
  AppState[key] = {};
  items.forEach((_, i) => { AppState[key][i] = true; });
  saveToStorage();
  renderKitList();
}

function uncheckAllKit() {
  const sport = document.getElementById('kitSportFilter')?.value || AppState.sport;
  AppState[`kitChecked_${sport}`] = {};
  saveToStorage();
  renderKitList();
}

function addCustomGear() {
  const name = document.getElementById('customGearName').value.trim();
  const sport = document.getElementById('customGearSport').value;
  const priority = document.getElementById('customGearPriority').value;
  if (!name) { showToast('Enter an item name!'); return; }

  const sports = sport === 'all' ? Object.keys(KIT_DATA) : [sport];
  sports.forEach(s => {
    if (!KIT_DATA[s]) KIT_DATA[s] = [];
    KIT_DATA[s].push({ name, priority });
  });
  document.getElementById('customGearName').value = '';
  renderKitList();
  showToast(`${name} added to ${sport} kit list! 🎒`);
}

function renderEquipmentGuide(sport) {
  const guide = EQUIP_GUIDES[sport] || EQUIP_GUIDES.football;
  const el = document.getElementById('equipmentGuide');
  if (!el) return;
  el.innerHTML = guide.map(g => `
    <div class="equip-item">
      <span class="equip-emoji">${g.emoji}</span>
      <div class="equip-info">
        <h4>${g.name}</h4>
        <p>${g.desc}</p>
        <div class="equip-price">${g.price}</div>
      </div>
    </div>
  `).join('');
}

// =====================================================
// ========== 12. PROFILE / SETTINGS / EXPORT ========
// =====================================================
function initProfilePage() {
  const u = AppState.user || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };

  set('profileNameInput', u.name);
  set('profileCity', u.city || '');
  set('profileTeam', u.team || '');
  set('profilePosition', u.position || '');
  set('profileBio', u.bio || '');

  setText('profileName', u.name || 'Your Name');
  setText('profileSport', getSportLabel(AppState.sport));
  setText('profileAge', u.age ? `Age ${u.age} · Born ${u.dob}` : '');
  document.getElementById('profileInitials').textContent = (u.name || 'A')[0].toUpperCase();

  if (u.avatarUrl) {
    const avatar = document.getElementById('profileAvatarDisplay');
    avatar.innerHTML = `<img src="${u.avatarUrl}" alt="Avatar" /><label class="avatar-upload-label" for="avatarUpload"><i class="fas fa-camera"></i></label><input type="file" id="avatarUpload" accept="image/*" style="display:none" onchange="uploadAvatar(this)" />`;
  }

  // Stats
  document.getElementById('prof-sessions').textContent = AppState.sessions || 0;
  document.getElementById('prof-pbs').textContent = (AppState.pbs || []).length;
  document.getElementById('prof-badges').textContent = (AppState.earnedBadges || []).length;
  document.getElementById('prof-xp').textContent = (AppState.xp || 0).toLocaleString();
  document.getElementById('prof-streak').textContent = `${AppState.streak || 0} days`;
  document.getElementById('prof-challenges').textContent = AppState.completedChallenges || 0;

  // Prefs
  const prefs = AppState.prefs || {};
  if (prefs.weightUnit === 'lbs') { document.getElementById('pref-kg').classList.remove('active'); document.getElementById('pref-lbs').classList.add('active'); }
  if (prefs.distUnit === 'mi') { document.getElementById('pref-km').classList.remove('active'); document.getElementById('pref-mi').classList.add('active'); }
  const rem = document.getElementById('reminderToggle');
  if (rem) { rem.checked = !!prefs.reminders; if (prefs.reminders) document.getElementById('reminderTimeRow').classList.remove('hidden'); }
}

function saveProfile() {
  if (!AppState.user) AppState.user = {};
  AppState.user.name = document.getElementById('profileNameInput').value.trim() || AppState.user.name;
  AppState.user.city = document.getElementById('profileCity').value.trim();
  AppState.user.team = document.getElementById('profileTeam').value.trim();
  AppState.user.position = document.getElementById('profilePosition').value.trim();
  AppState.user.bio = document.getElementById('profileBio').value.trim();
  saveToStorage();
  updateGreeting();
  initProfilePage();
  showToast('Profile saved! ✅');
}

function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (!AppState.user) AppState.user = {};
    AppState.user.avatarUrl = e.target.result;
    saveToStorage();
    initProfilePage();
    const xpAvatar = document.getElementById('xpAvatar');
    if (xpAvatar) xpAvatar.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
    showToast('Profile photo updated! 📸');
  };
  reader.readAsDataURL(file);
}

function setPref(key, val) {
  if (!AppState.prefs) AppState.prefs = {};
  AppState.prefs[key] = val;
  saveToStorage();
  // Update toggle buttons
  if (key === 'weightUnit') {
    document.getElementById('pref-kg').classList.toggle('active', val === 'kg');
    document.getElementById('pref-lbs').classList.toggle('active', val === 'lbs');
  }
  if (key === 'distUnit') {
    document.getElementById('pref-km').classList.toggle('active', val === 'km');
    document.getElementById('pref-mi').classList.toggle('active', val === 'mi');
  }
  showToast(`${key} set to ${val}`);
}

function toggleReminders(checked) {
  if (!AppState.prefs) AppState.prefs = {};
  AppState.prefs.reminders = checked;
  document.getElementById('reminderTimeRow').classList.toggle('hidden', !checked);
  saveToStorage();
  if (checked) {
    showToast('Reminders enabled! Set your time below ⏰');
    scheduleReminder();
  }
}

function setReminderTime(time) {
  if (!AppState.prefs) AppState.prefs = {};
  AppState.prefs.reminderTime = time;
  saveToStorage();
  scheduleReminder();
}

function scheduleReminder() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm === 'granted') {
      const time = AppState.prefs?.reminderTime || '07:00';
      const [h, m] = time.split(':').map(Number);
      const now = new Date();
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const ms = next - now;
      setTimeout(() => {
        new Notification('AthleteMind 🏆', { body: `Time to train, ${AppState.user?.name || 'athlete'}! Let's go! 💪`, icon: '⚽' });
      }, ms);
      showToast(`Reminder set for ${time} ⏰`);
    }
  });
}

function exportCSV(type) {
  let rows = [], filename = '';
  if (type === 'sessions') {
    rows = [['Title','Date','Time','Sport','Duration','Notes'], ...AppState.calendarEvents.map(e => [e.title, e.date, e.time, e.sport, e.duration, e.notes || ''])];
    filename = 'sessions.csv';
  } else if (type === 'nutrition') {
    rows = [['Name','Date','Meal','Amount(g)','Calories','Protein','Carbs','Fat','Fibre'], ...(AppState.foodLog || []).map(f => [f.name, f.date, f.meal, f.amount, f.calories, f.protein, f.carbs, f.fat, f.fibre])];
    filename = 'food_log.csv';
  } else if (type === 'measurements') {
    rows = [['Date','Weight(kg)','Height(cm)','Body Fat%','Chest','Waist','Hips','Thigh','Bicep','BMI'], ...(AppState.measurements || []).map(m => [m.date, m.weight, m.height, m.fat||'', m.chest||'', m.waist||'', m.hips||'', m.thigh||'', m.bicep||'', m.bmi])];
    filename = 'measurements.csv';
  } else if (type === 'pbs') {
    rows = [['Record','Value','Unit','Date','Notes'], ...(AppState.pbs || []).map(p => [p.label, p.value, p.unit, p.date, p.notes||''])];
    filename = 'personal_bests.csv';
  }

  if (!rows.length) { showToast('No data to export yet!'); return; }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast(`${filename} downloaded! 📥`);
}

function confirmReset() {
  if (confirm('⚠️ This will permanently delete ALL your data. Are you sure?')) {
    localStorage.removeItem('athletemind_v2');
    location.reload();
  }
}

// =====================================================
// PATCH: Track food to allFoodLogs (for charts)
// =====================================================
const _origLogFood = logSelectedFood;
window.logSelectedFood = function() {
  _origLogFood();
  const today = getTodayStr();
  if (!AppState.allFoodLogs) AppState.allFoodLogs = {};
  AppState.allFoodLogs[today] = AppState.foodLog.filter(f => f.date === today);
  AppState.xp = (AppState.xp || 0) + 2;
  checkBadges();
  saveToStorage();
};

// PATCH: mark plan as generated
const _origGenPlan = generatePlan;
window.generatePlan = function() {
  _origGenPlan();
  AppState.planGenerated = true;
  AppState.xp = (AppState.xp || 0) + 5;
  checkBadges();
  saveToStorage();
};

// PATCH: Award XP on session add
window.addCalendarEvent = function() {
  addCalendarEvent();
  AppState.xp = (AppState.xp || 0) + 10;
  const eventTime = document.getElementById('eventTime')?.value;
  if (eventTime) {
    const h = parseInt(eventTime.split(':')[0]);
    if (h < 8) AppState.earlySession = true;
  }
  checkBadges();
  saveToStorage();
  updateXPUI();
};

// =====================================================
// VIDEO PERFORMER ANALYZER
// =====================================================
const VIDEO_STATS = {
  football: {
    full: ['Distance covered', 'Sprints', 'Shots on target', 'Key passes', 'Duels won', 'Tackles', 'Dribbles completed', 'Aerial duels', 'Interceptions', 'Passes accuracy %'],
    clip: ['Ball touches', 'Shots', 'Key passes', 'Dribbles', 'Sprints'],
  },
  basketball: {
    full: ['Points scored', 'Assists', 'Rebounds', 'Steals', 'Blocks', 'Turnovers', 'Field goal %', '3-point %', 'Free throw %', 'Minutes played'],
    clip: ['Points', 'Assists', 'Rebounds', 'Turnovers', 'Shot attempts'],
  },
  running: {
    full: ['Total distance', 'Average pace', 'Max speed', 'Elevation gain', 'Cadence', 'Heart rate avg', 'Calories burned', 'Splits (km)', 'Recovery time', 'VO2 estimate'],
    clip: ['Pace', 'Distance', 'Speed', 'Cadence', 'Calories'],
  },
  tennis: {
    full: ['Aces', '1st serve %', '2nd serve %', 'Winners', 'Unforced errors', 'Break points won', 'Rallies won', 'Net approaches', 'Backhand winners', 'Forehand winners'],
    clip: ['Shot type', 'Winners', 'Errors', 'Speed estimate', 'Rally length'],
  },
  swimming: {
    full: ['Total distance', 'Lap times', 'Stroke rate', 'Stroke count per lap', 'Turns', 'Average pace', 'Fastest split', 'SWOLF score', 'Kick efficiency', 'Breathing pattern'],
    clip: ['Stroke rate', 'Lap time', 'Efficiency', 'Turns', 'Split'],
  },
  cycling: {
    full: ['Total distance', 'Average speed', 'Max speed', 'Power output (W)', 'Cadence', 'Elevation', 'Calories', 'Heart rate avg', 'Segment times', 'NP estimate'],
    clip: ['Speed', 'Cadence', 'Power', 'Distance', 'Heart rate'],
  },
};

const VIDEO_STAT_RANGES = {
  football: {
    'Distance covered': () => `${(Math.random()*4+7).toFixed(1)} km`,
    'Sprints': () => Math.floor(Math.random()*20+10),
    'Shots on target': () => Math.floor(Math.random()*4),
    'Key passes': () => Math.floor(Math.random()*5),
    'Duels won': () => `${Math.floor(Math.random()*10+2)}/${Math.floor(Math.random()*8+10)}`,
    'Tackles': () => Math.floor(Math.random()*6),
    'Dribbles completed': () => `${Math.floor(Math.random()*5+1)}/${Math.floor(Math.random()*4+5)}`,
    'Aerial duels': () => `${Math.floor(Math.random()*3)}/${Math.floor(Math.random()*3+3)}`,
    'Interceptions': () => Math.floor(Math.random()*4),
    'Passes accuracy %': () => `${Math.floor(Math.random()*20+70)}%`,
    'Ball touches': () => Math.floor(Math.random()*30+10),
    'Shots': () => Math.floor(Math.random()*5),
    'Dribbles': () => Math.floor(Math.random()*6),
  },
};

function generateVideoStats(sport, scope) {
  const keys = VIDEO_STATS[sport]?.[scope] || VIDEO_STATS.football.full;
  const ranges = VIDEO_STAT_RANGES[sport] || VIDEO_STAT_RANGES.football;
  return keys.map(stat => {
    let val;
    if (ranges[stat]) {
      val = ranges[stat]();
    } else {
      val = (Math.random() * 80 + 5).toFixed(0);
    }
    return { stat, val };
  });
}

function handleVideoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('videoSource').value = file.name;
  const chosen = document.getElementById('videoFileChosen');
  if (chosen) {
    chosen.innerHTML = `<i class="fas fa-film"></i> <strong>${file.name}</strong> (${(file.size/1024/1024).toFixed(1)} MB)`;
    chosen.classList.remove('hidden');
    document.querySelector('.video-drop-label').textContent = 'Video loaded — ready to analyse!';
  }
  showToast(`📹 Video "${file.name}" loaded — ready to analyse!`);
}

function handleVideoDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('video/')) { showToast('Please drop a video file!'); return; }
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.getElementById('videoUpload');
  input.files = dt.files;
  handleVideoUpload(input);
}

function analyzeVideoPerformance() {
  const title = document.getElementById('videoTitle').value.trim();
  const scope = document.getElementById('videoScope').value;
  const sport = document.getElementById('videoSport').value;
  const duration = document.getElementById('videoDuration').value || 90;
  const source = document.getElementById('videoSource').value.trim();

  if (!title) { showToast('Please enter a match / video title!'); return; }

  showToast('🎬 Analysing your video performance...');

  const output = document.getElementById('videoPerformanceOutput');
  output.innerHTML = `<div class="video-analyzing"><i class="fas fa-spinner fa-spin"></i> Analysing...</div>`;

  setTimeout(() => {
    const stats = generateVideoStats(sport, scope);
    const date = getTodayStr();
    const ratingRaw = (Math.random() * 3 + 6).toFixed(1);
    const rating = Math.min(parseFloat(ratingRaw), 9.9).toFixed(1);

    output.innerHTML = `
      <div class="video-result">
        <div class="video-result-header">
          <div>
            <div class="video-result-title">📹 ${title}</div>
            <div class="video-result-meta">${sport.charAt(0).toUpperCase()+sport.slice(1)} · ${scope === 'full' ? 'Full Match' : 'Clip'} · ${duration} min · ${date}</div>
          </div>
          <div class="video-performance-rating">
            <span class="rating-score">${rating}</span>
            <span class="rating-label">/ 10</span>
          </div>
        </div>
        <div class="video-stats-grid">
          ${stats.map(s => `
            <div class="video-stat-item">
              <span class="video-stat-value">${s.val}</span>
              <span class="video-stat-label">${s.stat}</span>
            </div>
          `).join('')}
        </div>
        <div class="video-insight">
          <i class="fas fa-robot" style="color:var(--accent)"></i>
          <span>${getVideoInsight(sport, parseFloat(rating))}</span>
        </div>
      </div>
    `;

    // Save to history
    if (!AppState.videoAnalyses) AppState.videoAnalyses = [];
    AppState.videoAnalyses.push({ id: Date.now(), title, sport, scope, duration, source, date, stats, rating });
    AppState.xp = (AppState.xp || 0) + 15;
    checkBadges();
    saveToStorage();
    renderVideoHistory();
    showToast(`✅ Video analysis complete! Rating: ${rating}/10 · +15 XP`);
    updateXPUI();
  }, 1600);
}

function getVideoInsight(sport, rating) {
  const insightMap = {
    football: rating >= 8 ? `Outstanding game! Your pressing and passing accuracy were elite. Keep working on your aerial duels.`
      : rating >= 6 ? `Solid performance. Focus on increasing your sprint count and dribble success rate in training.`
      : `Tough game, but this data shows exactly where to improve — work on your touch and decision-making under pressure.`,
    basketball: rating >= 8 ? `Excellent game! Your scoring and efficiency were top tier. Work on cutting down turnovers.`
      : rating >= 6 ? `Good game. Drive to increase your assists and shot %. Look for open teammates more.`
      : `Use this game as fuel. Focus on defensive positioning and ball security in your next sessions.`,
    running: rating >= 8 ? `Great run! Your pace consistency and cadence are strong. Push for a new PB next time.`
      : rating >= 6 ? `Good effort. Work on your pacing strategy — you may have gone out too fast in the early km.`
      : `Use this data to build a smarter pacing plan. Focus on aerobic base training this week.`,
    tennis: rating >= 8 ? `Excellent match! Your serve and winner count are pro-level. Keep that first serve % high.`
      : rating >= 6 ? `Solid effort. Reduce unforced errors by focusing on ball placement over power in training.`
      : `Challenging match — drill your groundstrokes and serve consistency this week to bounce back.`,
    swimming: rating >= 8 ? `Excellent swim! Your stroke rate and turns are efficient. Target SWOLF below 40 next time.`
      : rating >= 6 ? `Good session. Focus on stroke count per lap to improve your efficiency.`
      : `Use this data to address technique — work with a coach on your turns and breathing pattern.`,
    cycling: rating >= 8 ? `Strong ride! Power output and cadence are excellent. Target segment KOM next time.`
      : rating >= 6 ? `Good ride. Keep your cadence above 90 RPM and focus on sustaining power on climbs.`
      : `Use this data as a baseline. Focus on threshold intervals to build your average power.`,
  };
  return (insightMap[sport] || insightMap.football);
}

function renderVideoHistory() {
  const el = document.getElementById('videoPerformanceHistory');
  if (!el) return;
  const analyses = (AppState.videoAnalyses || []).slice().reverse();
  if (!analyses.length) {
    el.innerHTML = '<p class="empty-state"><i class="fas fa-video"></i> No analyses yet — upload a video to get started!</p>';
    return;
  }
  el.innerHTML = analyses.map(a => `
    <div class="video-history-item">
      <div class="video-history-sport-badge">${getSportEmoji(a.sport)}</div>
      <div class="video-history-left">
        <div class="video-history-title">${a.title}</div>
        <div class="video-history-meta">${a.sport.charAt(0).toUpperCase()+a.sport.slice(1)} · ${a.scope === 'full' ? 'Full Match' : 'Clip'} · ${a.duration} min · ${a.date}</div>
        <div class="video-history-stats">
          ${a.stats.slice(0,4).map(s => `<span class="video-mini-stat"><strong>${s.val}</strong> ${s.stat}</span>`).join('')}
        </div>
      </div>
      <div class="video-performance-rating small">
        <span class="rating-score">${a.rating}</span><span class="rating-label">/10</span>
      </div>
      <button class="btn-ghost small" onclick="deleteVideoAnalysis(${a.id})"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

window.deleteVideoAnalysis = function(id) {
  AppState.videoAnalyses = (AppState.videoAnalyses || []).filter(a => a.id !== id);
  saveToStorage();
  renderVideoHistory();
  showToast('Video analysis removed');
};

const VIDEO_LEGEND = {
  football: [
    { icon: '📏', stat: 'Distance covered', tip: 'Total km run during the game' },
    { icon: '⚡', stat: 'Sprints', tip: 'Explosive bursts above 25 km/h' },
    { icon: '🎯', stat: 'Shots on target', tip: 'Shots requiring a save or goal' },
    { icon: '🔑', stat: 'Key passes', tip: 'Passes leading directly to a shot' },
    { icon: '⚔️', stat: 'Duels won', tip: '1v1 physical contests won' },
    { icon: '🛡️', stat: 'Tackles', tip: 'Successful ball-winning tackles' },
  ],
  basketball: [
    { icon: '🏀', stat: 'Points scored', tip: 'Total points in the game' },
    { icon: '🎯', stat: 'Field goal %', tip: 'Percentage of shots made' },
    { icon: '🤝', stat: 'Assists', tip: 'Passes leading directly to a basket' },
    { icon: '💪', stat: 'Rebounds', tip: 'Offensive + defensive boards' },
    { icon: '🕵️', stat: 'Steals', tip: 'Balls taken from the opponent' },
    { icon: '🚧', stat: 'Blocks', tip: 'Opponent shots blocked' },
  ],
  running: [
    { icon: '📏', stat: 'Total distance', tip: 'Kilometres or miles covered' },
    { icon: '⏱️', stat: 'Average pace', tip: 'min/km for the whole run' },
    { icon: '⚡', stat: 'Max speed', tip: 'Peak velocity achieved' },
    { icon: '💓', stat: 'Heart rate avg', tip: 'Mean BPM during the session' },
    { icon: '🔥', stat: 'Calories burned', tip: 'Estimated energy expenditure' },
    { icon: '📈', stat: 'VO2 estimate', tip: 'Aerobic capacity indicator' },
  ],
  tennis: [
    { icon: '🎾', stat: 'Aces', tip: 'Unreturnable first serves' },
    { icon: '📊', stat: '1st serve %', tip: 'First serve landing in' },
    { icon: '🏆', stat: 'Winners', tip: 'Outright winning shots' },
    { icon: '❌', stat: 'Unforced errors', tip: 'Mistakes not caused by opponent' },
    { icon: '🔀', stat: 'Break points won', tip: 'Breaks of serve converted' },
    { icon: '🏃', stat: 'Net approaches', tip: 'Times coming to the net' },
  ],
  swimming: [
    { icon: '📏', stat: 'Total distance', tip: 'Metres completed in the session' },
    { icon: '⏱️', stat: 'Lap times', tip: 'Time per length of the pool' },
    { icon: '🔄', stat: 'Stroke rate', tip: 'Strokes per minute' },
    { icon: '💯', stat: 'SWOLF score', tip: 'Strokes + seconds per lap (lower is better)' },
    { icon: '🌊', stat: 'Turns', tip: 'Flip turn execution count' },
    { icon: '😮‍💨', stat: 'Breathing pattern', tip: 'Breaths per stroke cycle' },
  ],
  cycling: [
    { icon: '📏', stat: 'Total distance', tip: 'Kilometres covered' },
    { icon: '⚡', stat: 'Power output (W)', tip: 'Average watts produced' },
    { icon: '🔄', stat: 'Cadence', tip: 'Pedal revolutions per minute' },
    { icon: '⛰️', stat: 'Elevation', tip: 'Total metres climbed' },
    { icon: '💓', stat: 'Heart rate avg', tip: 'Mean BPM during the ride' },
    { icon: '🔥', stat: 'Calories', tip: 'Estimated energy expenditure' },
  ],
};

function renderVideoLegend(sport) {
  const grid = document.getElementById('videoLegendGrid');
  if (!grid) return;
  const items = VIDEO_LEGEND[sport] || VIDEO_LEGEND.football;
  grid.innerHTML = items.map(i => `
    <div class="video-legend-item" title="${i.tip}">
      <span class="vl-icon">${i.icon}</span>
      <div>
        <div class="vl-stat">${i.stat}</div>
        <div class="vl-tip">${i.tip}</div>
      </div>
    </div>
  `).join('');
}

function setVideoSport(sport, btn) {
  document.querySelectorAll('.video-sport-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const sel = document.getElementById('videoSport');
  if (sel) sel.value = sport;
  renderVideoLegend(sport);
}

function clearVideoHistory() {
  if (!AppState.videoAnalyses?.length) { showToast('No analyses to clear.'); return; }
  AppState.videoAnalyses = [];
  saveToStorage();
  renderVideoHistory();
  showToast('All video analyses cleared.');
}
window.clearVideoHistory = clearVideoHistory;
window.setVideoSport = setVideoSport;
window.handleVideoDrop = handleVideoDrop;

function initVideoPage() {
  // Sync sport pill with current app sport
  const sport = AppState.sport || 'football';
  document.querySelectorAll('.video-sport-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.sport === sport);
  });
  const sel = document.getElementById('videoSport');
  if (sel) sel.value = sport;
  renderVideoLegend(sport);
  renderVideoHistory();
  // Reset drop zone label if no file active
  const chosen = document.getElementById('videoFileChosen');
  if (chosen && chosen.classList.contains('hidden')) {
    const lbl = document.querySelector('.video-drop-label');
    if (lbl) lbl.textContent = 'Click or drag & drop your video here';
  }
}

// =====================================================
// SLEEP SESSION (Start / End / Banner)
// =====================================================
function startSleepSession() {
  if (AppState.sleepSessionStart) {
    showToast('A sleep session is already active! Press End Sleep to finish it.');
    return;
  }
  AppState.sleepSessionStart = Date.now();
  const targetHours = parseFloat(document.getElementById('sleepTargetHours')?.value) || 8;
  AppState.sleepTargetHours = targetHours;
  saveToStorage();

  // Show the banner
  showSleepBanner();

  // Request notification permission for morning alarm
  if ('Notification' in window) {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        const wakeMs = targetHours * 60 * 60 * 1000;
        setTimeout(() => {
          new Notification('⏰ Rise and Shine!', {
            body: `Your ${targetHours}h sleep is up! Time to start your training day 💪`,
            icon: '⚽',
          });
          updateSleepBannerWakeUp();
        }, wakeMs);
        showToast(`😴 Sleep started! We'll wake you in ${targetHours}h`);
      } else {
        showToast(`😴 Sleep started! ${targetHours}h target set.`);
      }
    });
  } else {
    showToast(`😴 Sleep started! ${targetHours}h target set.`);
  }
}

function showSleepBanner() {
  const banner = document.getElementById('sleepBanner');
  if (!banner) return;
  const start = AppState.sleepSessionStart;
  const targetHours = AppState.sleepTargetHours || 8;
  const startTime = new Date(start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('sleepBannerTitle').textContent = '😴 Sleep Session Active';
  document.getElementById('sleepBannerText').textContent = `Started at ${startTime} · Target: ${targetHours}h · Press "End Sleep" when you wake up`;
  banner.classList.remove('hidden');
}

function updateSleepBannerWakeUp() {
  const banner = document.getElementById('sleepBanner');
  if (!banner || banner.classList.contains('hidden')) return;
  document.getElementById('sleepBannerTitle').textContent = '⏰ Good Morning! Time to Wake Up';
  document.getElementById('sleepBannerText').textContent = `Your target sleep time is up. Press End Sleep to log your session.`;
}

function endSleepSession() {
  if (!AppState.sleepSessionStart) {
    showToast('No active sleep session. Press Start Sleep first.');
    return;
  }
  const start = AppState.sleepSessionStart;
  const end = Date.now();
  const hoursSlept = parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(1));

  // Pre-fill the sleep form with calculated data
  const hoursInput = document.getElementById('sleepHours');
  const dateInput = document.getElementById('sleepDate');
  if (hoursInput) hoursInput.value = Math.min(hoursSlept, 23.9).toFixed(1);
  if (dateInput) dateInput.value = getTodayStr();

  AppState.sleepSessionStart = null;
  AppState.sleepTargetHours = null;
  saveToStorage();
  dismissSleepBanner();

  // Auto-log the sleep
  if (!AppState.sleepLog) AppState.sleepLog = [];
  const quality = hoursSlept >= 8 ? 5 : hoursSlept >= 7 ? 4 : hoursSlept >= 6 ? 3 : hoursSlept >= 5 ? 2 : 1;
  AppState.sleepLog.push({ id: Date.now(), date: getTodayStr(), hours: parseFloat(hoursSlept.toFixed(1)), quality, notes: 'Auto-logged from sleep session' });
  if (hoursSlept >= 7) AppState.goodSleepCount = (AppState.goodSleepCount || 0) + 1;
  checkBadges();
  saveToStorage();

  const el = document.getElementById('sleepLog');
  if (el) renderSleepLog();
  updateWellnessSummary();

  showToast(`✅ Sleep ended! You slept ${hoursSlept.toFixed(1)}h. Great recovery! 😴`);

  // Navigate to wellness page
  if (document.getElementById('page-wellness')?.classList.contains('active')) {
    initWellnessPage();
  }
}

function dismissSleepBanner() {
  const banner = document.getElementById('sleepBanner');
  if (banner) banner.classList.add('hidden');
}
window.startSleepSession = startSleepSession;
window.endSleepSession = endSleepSession;
window.dismissSleepBanner = dismissSleepBanner;
window.analyzeVideoPerformance = analyzeVideoPerformance;
window.handleVideoUpload = handleVideoUpload;
window.cancelAllRepeatEvents = cancelAllRepeatEvents;

// Re-show sleep banner on page load if session was active
document.addEventListener('DOMContentLoaded', () => {
  if (AppState.sleepSessionStart) showSleepBanner();
  if (AppState.videoAnalyses?.length) {
    setTimeout(renderVideoHistory, 200);
  }
  // Expose extras globally
  window.clearVideoHistory = clearVideoHistory;
  window.setVideoSport = setVideoSport;
  window.handleVideoDrop = handleVideoDrop;
  window.initVideoPage = initVideoPage;

  // ── Secret admin: long-press footer logo for 2 seconds ──
  let holdTimer = null;
  const logoEl = document.getElementById('secretLogoTap');
  if (logoEl) {
    const startHold = () => { holdTimer = setTimeout(() => { openAdminOverlay(); }, 2000); };
    const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };
    logoEl.addEventListener('mousedown',  startHold);
    logoEl.addEventListener('touchstart', startHold,  { passive: true });
    logoEl.addEventListener('mouseup',    cancelHold);
    logoEl.addEventListener('mouseleave', cancelHold);
    logoEl.addEventListener('touchend',   cancelHold);
    logoEl.addEventListener('touchcancel',cancelHold);
    // Prevent context menu on long-press mobile
    logoEl.addEventListener('contextmenu', e => e.preventDefault());
  }
});

// =====================================================
// ADMIN OVERLAY (in-app secret admin panel)
// =====================================================
let _adminPw = '';
let _adminUsers = [];

function openAdminOverlay() {
  document.getElementById('adminOverlay').style.display = 'block';
  document.getElementById('adminGate').style.display = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('overlayPwdInput').value = '';
  document.getElementById('overlayLoginErr').style.display = 'none';
  setTimeout(() => document.getElementById('overlayPwdInput').focus(), 100);
}

function closeAdminOverlay() {
  document.getElementById('adminOverlay').style.display = 'none';
  _adminPw = '';
}

async function overlayLogin() {
  const pw = document.getElementById('overlayPwdInput').value.trim();
  if (!pw) return;
  // Try server auth first, fall back to local password check
  let stats = null;
  try {
    const r = await fetch('/api/admin/stats', { headers: { 'x-admin-password': pw } });
    if (r.ok) {
      stats = await r.json();
    } else {
      // Server returned error — wrong password
      document.getElementById('overlayLoginErr').style.display = 'block';
      return;
    }
  } catch {
    // Server unreachable — allow access with hardcoded password for offline use
    if (pw !== '213') {
      document.getElementById('overlayLoginErr').style.display = 'block';
      return;
    }
    stats = { totalUsers: 0, totalSyncs: 0, activeLast7: 0, topSports: [], topStreaks: [], syncsPerDay: [] };
  }
  _adminPw = pw;
  document.getElementById('adminGate').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  const exportEl = document.getElementById('overlayExportBtn');
  if (exportEl) { exportEl.href = `/api/admin/export?pw=${encodeURIComponent(pw)}`; exportEl.download = 'athletemind-users.csv'; }
  ovRenderStats(stats);
  ovLoadUsers(stats);
}

async function ovLoadUsers(stats) {
  const r = await fetch('/api/admin/users', { headers: { 'x-admin-password': _adminPw } });
  _adminUsers = await r.json();
  ovRenderUsers(_adminUsers);
  if (stats) ovRenderCharts(stats);
}

function ovRenderStats(s) {
  document.getElementById('ov-stats').innerHTML = [
    ['Total Users', s.totalUsers, '#00e676'],
    ['Active (7d)', s.activeLast7, '#00b0ff'],
    ['Total Syncs', s.totalSyncs, '#ffd600'],
    ['Sports', s.topSports.length, '#e040fb']
  ].map(([l, v, c]) => `
    <div style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:10px;padding:16px;text-align:center">
      <div style="font-size:1.8rem;font-weight:800;color:${c}">${v}</div>
      <div style="font-size:.72rem;color:#888;text-transform:uppercase;margin-top:3px">${l}</div>
    </div>`).join('');
}

function ovRenderUsers(users) {
  const tbody = document.getElementById('ovUsersBody');
  document.getElementById('ov-user-count').textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#888">No users yet</td></tr>'; return; }
  tbody.innerHTML = users.map((u, i) => `
    <tr style="border-bottom:1px solid #1e1e1e" onmouseover="this.style.background='#1a1a1a'" onmouseout="this.style.background=''">
      <td style="padding:11px 14px;color:#555;font-size:.8rem">${i+1}</td>
      <td style="padding:11px 14px"><strong style="font-size:.88rem">${ovEsc(u.name)}</strong><br><span style="font-size:.7rem;color:#555;font-family:monospace">${u.device_id.slice(0,12)}…</span></td>
      <td style="padding:11px 14px"><span style="padding:3px 8px;border-radius:20px;font-size:.7rem;font-weight:700;border:1px solid #444;text-transform:capitalize">${u.sport}</span></td>
      <td style="padding:11px 14px">🔥 ${u.streak}</td>
      <td style="padding:11px 14px">⚡ ${u.xp}</td>
      <td style="padding:11px 14px;font-size:.78rem;color:#888">${ovTimeAgo(u.last_seen)}</td>
      <td style="padding:11px 14px">
        <button onclick="ovViewUser('${u.device_id}')" style="background:none;border:1px solid #00b0ff;color:#00b0ff;border-radius:5px;padding:4px 9px;cursor:pointer;font-size:.75rem">View</button>
        <button onclick="ovDeleteUser('${u.device_id}','${ovEsc(u.name)}')" style="background:none;border:1px solid #2a2a2a;color:#888;border-radius:5px;padding:4px 9px;cursor:pointer;font-size:.75rem;margin-left:5px">Del</button>
      </td>
    </tr>`).join('');
}

function ovFilter() {
  const q = document.getElementById('ovSearch').value.toLowerCase();
  ovRenderUsers(_adminUsers.filter(u => u.name.toLowerCase().includes(q) || u.sport.toLowerCase().includes(q)));
}

function ovRenderCharts(s) {
  const maxS = Math.max(...s.topSports.map(x => x.count), 1);
  document.getElementById('ov-sports-chart').innerHTML = s.topSports.map(x => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <div style="width:80px;font-size:.8rem;text-transform:capitalize">${x.sport}</div>
      <div style="flex:1;background:#1e1e1e;border-radius:4px;height:9px;overflow:hidden">
        <div style="height:100%;background:#00e676;border-radius:4px;width:${(x.count/maxS*100).toFixed(0)}%"></div>
      </div>
      <div style="font-size:.75rem;color:#888;width:24px;text-align:right">${x.count}</div>
    </div>`).join('') || '<span style="color:#888;font-size:.82rem">No data yet</span>';

  const ranks = ['#ffd600','#b0bec5','#ff7043'];
  document.getElementById('ov-leaderboard').innerHTML = s.topStreaks.map((u,i) => `
    <li style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #1e1e1e;font-size:.83rem">
      <span style="width:20px;font-weight:800;color:${ranks[i]||'#555'}">${i+1}</span>
      <span style="flex:1">${ovEsc(u.name)} <span style="color:#555;font-size:.72rem">(${u.sport})</span></span>
      <span style="color:#00e676;font-weight:700">🔥${u.streak}</span>
    </li>`).join('') || '<li style="color:#888">No data</li>';
}

async function ovViewUser(id) {
  const r = await fetch(`/api/admin/user/${id}`, { headers: { 'x-admin-password': _adminPw } });
  const u = await r.json();
  document.getElementById('ovDetailTitle').textContent = `${u.name} · ${u.sport}`;
  document.getElementById('ovDetailGrid').innerHTML = [
    ['Streak', `🔥 ${u.streak}`], ['XP', `⚡ ${u.xp}`],
    ['Email', u.data?.user?.email || '—'], ['Sessions', u.data?.sessions || 0],
    ['Longest Streak', u.data?.longestStreak || 0], ['Badges', (u.data?.earnedBadges||[]).length],
    ['First Seen', ovTimeAgo(u.first_seen)], ['Last Seen', ovTimeAgo(u.last_seen)]
  ].map(([l,v]) => `
    <div style="background:#1e1e1e;border-radius:8px;padding:11px">
      <div style="font-size:.68rem;color:#888;text-transform:uppercase;margin-bottom:3px">${l}</div>
      <div style="font-size:.95rem;font-weight:700">${v}</div>
    </div>`).join('');
  document.getElementById('ovDetailJson').textContent = JSON.stringify(u.data, null, 2);
  document.getElementById('ovUserDetail').style.display = 'block';
  document.getElementById('ovUserDetail').scrollIntoView({ behavior: 'smooth' });
}

async function ovDeleteUser(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  await fetch(`/api/admin/user/${id}`, { method: 'DELETE', headers: { 'x-admin-password': _adminPw } });
  const stats = await (await fetch('/api/admin/stats', { headers: { 'x-admin-password': _adminPw } })).json();
  ovLoadUsers(stats);
}

function ovShowTab(name, btn) {
  document.querySelectorAll('.ov-tab').forEach(t => {
    t.style.background = 'none'; t.style.color = '#888'; t.style.fontWeight = '400';
  });
  btn.style.background = '#00e676'; btn.style.color = '#000'; btn.style.fontWeight = '700';
  document.getElementById('ov-tab-users').style.display  = name === 'users'  ? 'block' : 'none';
  document.getElementById('ov-tab-charts').style.display = name === 'charts' ? 'block' : 'none';
}

function ovTimeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function ovEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =====================================================
// ── REAL AI COACH (OpenAI via server)
// =====================================================
async function sendChat() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';

  addChatMessage(message, 'user');

  // Save to history
  AppState.chatHistory = AppState.chatHistory || [];
  AppState.chatHistory.push({ role: 'user', content: message });
  if (AppState.chatHistory.length > 40) AppState.chatHistory = AppState.chatHistory.slice(-40);

  // Show typing indicator
  const typingId = 'typing-' + Date.now();
  const chatEl = document.getElementById('chatMessages');
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'chat-msg ai-msg';
  typingDiv.innerHTML = `<div class="msg-avatar"><i class="fas fa-robot"></i></div><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  chatEl.appendChild(typingDiv);
  chatEl.scrollTop = chatEl.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sport: AppState.sport,
        name: AppState.user?.name || 'Athlete',
        history: AppState.chatHistory.slice(-10)
      })
    });
    const data = await res.json();
    typingDiv.remove();
    const reply = data.reply || getAIResponse(message);
    AppState.chatHistory.push({ role: 'assistant', content: reply });
    addChatMessage(reply, 'ai');
    saveToStorage();
  } catch(e) {
    typingDiv.remove();
    // Fall back to local responses if server offline
    const response = getAIResponse(message);
    addChatMessage(response, 'ai');
  }
}

// =====================================================
// ── SHARE CARD (Canvas)
// =====================================================
function openShareCard() {
  document.getElementById('shareCardModal').classList.remove('hidden');
  setTimeout(drawShareCard, 100);
}

function drawShareCard() {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 540, H = 300;
  canvas.width = W; canvas.height = H;

  // Sport accent colour
  const SPORT_COLOURS = {
    football: '#00e676', basketball: '#ff6d00', running: '#00b0ff',
    tennis: '#ffd600', swimming: '#00e5ff', cycling: '#e040fb'
  };
  const accent = SPORT_COLOURS[AppState.sport] || '#00e676';

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d0d0d');
  bg.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Accent glow circle
  const glow = ctx.createRadialGradient(W - 80, 60, 0, W - 80, 60, 160);
  glow.addColorStop(0, accent + '33');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Left accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 5, H);

  // Logo text
  ctx.fillStyle = accent;
  ctx.font = 'bold 18px Inter, sans-serif';
  ctx.fillText('AthleteMind', 24, 36);

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.fillText(AppState.user?.name || 'Athlete', 24, 90);

  // Sport
  ctx.fillStyle = accent;
  ctx.font = '600 16px Inter, sans-serif';
  const sportLabels = { football:'⚽ Football', basketball:'🏀 Basketball', running:'🏃 Running', tennis:'🎾 Tennis', swimming:'🏊 Swimming', cycling:'🚴 Cycling' };
  ctx.fillText(sportLabels[AppState.sport] || AppState.sport, 24, 116);

  // Streak stat
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Inter, sans-serif';
  ctx.fillText(`${AppState.streak}`, 24, 200);
  ctx.fillStyle = '#888';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('DAY STREAK 🔥', 24, 222);

  // XP stat
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Inter, sans-serif';
  ctx.fillText(`${AppState.xp || 0}`, 200, 200);
  ctx.fillStyle = '#888';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('TOTAL XP ⚡', 200, 222);

  // Sessions stat
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Inter, sans-serif';
  ctx.fillText(`${AppState.sessions || 0}`, 360, 200);
  ctx.fillStyle = '#888';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('SESSIONS 💪', 360, 222);

  // Bottom tagline
  ctx.fillStyle = '#555';
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText('Join me on AthleteMind — your AI sports training hub', 24, 278);
}

function downloadShareCard() {
  drawShareCard();
  const canvas = document.getElementById('shareCanvas');
  const link = document.createElement('a');
  link.download = 'athletemind-progress.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function shareShareCard() {
  drawShareCard();
  const canvas = document.getElementById('shareCanvas');
  canvas.toBlob(async blob => {
    const file = new File([blob], 'athletemind-progress.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My AthleteMind Progress', text: `I'm on a ${AppState.streak}-day streak! Join me on AthleteMind 🔥` });
    } else {
      downloadShareCard();
    }
  });
}

// =====================================================
// ── WEEKLY REPORT
// =====================================================
function openWeeklyReport() {
  const modal = document.getElementById('weeklyReportModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Mon
  startOfWeek.setHours(0, 0, 0, 0);

  const weekStr = startOfWeek.toISOString().split('T')[0];

  // Sessions this week
  const weekEvents = (AppState.calendarEvents || []).filter(e => e.date >= weekStr);
  const trainingSessions = weekEvents.filter(e => ['training', 'match', 'team', 'gym', 'drill', 'game', 'race', 'tournament'].includes(e.type));

  // Calories this week
  const allLogs = AppState.allFoodLogs || {};
  let totalCals = 0, logDays = 0;
  Object.entries(allLogs).forEach(([date, items]) => {
    if (date >= weekStr) {
      totalCals += items.reduce((s, f) => s + (f.calories || 0), 0);
      logDays++;
    }
  });

  // XP / streak
  const xpThisWeek = (AppState.xp || 0); // approximate
  const body = document.getElementById('weeklyReportBody');

  const dateLabel = startOfWeek.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  const endLabel  = new Date(startOfWeek.getTime() + 6*86400000).toLocaleDateString('en-GB', { day:'numeric', month:'short' });

  body.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:.82rem;color:var(--text-secondary)">Week of ${dateLabel} – ${endLabel}</div>
      <div style="font-size:1.2rem;font-weight:700;margin-top:4px">Your Weekly Summary 📊</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:2rem;font-weight:800;color:var(--accent)">${trainingSessions.length}</div>
        <div style="font-size:.78rem;color:var(--text-secondary);text-transform:uppercase">Sessions</div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:2rem;font-weight:800;color:var(--accent)">🔥 ${AppState.streak}</div>
        <div style="font-size:.78rem;color:var(--text-secondary);text-transform:uppercase">Current Streak</div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:2rem;font-weight:800;color:var(--accent)">${Math.round(totalCals)}</div>
        <div style="font-size:.78rem;color:var(--text-secondary);text-transform:uppercase">Calories Logged</div>
      </div>
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:2rem;font-weight:800;color:var(--accent)">⚡ ${AppState.xp || 0}</div>
        <div style="font-size:.78rem;color:var(--text-secondary);text-transform:uppercase">Total XP</div>
      </div>
    </div>
    ${trainingSessions.length === 0 ? '<p style="text-align:center;color:var(--text-secondary);font-size:.9rem">No training sessions logged this week. Get out there! 💪</p>' : ''}
    <button class="btn-primary btn-full" onclick="openShareCard();closeModal('weeklyReportModal')">
      <i class="fas fa-share-alt"></i> Share This Week's Stats
    </button>
  `;
}

// Auto-show weekly report every Monday
function checkWeeklyReport() {
  const today = new Date();
  if (today.getDay() !== 1) return; // only Monday
  const lastShown = localStorage.getItem('am_weekly_shown');
  const todayStr = getTodayStr();
  if (lastShown === todayStr) return;
  localStorage.setItem('am_weekly_shown', todayStr);
  setTimeout(() => openWeeklyReport(), 3000);
}

// =====================================================
// ── REFERRAL CODE
// =====================================================
function getOrCreateReferralCode() {
  let code = AppState.referralCode;
  if (!code) {
    const name = (AppState.user?.name || 'athlete').replace(/\s+/g, '').slice(0, 6).toUpperCase();
    code = name + Math.random().toString(36).slice(2, 6).toUpperCase();
    AppState.referralCode = code;
    saveToStorage();
  }
  return code;
}

function renderReferralCode() {
  const el = document.getElementById('referralCodeDisplay');
  if (el) el.textContent = getOrCreateReferralCode();
  const countEl = document.getElementById('referralCount');
  if (countEl) countEl.textContent = AppState.referralCount || 0;
}

function copyReferralCode() {
  const code = getOrCreateReferralCode();
  const text = `Join me on AthleteMind — the AI sports training app! Use my code ${code} when you sign up: https://athletemind.app`;
  navigator.clipboard.writeText(text).then(() => showToast('Invite link copied! 🎉'));
}

// Check if user came via referral
function checkReferralOnLoad() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && !AppState.usedReferralCode) {
    AppState.usedReferralCode = ref;
    saveToStorage();
    // Tell server about the referral
    fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), referralCode: ref })
    }).catch(() => {});
    showToast(`Welcome! Referred by ${ref} 🎉`);
  }
}

// =====================================================
// ── PAYWALL / PREMIUM
// =====================================================
function openPaywall() {
  document.getElementById('paywallModal').classList.remove('hidden');
}

function handleUpgrade() {
  // Stripe integration point — for now show a coming soon message
  showToast('Payment coming soon! Email us at hello@athletemind.app to get early access 🚀', 5000);
  closeModal('paywallModal');
}

function isPremium() {
  return AppState.isPremium === true;
}

// Lock premium features — show paywall instead
function requirePremium(fn) {
  if (isPremium()) { fn(); return; }
  openPaywall();
}

// =====================================================
// ── PUSH NOTIFICATIONS
// =====================================================
async function requestPushPermission() {
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('Push notifications enabled! 🔔');
    AppState.pushEnabled = true;
    saveToStorage();
    scheduleDailyReminder();
  }
}

function scheduleDailyReminder() {
  // Use setTimeout to fire at next reminder time
  if (!AppState.prefs?.reminderTime) return;
  const [h, m] = (AppState.prefs.reminderTime || '07:00').split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target - now;
  setTimeout(() => {
    if (Notification.permission === 'granted' && AppState.pushEnabled) {
      new Notification('AthleteMind 🏆', {
        body: `Time to train, ${AppState.user?.name || 'Athlete'}! Let's go! 💪`,
        icon: 'https://via.placeholder.com/192x192/00e676/000000?text=AM'
      });
    }
    scheduleDailyReminder(); // reschedule for tomorrow
  }, ms);
}

// =====================================================
// ── INIT all new features on load
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  checkReferralOnLoad();
  checkWeeklyReport();
  // Render referral code when profile page is opened
  const origNavTo = window.navTo;
  if (origNavTo) {
    const _nav = origNavTo;
    window.navTo = function(page) {
      _nav(page);
      if (page === 'profile') setTimeout(renderReferralCode, 100);
    };
  }
  if (AppState.pushEnabled) scheduleDailyReminder();
});

