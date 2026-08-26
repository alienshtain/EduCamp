// ثوابت الألوان المتاحة للمواد
const PRESET_COLORS = [
    '#3b82f6', // أزرق
    '#8b5cf6', // بنفسجي
    '#ec4899', // وردي
    '#f59e0b', // برتقالي
    '#10b981', // أخضر
    '#14b8a6', // تركوازي
    '#6366f1', // نيلي
    '#ef4444'  // أحمر
];

const AMBIENT_FILES = [
    { name: 'المنشاوي سورة النجم', filename: 'المنشاوي_سورة_النجم.mp3' },
    { name: 'محمد ايوب سورة طه', filename: 'سورة_طه_محمد_ايوب.mp3' },
    { name: 'احمد كاسب سورة غافر', filename: 'سورة_غافر_احمد_كاسب.mp3' },
    { name: 'تلاوات من قناة "لتطمئن"', filename: 'تلاوات_من_قناة_لتطمئن.mp3' },
];

// الحالة العامة للتطبيق
let appState = {
    language: 'ar', // اللغة الافتراضية
    subjects: [
        { id: 'physics', name: 'الفيزياء', color: '#8b5cf6' },
        { id: 'chemistry', name: 'الكيمياء', color: '#14b8a6' }
    ],
    tasks: [
        {
            id: 't-1',
            subjectId: 'physics',
            title: 'مراجعة الفصل الأول: الحركة الدائرية',
            desc: 'حل الأسئلة والمسائل المقررة من الصفحة 12 إلى 24 مع كتابة القوانين الرئيسية.',
            date: new Date().toISOString().split('T')[0],
            completed: false,
            ytLinks: [{ title: 'شرح الحركة الدائرية', url: 'https://www.youtube.com' }],
            note: 'القوانين الهامة: التسارع المركزي a_c = v^2 / r'
        },
        {
            id: 't-2',
            subjectId: 'chemistry',
            title: 'دراسة الاتزان الكيميائي',
            desc: 'مراجعة مفهوم قاعدة لوشاتيليه ومسائل ثابت الاتزان Kc.',
            date: new Date().toISOString().split('T')[0],
            completed: true,
            ytLinks: [],
            note: ''
        }
    ],
    activeTab: 'all', // 'all' أو subjectId
    editingSubjectId: null,
    editingTaskId: null,
    editingNoteTaskId: null,
    selectedColor: PRESET_COLORS[0],
    timer: {
        mode: 'work', // 'work' | 'break'
        workMinutes: 25,
        breakMinutes: 5,
        secondsLeft: 25 * 60,
        isRunning: false,
        intervalId: null,
        ambientSoundType: 'none',
        ambientCustomUrl: '',
        ambientVolume: 50
    }
};

// عناصر التشغيل الصوتي
var currentAmbientAudio = null;
var currentAmbientSrc = ''; 
var completionAudio = null;
var confirmCallback = null;

// ==========================================
// وظائف إدارة اللغة
// ==========================================
function toggleLanguage() {
    appState.language = appState.language === 'ar' ? 'en' : 'ar';
    saveState();
    applyLanguage();
}

function applyLanguage() {
    const lang = appState.language;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // تحديث نصوص العناصر الثابتة في HTML
    const textElements = document.querySelectorAll('.lang-text');
    textElements.forEach(el => {
        if (el.hasAttribute(`data-${lang}`)) {
            el.innerHTML = el.getAttribute(`data-${lang}`);
        }
    });

    // تحديث نصوص صناديق الإدخال (Placeholders)
    const placeholders = document.querySelectorAll('.lang-placeholder');
    placeholders.forEach(el => {
        if (el.hasAttribute(`data-placeholder-${lang}`)) {
            el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
        }
    });

    // تحديث زر اللغة
    const langBtnText = document.getElementById('lang-btn-text');
    if(langBtnText) {
        langBtnText.innerText = lang === 'ar' ? 'English' : 'العربية';
    }

    // تحديث عنوان الصفحة
    const titleAr = "مخيم الدراسة | منصة تنظيم وإدارة الدراسة والمهام";
    const titleEn = "Study Camp | Study & Task Management Platform";
    const pageTitle = document.getElementById('page-title');
    if(pageTitle) pageTitle.innerText = lang === 'ar' ? titleAr : titleEn;

    // تحديث نصوص المؤقت
    const mode = appState.timer.mode;
    document.getElementById('timer-mode-label').innerText = mode === 'work' ? 
        (lang === 'ar' ? 'جلسة دراسة' : 'Study Session') : 
        (lang === 'ar' ? 'استراحة' : 'Break');

    const status = document.getElementById('timer-status-indicator');
    if(appState.timer.isRunning) {
        status.innerText = lang === 'ar' ? 'يعمل الآن' : 'Running';
    } else {
        status.innerText = lang === 'ar' ? 'متوقف مؤقتاً' : 'Paused';
    }

    // إعادة تصيير (Render) العناصر المتغيرة بالـ JS
    populateAudioSelects();
    renderSubjectsNav();
    renderTasks();
}

// ==========================================
// التخزين المحلي (Local Storage)
// ==========================================
function loadState() {
    try {
        const saved = localStorage.getItem('educamp_state_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            
            // تحميل اللغة
            if (parsed.language) appState.language = parsed.language;

            appState.subjects = parsed.subjects || appState.subjects;
            appState.tasks = parsed.tasks || appState.tasks;

            appState.tasks.forEach(t => {
                if (!t.ytLinks) {
                    t.ytLinks = [];
                    if (t.ytUrls && t.ytUrls.length > 0) {
                        t.ytLinks = t.ytUrls.map((url, idx) => ({ title: (appState.language === 'ar' ? 'رابط الشرح ' : 'Link ') + (idx + 1), url: url }));
                    } else if (t.ytUrl) {
                        t.ytLinks = [{ title: appState.language === 'ar' ? 'رابط الشرح' : 'Tutorial Link', url: t.ytUrl }];
                    }
                }
            });

            if (parsed.timerSettings) {
                appState.timer.workMinutes = parsed.timerSettings.workMinutes || 25;
                appState.timer.breakMinutes = parsed.timerSettings.breakMinutes || 5;
                appState.timer.ambientSoundType = parsed.timerSettings.ambientSoundType || 'none';
                appState.timer.ambientCustomUrl = parsed.timerSettings.ambientCustomUrl || '';
                appState.timer.ambientVolume = parsed.timerSettings.ambientVolume !== undefined ? parsed.timerSettings.ambientVolume : 50;
            }
        }
    } catch (e) {
        console.error("خطأ في التحميل من LocalStorage", e);
    }
}

function saveState() {
    try {
        const dataToSave = {
            language: appState.language,
            subjects: appState.subjects,
            tasks: appState.tasks,
            timerSettings: {
                workMinutes: appState.timer.workMinutes,
                breakMinutes: appState.timer.breakMinutes,
                ambientSoundType: appState.timer.ambientSoundType,
                ambientCustomUrl: appState.timer.ambientCustomUrl,
                ambientVolume: appState.timer.ambientVolume
            }
        };
        localStorage.setItem('educamp_state_v2', JSON.stringify(dataToSave));
    } catch (e) {
        console.error("خطأ في حفظ البيانات", e);
    }
}

// ==========================================
// إعدادات الصوت
// ==========================================
function populateAudioSelects() {
    const ambientSelect = document.getElementById('ambient-sound-select');
    const isAr = appState.language === 'ar';

    if (ambientSelect) {
        ambientSelect.innerHTML = `<option value="none">${isAr ? 'بدون صوت' : 'No Sound'}</option>`;
        AMBIENT_FILES.forEach(item => {
            ambientSelect.innerHTML += `<option value="./sounds/ambient/${item.filename}">${item.name}</option>`;
        });
        ambientSelect.innerHTML += `<option value="custom">${isAr ? 'ملف خاص / رابط خارجي...' : 'Custom File / External Link...'}</option>`;
        ambientSelect.value = appState.timer.ambientSoundType || 'none';
    }

    const ambientCustomContainer = document.getElementById('ambient-custom-container');
    if (ambientCustomContainer) {
        ambientCustomContainer.style.display = appState.timer.ambientSoundType === 'custom' ? 'block' : 'none';
    }

    const ambientUrlInput = document.getElementById('ambient-url-input');
    if (ambientUrlInput) ambientUrlInput.value = appState.timer.ambientCustomUrl || '';

    const volumeSlider = document.getElementById('ambient-volume-slider');
    if (volumeSlider) volumeSlider.value = appState.timer.ambientVolume;
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showMusicWarningModal() {
    openModal('music-warning-modal');
}

function onCustomUrlInput() {
    showMusicWarningModal();
    updateAudioSettings();
}

function updateAudioSettings() {
    const newAmbient = document.getElementById('ambient-sound-select').value;

    if (newAmbient === 'custom' && appState.timer.ambientSoundType !== 'custom') {
        showMusicWarningModal();
    }

    appState.timer.ambientSoundType = newAmbient;
    appState.timer.ambientCustomUrl = document.getElementById('ambient-url-input').value.trim();

    document.getElementById('ambient-custom-container').style.display = appState.timer.ambientSoundType === 'custom' ? 'block' : 'none';

    saveState();

    if (appState.timer.isRunning) {
        startAmbientSound();
    }
}

function handleAmbientFileUpload(event) {
    showMusicWarningModal();
    const file = event.target.files[0];
    if (file) {
        appState.timer.ambientCustomUrl = URL.createObjectURL(file);
        saveState();
        if (appState.timer.isRunning) {
            startAmbientSound();
        }
    }
}

function updateAmbientVolume(val) {
    appState.timer.ambientVolume = parseInt(val);
    saveState();
    const volumeRatio = appState.timer.ambientVolume / 100;

    if (currentAmbientAudio) {
        currentAmbientAudio.volume = volumeRatio;
    }
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function triggerBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: body,
                icon: './images/graduation-cap-solid.png',
                dir: appState.language === 'ar' ? 'rtl' : 'ltr'
            });
        } catch (e) {
            console.error("خطأ في إرسال الإشعار:", e);
        }
    }
}

function startAmbientSound() {
    if (appState.timer.mode !== 'work' || !appState.timer.isRunning) return;

    const soundType = appState.timer.ambientSoundType;
    if (soundType === 'none') {
        stopAmbientSound(true);
        return;
    }

    let soundSrc = soundType;
    if (soundType === 'custom') {
        soundSrc = appState.timer.ambientCustomUrl;
        if (soundSrc && !soundSrc.startsWith('http') && !soundSrc.startsWith('blob:') && !soundSrc.startsWith('sounds/') && !soundSrc.startsWith('/')) {
            soundSrc = 'sounds/ambient/' + soundSrc;
        }
    }

    if (!soundSrc) return;

    if (currentAmbientAudio && currentAmbientSrc === soundSrc) {
        currentAmbientAudio.play().catch(e => console.log("استئناف الصوت:", e));
        return;
    }

    if (currentAmbientAudio) {
        currentAmbientAudio.pause();
    }

    try {
        currentAmbientAudio = new Audio(soundSrc);
        currentAmbientSrc = soundSrc;
        currentAmbientAudio.loop = true;
        currentAmbientAudio.volume = appState.timer.ambientVolume / 100;

        currentAmbientAudio.addEventListener('timeupdate', updateAmbientProgressUI);
        currentAmbientAudio.addEventListener('loadedmetadata', updateAmbientProgressUI);

        currentAmbientAudio.play().catch(e => console.log("تم تقييد التشغيل التلقائي من المتصفح:", e));
    } catch(e) {
        console.error("خطأ تشغيل صوت الخلفية:", e);
    }
}

function pauseAmbientSound() {
    if (currentAmbientAudio) {
        currentAmbientAudio.pause();
    }
}

function stopAmbientSound(reset = false) {
    if (currentAmbientAudio) {
        currentAmbientAudio.pause();
        if (reset) {
            currentAmbientAudio.currentTime = 0;
            currentAmbientAudio = null;
            currentAmbientSrc = '';
            const controls = document.getElementById('ambient-player-controls');
            if (controls) controls.style.display = 'none';
        }
    }
}

function updateAmbientProgressUI() {
    if (!currentAmbientAudio) return;
    const controls = document.getElementById('ambient-player-controls');
    if (controls) controls.style.display = 'block';

    const curr = currentAmbientAudio.currentTime || 0;
    const dur = currentAmbientAudio.duration || 0;

    const currMin = Math.floor(curr / 60);
    const currSec = Math.floor(curr % 60);
    const durMin = Math.floor(dur / 60);
    const durSec = Math.floor(dur % 60);

    document.getElementById('ambient-time-current').innerText = `${String(currMin).padStart(2, '0')}:${String(currSec).padStart(2, '0')}`;
    document.getElementById('ambient-time-duration').innerText = dur ? `${String(durMin).padStart(2, '0')}:${String(durSec).padStart(2, '0')}` : '00:00';

    if (dur > 0) {
        document.getElementById('ambient-seek-bar').value = (curr / dur) * 100;
    }
}

function onAmbientSeekInput(val) {
    if (currentAmbientAudio && currentAmbientAudio.duration) {
        currentAmbientAudio.currentTime = (val / 100) * currentAmbientAudio.duration;
    }
}

function skipAmbientTime(seconds) {
    if (currentAmbientAudio) {
        const newTime = currentAmbientAudio.currentTime + seconds;
        currentAmbientAudio.currentTime = Math.max(0, Math.min(currentAmbientAudio.duration || 0, newTime));
    }
}

function playTaskCompletionSound() {
    try {
        if (completionAudio) {
            completionAudio.pause();
        }
        completionAudio = new Audio('sounds/complete.mp3');
        completionAudio.volume = 0.8;
        completionAudio.play().catch(e => {
            console.log("لم يتم العثور على sounds/complete.mp3 أو منع المتصفح التشغيل.", e);
        });
    } catch(e) {
        console.error("خطأ في صوت إنجاز المهمة", e);
    }
}

function testSelectedSounds() {
    if (appState.timer.ambientSoundType !== 'none') {
        startAmbientSound();
        setTimeout(() => stopAmbientSound(true), 3000);
    }
}

// ==========================================
// وظائف المؤقت
// ==========================================
function setTimerMode(mode) {
    appState.timer.mode = mode;
    const isAr = appState.language === 'ar';
    document.getElementById('mode-work').classList.toggle('active', mode === 'work');
    document.getElementById('mode-break').classList.toggle('active', mode === 'break');
    document.getElementById('timer-mode-label').innerText = mode === 'work' ? (isAr ? 'جلسة دراسة' : 'Study Session') : (isAr ? 'استراحة' : 'Break');
    
    pauseTimer();
    appState.timer.secondsLeft = (mode === 'work' ? appState.timer.workMinutes : appState.timer.breakMinutes) * 60;
    updateTimerDisplay();
}

function updateCustomTimerSettings() {
    const workVal = parseInt(document.getElementById('setting-work').value) || 25;
    const breakVal = parseInt(document.getElementById('setting-break').value) || 5;
    
    appState.timer.workMinutes = Math.max(1, workVal);
    appState.timer.breakMinutes = Math.max(1, breakVal);

    saveState();

    if (!appState.timer.isRunning) {
        setTimerMode(appState.timer.mode);
    }
}

function toggleTimer() {
    if (appState.timer.isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (appState.timer.isRunning) return;
    requestNotificationPermission();

    appState.timer.isRunning = true;
    const isAr = appState.language === 'ar';

    const icon = document.getElementById('pomo-icon');
    icon.className = 'fa-solid fa-pause';

    const status = document.getElementById('timer-status-indicator');
    status.innerText = isAr ? 'يعمل الآن' : 'Running';
    status.classList.remove('paused');

    startAmbientSound();

    appState.timer.intervalId = setInterval(() => {
        if (appState.timer.secondsLeft > 0) {
            appState.timer.secondsLeft--;
            updateTimerDisplay();
        } else {
            pauseTimer();

            if (appState.timer.mode === 'work') {
                triggerBrowserNotification(
                    isAr ? 'انتهت جلسة الدراسة! 🎉' : 'Study session ended! 🎉', 
                    isAr ? 'أحسنت إنجاز هذه الجلسة. حان وقت أخذ استراحة مستحقة.' : 'Well done! Time for a well-deserved break.'
                );
                setTimerMode('break');
            } else {
                triggerBrowserNotification(
                    isAr ? 'انتهت الاستراحة! ⏰' : 'Break ended! ⏰', 
                    isAr ? 'جاهز للجلسة التالية؟ اضغط لبدء الدراسة بتركيز.' : 'Ready for the next session? Click to start studying.'
                );
                setTimerMode('work');
            }
        }
    }, 1000);
}

function pauseTimer() {
    appState.timer.isRunning = false;
    if (appState.timer.intervalId) {
        clearInterval(appState.timer.intervalId);
        appState.timer.intervalId = null;
    }
    const isAr = appState.language === 'ar';
    const icon = document.getElementById('pomo-icon');
    icon.className = 'fa-solid fa-play';

    const status = document.getElementById('timer-status-indicator');
    status.innerText = isAr ? 'متوقف مؤقتاً' : 'Paused';
    status.classList.add('paused');

    pauseAmbientSound();
}

function updateTimerDisplay() {
    const minutes = Math.floor(appState.timer.secondsLeft / 60);
    const seconds = appState.timer.secondsLeft % 60;
    const formattedMin = String(minutes).padStart(2, '0');
    const formattedSec = String(seconds).padStart(2, '0');
    document.getElementById('timer-display').innerText = `${formattedMin}:${formattedSec}`;
}

// دالة مساعدة للنصوص ثنائية اللغة لتقليل التكرار
function langSpan(ar, en) {
    const current = appState.language === 'ar' ? ar : en;
    return `<span class="lang-text" data-ar="${escapeHtml(ar)}" data-en="${escapeHtml(en)}">${current}</span>`;
}

// ==========================================
// وظائف واجهة المهام
// ==========================================
function renderTasks() {
    const grid = document.getElementById('task-grid');
    const header = document.getElementById('current-subject-header');
    if (!grid) return;

    grid.innerHTML = '';
    const isAr = appState.language === 'ar';

    if (appState.activeTab === 'all') {
        header.innerHTML = `
            <i class="fa-solid fa-list-check" style="color: var(--primary);"></i>
            <span>${langSpan('الجدول العام لجميع المهام', 'General Schedule for All Tasks')}</span>
        `;
    } else {
        const currentSub = appState.subjects.find(s => s.id === appState.activeTab);
        if (currentSub) {
            header.innerHTML = `
                <span class="subject-badge-dot" style="background-color: ${currentSub.color}; width: 16px; height: 16px;"></span>
                <span>${langSpan('جدول مادة:', 'Schedule for:')} ${escapeHtml(currentSub.name)}</span>
            `;
        }
    }

    let filteredTasks = appState.tasks;
    if (appState.activeTab !== 'all') {
        filteredTasks = appState.tasks.filter(t => t.subjectId === appState.activeTab);
    }

    if (filteredTasks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clipboard-list"></i>
                <h3>${langSpan('لا توجد مهام حالياً', 'No tasks currently')}</h3>
                <p style="margin-top: 8px;">${langSpan('اضغط على "إضافة مهمة جديدة" للبدء في تنظيم جدولك الدراسي.', 'Click "Add New Task" to start organizing your study schedule.')}</p>
            </div>
        `;
        return;
    }

    if (appState.activeTab === 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayTasks = filteredTasks.filter(t => t.date === todayStr);
        const otherTasks = filteredTasks.filter(t => t.date !== todayStr);

        const todaySection = document.createElement('div');
        todaySection.innerHTML = `
            <h3 class="schedule-section-title">
                <i class="fa-solid fa-calendar-day" style="color: var(--primary);"></i>
                📌 ${langSpan('مهام اليوم', 'Today\'s Tasks')} (${todayTasks.length})
            </h3>
        `;
        const todayGrid = document.createElement('div');
        todayGrid.className = 'task-grid';
        todayGrid.style.marginBottom = '30px';

        if (todayTasks.length === 0) {
            todayGrid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 15px;">${langSpan('لا توجد مهام مسجلة لتاريخ اليوم.', 'No tasks scheduled for today.')}</p>`;
        } else {
            todayTasks.forEach(t => todayGrid.appendChild(createTaskCardElement(t)));
        }
        todaySection.appendChild(todayGrid);
        grid.appendChild(todaySection);

        const otherSection = document.createElement('div');
        otherSection.innerHTML = `
            <h3 class="schedule-section-title">
                <i class="fa-solid fa-calendar-days" style="color: var(--secondary);"></i>
                📅 ${langSpan('مهام باقي الأيام والقادمة', 'Upcoming & Other Tasks')} (${otherTasks.length})
            </h3>
        `;
        const otherGrid = document.createElement('div');
        otherGrid.className = 'task-grid';

        if (otherTasks.length === 0) {
            otherGrid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">${langSpan('لا توجد مهام للأيام الأخرى.', 'No tasks for other days.')}</p>`;
        } else {
            otherTasks.forEach(t => otherGrid.appendChild(createTaskCardElement(t)));
        }
        otherSection.appendChild(otherGrid);
        grid.appendChild(otherSection);

    } else {
        filteredTasks.forEach(task => {
            grid.appendChild(createTaskCardElement(task));
        });
    }
}

function createTaskCardElement(task) {
    const isAr = appState.language === 'ar';
    const sub = appState.subjects.find(s => s.id === task.subjectId) || { name: isAr ? 'مادة محذوفة' : 'Deleted Subject', color: '#64748b' };
    
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;

    let ytButtonsHtml = '';
    const linksList = task.ytLinks || (task.ytUrls ? task.ytUrls.map((u, i) => ({ title: isAr ? `رابط الشرح ${i+1}` : `Link ${i+1}`, url: u })) : []);
    
    if (linksList && linksList.length > 0) {
        linksList.forEach(item => {
            if (item.url) {
                const linkTitle = item.title ? escapeHtml(item.title) : (isAr ? 'رابط الشرح' : 'Tutorial Link');
                ytButtonsHtml += `
                    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="yt-btn">
                        <i class="fa-solid fa-link"></i> ${linkTitle}
                    </a>
                `;
            }
        });
    }

    const noteBtnHtml = `
        <button class="note-btn" onclick="openNoteModal('${task.id}')">
            <i class="fa-solid fa-pen-to-square"></i> ${isAr ? 'الملاحظات' : 'Notes'} ${task.note ? '✏️' : ''}
        </button>
    `;

    card.innerHTML = `
        <div class="checkbox-wrapper">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskComplete('${task.id}')" title="${isAr ? 'تحديد كـ مكتمل' : 'Mark as completed'}">
        </div>
        <div class="task-content">
            <div class="task-header-info">
                <span class="task-tag" style="background-color: ${sub.color};">${escapeHtml(sub.name)}</span>
                ${task.date ? `<span class="task-date"><i class="fa-regular fa-calendar" style="margin-left:4px;"></i>${escapeHtml(task.date)}</span>` : ''}
            </div>
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            ${task.desc ? `<p class="task-desc">${escapeHtml(task.desc)}</p>` : ''}
            <div class="task-actions">
                ${ytButtonsHtml}
                ${noteBtnHtml}
            </div>
        </div>
        <div class="card-top-actions">
            <button class="edit-btn" onclick="openTaskModal('${task.id}')" title="${isAr ? 'تعديل المهمة' : 'Edit Task'}">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="delete-task-btn" onclick="confirmDeleteTask('${task.id}')" title="${isAr ? 'حذف المهمة' : 'Delete Task'}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `;
    return card;
}

function renderYtInputs(links = []) {
    const container = document.getElementById('yt-inputs-container');
    container.innerHTML = '';
    if (!links || links.length === 0) {
        addYtInputRow('', '');
    } else {
        links.forEach(item => {
            if (typeof item === 'string') {
                addYtInputRow('', item);
            } else {
                addYtInputRow(item.title || '', item.url || '');
            }
        });
    }
}

function addYtInputRow(title = '', url = '') {
    const isAr = appState.language === 'ar';
    const container = document.getElementById('yt-inputs-container');
    const row = document.createElement('div');
    row.className = 'yt-link-row';
    row.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    row.innerHTML = `
        <input type="text" class="modal-input task-yt-title-field" style="margin-bottom: 0; flex: 1;" placeholder="${isAr ? 'عنوان الفيديو (مثال: شرح الدرس)' : 'Video Title (e.g. Lesson 1)'}" value="${escapeHtml(title)}">
        <input type="url" class="modal-input task-yt-url-field" style="margin-bottom: 0; flex: 2;" placeholder="${isAr ? 'رابط الفيديو (URL)' : 'Video URL'}" value="${escapeHtml(url)}">
        <button type="button" class="btn-icon-sub delete-sub" onclick="this.parentElement.remove()" title="${isAr ? 'حذف الرابط' : 'Delete Link'}" style="width: 36px; height: 36px; font-size: 1rem; flex-shrink: 0;">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    container.appendChild(row);
}

function openTaskModal(taskId = null) {
    const isAr = appState.language === 'ar';
    appState.editingTaskId = taskId;
    
    const select = document.getElementById('task-subject-select');
    select.innerHTML = '';
    appState.subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.id;
        opt.innerText = sub.name;
        select.appendChild(opt);
    });

    const modalTitle = document.getElementById('task-modal-title');
    const titleInput = document.getElementById('task-title-input');
    const descInput = document.getElementById('task-desc-input');
    const dateInput = document.getElementById('task-date-input');

    if (taskId) {
        const task = appState.tasks.find(t => t.id === taskId);
        if (task) {
            modalTitle.innerText = isAr ? 'تعديل المهمة' : 'Edit Task';
            titleInput.value = task.title;
            descInput.value = task.desc || '';
            dateInput.value = task.date || '';
            select.value = task.subjectId;
            renderYtInputs(task.ytLinks || (task.ytUrls ? task.ytUrls.map(u => ({ title: '', url: u })) : []));
        }
    } else {
        modalTitle.innerText = isAr ? 'إضافة مهمة جديدة' : 'Add New Task';
        titleInput.value = '';
        descInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
        renderYtInputs([]);
        
        if (appState.activeTab !== 'all' && appState.subjects.some(s => s.id === appState.activeTab)) {
            select.value = appState.activeTab;
        } else if (appState.subjects.length > 0) {
            select.value = appState.subjects[0].id;
        }
    }

    openModal('task-modal');
}

function saveTask() {
    const isAr = appState.language === 'ar';
    const titleInput = document.getElementById('task-title-input');
    const title = titleInput.value.trim();
    const subjectId = document.getElementById('task-subject-select').value;
    const desc = document.getElementById('task-desc-input').value.trim();
    const date = document.getElementById('task-date-input').value;

    const titleInputs = document.querySelectorAll('.task-yt-title-field');
    const urlInputs = document.querySelectorAll('.task-yt-url-field');
    const ytLinks = [];

    urlInputs.forEach((input, index) => {
        const uVal = input.value.trim();
        const tVal = titleInputs[index] ? titleInputs[index].value.trim() : '';
        if (uVal) {
            ytLinks.push({
                title: tVal || (isAr ? `رابط الشرح ${ytLinks.length + 1}` : `Link ${ytLinks.length + 1}`),
                url: uVal
            });
        }
    });

    if (!title) {
        titleInput.focus();
        return;
    }

    if (appState.editingTaskId) {
        const task = appState.tasks.find(t => t.id === appState.editingTaskId);
        if (task) {
            task.title = title;
            task.subjectId = subjectId;
            task.desc = desc;
            task.date = date;
            task.ytLinks = ytLinks;
        }
    } else {
        const newTask = {
            id: 't_' + Date.now(),
            subjectId: subjectId,
            title: title,
            desc: desc,
            date: date,
            completed: false,
            ytLinks: ytLinks,
            note: ''
        };
        appState.tasks.unshift(newTask);
    }

    saveState();
    closeModal('task-modal');
    renderSubjectsNav();
    renderTasks();
}

function exportTasksCSV() {
    const isAr = appState.language === 'ar';
    let csvContent = "\uFEFF";
    csvContent += isAr ? "المادة,عنوان المهمة,تاريخ الإنجاز,الحالة,الملاحظات,روابط الشروحات\n" : "Subject,Task Title,Date,Status,Notes,Links\n";

    appState.tasks.forEach(t => {
        const sub = appState.subjects.find(s => s.id === t.subjectId);
        const subName = sub ? sub.name : (isAr ? 'غير محدد' : 'Undefined');
        const status = t.completed ? (isAr ? 'مكتملة' : 'Completed') : (isAr ? 'قيد الانتظار' : 'Pending');
        const links = (t.ytLinks || []).map(l => `${l.title}: ${l.url}`).join(' | ');

        const row = [
            `"${subName.replace(/"/g, '""')}"`,
            `"${t.title.replace(/"/g, '""')}"`,
            `"${t.date || ''}"`,
            `"${status}"`,
            `"${(t.note || '').replace(/"/g, '""')}"`,
            `"${links.replace(/"/g, '""')}"`
        ];
        csvContent += row.join(',') + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `EduCamp_Tasks_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportTasksJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        language: appState.language,
        subjects: appState.subjects,
        tasks: appState.tasks
    }, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `EduCamp_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function handleImportFile(event) {
    const isAr = appState.language === 'ar';
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        try {
            if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(content);
                if (parsed.tasks && Array.isArray(parsed.tasks)) {
                    if (parsed.subjects && Array.isArray(parsed.subjects)) {
                        parsed.subjects.forEach(s => {
                            if (!appState.subjects.some(existing => existing.id === s.id)) {
                                appState.subjects.push(s);
                            }
                        });
                    }
                    appState.tasks = [...parsed.tasks, ...appState.tasks];
                    saveState();
                    renderSubjectsNav();
                    renderTasks();
                    closeModal('import-export-modal');
                    alert(isAr ? 'تم استيراد المهام بنجاح!' : 'Tasks imported successfully!');
                }
            } else if (file.name.endsWith('.csv')) {
                parseCSVAndImport(content);
            }
        } catch (err) {
            console.error("خطأ في قراءة الملف:", err);
            alert(isAr ? "حدث خطأ أثناء قراءة الملف. يرجى التأكد من اختيار ملف صحيح." : "Error reading file. Please make sure to select a valid file.");
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function parseCSVAndImport(csvText) {
    const isAr = appState.language === 'ar';
    const lines = csvText.split('\n');
    if (lines.length <= 1) return;

    let addedCount = 0;
    const defaultSub = appState.subjects[0] || { id: 'default', name: isAr ? 'عام' : 'General' };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 2) {
            const subName = cols[0];
            const taskTitle = cols[1];
            const taskDate = cols[2] || new Date().toISOString().split('T')[0];
            const isDone = cols[3] === 'مكتملة' || cols[3] === 'Completed';
            const note = cols[4] || '';

            let matchedSub = appState.subjects.find(s => s.name === subName);
            if (!matchedSub && subName) {
                matchedSub = { id: 'sub_' + Date.now() + Math.random(), name: subName, color: PRESET_COLORS[appState.subjects.length % PRESET_COLORS.length] };
                appState.subjects.push(matchedSub);
            }

            appState.tasks.push({
                id: 't_imp_' + Date.now() + Math.random(),
                subjectId: matchedSub ? matchedSub.id : defaultSub.id,
                title: taskTitle,
                desc: '',
                date: taskDate,
                completed: isDone,
                ytLinks: [],
                note: note
            });
            addedCount++;
        }
    }

    saveState();
    renderSubjectsNav();
    renderTasks();
    closeModal('import-export-modal');
    alert(isAr ? `تم استيراد (${addedCount}) مهمة بنجاح من ملف الإكسل!` : `Successfully imported (${addedCount}) tasks from CSV file!`);
}

function renderSubjectsNav() {
    const menuContainer = document.getElementById('subjects-menu');
    if (!menuContainer) return;
    menuContainer.innerHTML = '';
    const isAr = appState.language === 'ar';

    const allBtn = document.createElement('button');
    allBtn.className = `nav-btn ${appState.activeTab === 'all' ? 'active' : ''}`;
    const totalTasksCount = appState.tasks.length;
    const completedTotalCount = appState.tasks.filter(t => t.completed).length;

    allBtn.innerHTML = `
        <span>
            <i class="fa-solid fa-layer-group" style="${isAr ? 'margin-left' : 'margin-right'}: 8px; color: var(--primary);"></i>
            ${langSpan('جميع المهام', 'All Tasks')}
        </span>
        <span style="font-size: 0.8rem; opacity: 0.8;">(${completedTotalCount}/${totalTasksCount})</span>
    `;
    allBtn.onclick = () => {
        appState.activeTab = 'all';
        renderSubjectsNav();
        renderTasks();
    };
    menuContainer.appendChild(allBtn);

    appState.subjects.forEach(sub => {
        const subTasks = appState.tasks.filter(t => t.subjectId === sub.id);
        const subCompleted = subTasks.filter(t => t.completed).length;

        const btn = document.createElement('button');
        btn.className = `nav-btn ${appState.activeTab === sub.id ? 'active' : ''}`;
        
        btn.innerHTML = `
            <span style="display: flex; align-items: center; gap: 4px;">
                <span class="subject-badge-dot" style="background-color: ${sub.color};"></span>
                ${escapeHtml(sub.name)}
            </span>
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 0.78rem; opacity: 0.8;">(${subCompleted}/${subTasks.length})</span>
                <div class="subject-actions">
                    <button class="btn-icon-sub" onclick="event.stopPropagation(); openSubjectModal('${sub.id}')" title="${isAr ? 'تعديل المادة' : 'Edit Subject'}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon-sub delete-sub" onclick="event.stopPropagation(); confirmDeleteSubject('${sub.id}')" title="${isAr ? 'حذف المادة' : 'Delete Subject'}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        btn.onclick = () => {
            appState.activeTab = sub.id;
            renderSubjectsNav();
            renderTasks();
        };
        menuContainer.appendChild(btn);
    });

    renderProgressStats();
}

function renderProgressStats() {
    const container = document.getElementById('progress-list-container');
    const totalBadge = document.getElementById('total-completion-badge');
    if (!container) return;

    container.innerHTML = '';

    const totalTasks = appState.tasks.length;
    const completedTasks = appState.tasks.filter(t => t.completed).length;
    const totalPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    if (totalBadge) totalBadge.innerText = `${totalPercent}%`;

    appState.subjects.forEach(sub => {
        const subTasks = appState.tasks.filter(t => t.subjectId === sub.id);
        const count = subTasks.length;
        const completed = subTasks.filter(t => t.completed).length;
        const percent = count > 0 ? Math.round((completed / count) * 100) : 0;

        const item = document.createElement('div');
        item.className = 'progress-container';
        item.innerHTML = `
            <div class="progress-header">
                <span>${escapeHtml(sub.name)}</span>
                <span>${percent}% (${completed}/${count})</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${sub.color};"></div>
            </div>
        `;
        container.appendChild(item);
    });
}

function openSubjectModal(subjectId = null) {
    const isAr = appState.language === 'ar';
    appState.editingSubjectId = subjectId;
    const nameInput = document.getElementById('subject-name-input');
    const modalTitle = document.getElementById('subject-modal-title');
    const colorPicker = document.getElementById('color-picker');

    colorPicker.innerHTML = '';
    PRESET_COLORS.forEach(color => {
        const opt = document.createElement('div');
        opt.className = `color-option ${appState.selectedColor === color ? 'selected' : ''}`;
        opt.style.backgroundColor = color;
        opt.onclick = () => {
            appState.selectedColor = color;
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            opt.classList.add('selected');
        };
        colorPicker.appendChild(opt);
    });

    if (subjectId) {
        const sub = appState.subjects.find(s => s.id === subjectId);
        if (sub) {
            modalTitle.innerText = isAr ? 'تعديل المادة' : 'Edit Subject';
            nameInput.value = sub.name;
            appState.selectedColor = sub.color;
            document.querySelectorAll('.color-option').forEach(el => {
                if (el.style.backgroundColor === sub.color) {
                    el.classList.add('selected');
                }
            });
        }
    } else {
        modalTitle.innerText = isAr ? 'إضافة مادة جديدة' : 'Add New Subject';
        nameInput.value = '';
        appState.selectedColor = PRESET_COLORS[0];
    }

    openModal('subject-modal');
}

function saveSubject() {
    const nameInput = document.getElementById('subject-name-input');
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        return;
    }

    if (appState.editingSubjectId) {
        const sub = appState.subjects.find(s => s.id === appState.editingSubjectId);
        if (sub) {
            sub.name = name;
            sub.color = appState.selectedColor;
        }
    } else {
        const newSub = {
            id: 'sub_' + Date.now(),
            name: name,
            color: appState.selectedColor
        };
        appState.subjects.push(newSub);
    }

    saveState();
    closeModal('subject-modal');
    renderSubjectsNav();
    renderTasks();
}

function showConfirmModal(title, msg, onConfirm) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-msg').innerText = msg;
    confirmCallback = onConfirm;
    openModal('confirm-modal');
}

document.getElementById('confirm-action-btn')?.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeModal('confirm-modal');
});

function confirmDeleteSubject(subjectId) {
    const isAr = appState.language === 'ar';
    const sub = appState.subjects.find(s => s.id === subjectId);
    if (!sub) return;
    showConfirmModal(
        isAr ? 'تأكيد حذف المادة' : 'Confirm Delete Subject',
        isAr ? `هل أنت متأكد من حذف مادة "${sub.name}"؟ سيؤدي ذلك أيضاً إلى حذف جميع المهام التابعة لها.` : `Are you sure you want to delete "${sub.name}"? This will also delete all associated tasks.`,
        () => deleteSubject(subjectId)
    );
}

function deleteSubject(subjectId) {
    appState.subjects = appState.subjects.filter(s => s.id !== subjectId);
    appState.tasks = appState.tasks.filter(t => t.subjectId !== subjectId); // Fix bug: t.subjectId instead of t.id
    if (appState.activeTab === subjectId) {
        appState.activeTab = 'all';
    }
    saveState();
    renderSubjectsNav();
    renderTasks();
}

function toggleTaskComplete(taskId) {
    const task = appState.tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        if (task.completed) {
            playTaskCompletionSound();
        }
        saveState();
        renderSubjectsNav();
        renderTasks();
    }
}

function confirmDeleteTask(taskId) {
    const isAr = appState.language === 'ar';
    const task = appState.tasks.find(t => t.id === taskId);
    if (!task) return;
    showConfirmModal(
        isAr ? 'تأكيد حذف المهمة' : 'Confirm Delete Task',
        isAr ? `هل أنت متأكد من حذف المهمة "${task.title}"؟` : `Are you sure you want to delete the task "${task.title}"?`,
        () => deleteTask(taskId)
    );
}

function deleteTask(taskId) {
    appState.tasks = appState.tasks.filter(t => t.id !== taskId);
    saveState();
    renderSubjectsNav();
    renderTasks();
}

function openNoteModal(taskId) {
    const isAr = appState.language === 'ar';
    appState.editingNoteTaskId = taskId;
    const task = appState.tasks.find(t => t.id === taskId);
    if (task) {
        document.getElementById('note-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> ${isAr ? 'ملاحظات:' : 'Notes:'} ${escapeHtml(task.title)}`;
        document.getElementById('note-modal-textarea').value = task.note || '';
        openModal('note-modal');
    }
}

function saveTaskNote() {
    if (appState.editingNoteTaskId) {
        const task = appState.tasks.find(t => t.id === appState.editingNoteTaskId);
        if (task) {
            task.note = document.getElementById('note-modal-textarea').value;
            saveState();
            renderTasks();
        }
    }
    closeModal('note-modal');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.onload = function() {
    loadState();
    applyLanguage(); // يتم تطبيق اللغة فور تحميل الصفحة وتحديث النصوص
    setTimerMode('work');
};
