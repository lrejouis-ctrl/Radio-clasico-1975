/* ============================================================
   CLASSIC RADIO — REPRODUCTOR COMPLETO
   Con: IndexedDB, velocidad, temporizador, favoritos, atajos
============================================================ */

const ClassicPlayer = (() => {
    const state = {
        audio: null,
        isPlaying: false,
        sourceType: null,
        fileData: null,
        fileName: '',
        title: 'Esperando transmisión...',
        artist: 'Con Leonardo',
        url: null,
        volume: 0.7,
        playbackRate: 1,
        sleepTimer: null,
        sleepRemaining: 0,
        favorites: JSON.parse(localStorage.getItem('classicRadio_favorites') || '[]')
    };

    const els = {};

    function init() {
        els.audio = document.getElementById('main-audio');
        els.fpTitle = document.getElementById('fp-title');
        els.fpArtist = document.getElementById('fp-artist');
        els.fpPlay = document.getElementById('fp-play');
        els.fpPlayIcon = document.getElementById('fp-play-icon');
        els.fpRewind = document.getElementById('fp-rewind');
        els.fpForward = document.getElementById('fp-forward');
        els.fpProgressBar = document.getElementById('fp-progress-bar');
        els.fpProgressFill = document.getElementById('fp-progress-fill');
        els.fpTime = document.getElementById('fp-time');
        els.fpFile = document.getElementById('fp-file');
        els.fpUrl = document.getElementById('fp-url');
        els.fpVolume = document.getElementById('fp-volume');
        els.fpVolumeIcon = document.getElementById('fp-volume-icon');
        els.fpExpand = document.getElementById('fp-expand');
        els.fpSpeed = document.getElementById('fp-speed');
        els.fpSpeedLabel = document.getElementById('fp-speed-label');
        els.fpSleep = document.getElementById('fp-sleep');
        els.fpFavorite = document.getElementById('fp-favorite');
        els.fpFavIcon = document.getElementById('fp-fav-icon');

        els.modal = document.getElementById('player-modal');
        els.modalClose = document.getElementById('modal-close');
        els.modalTitle = document.getElementById('modal-title');
        els.modalArtist = document.getElementById('modal-artist');
        els.modalVisualizer = document.getElementById('modal-visualizer');
        els.modalCurrent = document.getElementById('modal-current');
        els.modalTotal = document.getElementById('modal-total');
        els.modalProgressBar = document.getElementById('modal-progress-bar');
        els.modalProgressFill = document.getElementById('modal-progress-fill');
        els.modalPlay = document.getElementById('modal-play');
        els.modalPlayIcon = document.getElementById('modal-play-icon');
        els.modalRewind = document.getElementById('modal-rewind');
        els.modalForward = document.getElementById('modal-forward');
        els.modalVolume = document.getElementById('modal-volume');
        els.modalVolValue = document.getElementById('modal-vol-value');
        els.modalFile = document.getElementById('modal-file');
        els.modalUrl = document.getElementById('modal-url');
        els.modalClear = document.getElementById('modal-clear');
        els.modalSpeed = document.getElementById('modal-speed');
        els.modalSpeedLabel = document.getElementById('modal-speed-label');
        els.modalSleep = document.getElementById('modal-sleep');
        els.modalFavorite = document.getElementById('modal-favorite');
        els.modalFavIcon = document.getElementById('modal-fav-icon');

        els.notification = document.getElementById('notification');
        els.notificationText = document.getElementById('notification-text');

        els.podcastButtons = document.querySelectorAll('.podcast-play');
        els.filterButtons = document.querySelectorAll('.filter-btn');
        els.podcastCards = document.querySelectorAll('.podcast-card');

        if (!els.audio) return;

        els.audio.volume = state.volume;
        bindEvents();
        restoreFromStorage();
        updateFavoriteIcon();
    }

    function bindEvents() {
        els.fpPlay.addEventListener('click', togglePlay);
        els.modalPlay?.addEventListener('click', togglePlay);

        els.fpRewind.addEventListener('click', () => seekRelative(-15));
        els.fpForward.addEventListener('click', () => seekRelative(15));
        els.modalRewind?.addEventListener('click', () => seekRelative(-15));
        els.modalForward?.addEventListener('click', () => seekRelative(15));

        els.fpProgressBar.addEventListener('click', seekFromClick);
        els.modalProgressBar?.addEventListener('click', seekFromClick);

        els.fpVolume.addEventListener('input', (e) => setVolume(e.target.value));
        els.modalVolume?.addEventListener('input', (e) => setVolume(e.target.value));

        els.fpFile.addEventListener('change', handleFileUpload);
        els.modalFile?.addEventListener('change', handleFileUpload);

        els.fpUrl?.addEventListener('click', promptForUrl);
        els.modalUrl?.addEventListener('click', promptForUrl);

        els.modalClear?.addEventListener('click', clearAudio);

        els.fpExpand?.addEventListener('click', () => els.modal?.classList.add('active'));
        els.modalClose?.addEventListener('click', () => els.modal?.classList.remove('active'));

        els.fpSpeed?.addEventListener('click', cycleSpeed);
        els.modalSpeed?.addEventListener('click', cycleSpeed);

        els.fpSleep?.addEventListener('click', toggleSleepTimer);
        els.modalSleep?.addEventListener('click', toggleSleepTimer);

        els.fpFavorite?.addEventListener('click', toggleFavorite);
        els.modalFavorite?.addEventListener('click', toggleFavorite);

        els.podcastButtons?.forEach(btn => {
            btn.addEventListener('click', () => playPodcast(btn));
        });

        els.filterButtons?.forEach(btn => {
            btn.addEventListener('click', () => filterPodcasts(btn));
        });

        els.audio.addEventListener('loadedmetadata', updateDuration);
        els.audio.addEventListener('timeupdate', updateProgress);
        els.audio.addEventListener('ended', onAudioEnded);
        els.audio.addEventListener('play', onAudioPlay);
        els.audio.addEventListener('pause', onAudioPause);

        window.addEventListener('beforeunload', saveState);

        document.addEventListener('keydown', handleKeyboard);
    }

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ClassicRadioDB', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('audio')) {
                    db.createObjectStore('audio', { keyPath: 'id' });
                }
            };
        });
    }

    async function saveAudioToDB(fileData, metadata) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('audio', 'readwrite');
                tx.objectStore('audio').put({ id: 'current', fileData, ...metadata });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) { console.error('Error guardando:', e); }
    }

    async function loadAudioFromDB() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('audio', 'readonly');
                const request = tx.objectStore('audio').get('current');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return null; }
    }

    async function clearAudioDB() {
        try {
            const db = await openDB();
            db.transaction('audio', 'readwrite').objectStore('audio').clear();
        } catch (e) {}
    }

    function saveMetadata() {
        const meta = {
            sourceType: state.sourceType,
            title: state.title,
            artist: state.artist,
            url: state.url,
            fileName: state.fileName,
            currentTime: els.audio.currentTime,
            volume: els.audio.volume,
            playbackRate: state.playbackRate
        };
        localStorage.setItem('classicRadio_meta', JSON.stringify(meta));
    }

    function loadMetadata() {
        const saved = localStorage.getItem('classicRadio_meta');
        if (!saved) return null;
        try { return JSON.parse(saved); } catch (e) { return null; }
    }

    async function restoreFromStorage() {
        const meta = loadMetadata();
        if (!meta) return;

        state.title = meta.title || 'Audio restaurado';
        state.artist = meta.artist || 'Desde tu última sesión';
        state.sourceType = meta.sourceType;
        state.url = meta.url;
        state.fileName = meta.fileName;
        state.playbackRate = meta.playbackRate || 1;

        updateDisplay();
        updateSpeedLabel();

        if (meta.volume !== undefined) {
            els.audio.volume = meta.volume;
            els.fpVolume.value = meta.volume * 100;
            if (els.modalVolume) els.modalVolume.value = meta.volume * 100;
            if (els.modalVolValue) els.modalVolValue.textContent = Math.round(meta.volume * 100) + '%';
        }

        if (meta.sourceType === 'file') {
            const stored = await loadAudioFromDB();
            if (stored?.fileData) {
                const blob = new Blob([stored.fileData]);
                els.audio.src = URL.createObjectURL(blob);
                els.audio.addEventListener('loadedmetadata', function restore() {
                    if (meta.currentTime && meta.currentTime < els.audio.duration) {
                        els.audio.currentTime = meta.currentTime;
                    }
                    els.audio.removeEventListener('loadedmetadata', restore);
                }, { once: true });
            }
        } else if (meta.sourceType === 'url' && meta.url) {
            els.audio.src = meta.url;
            els.audio.addEventListener('loadedmetadata', function restore() {
                if (meta.currentTime && meta.currentTime < els.audio.duration) {
                    els.audio.currentTime = meta.currentTime;
                }
                els.audio.removeEventListener('loadedmetadata', restore);
            }, { once: true });
        }
    }

    function saveState() { saveMetadata(); }

    function togglePlay() {
        if (!els.audio.src || els.audio.src === window.location.href) {
            showNotification('Sube un audio primero');
            return;
        }

        if (els.audio.paused) {
            els.audio.play().catch(err => {
                console.error('Error:', err);
                showNotification('Error al reproducir');
            });
        } else {
            els.audio.pause();
            saveState();
        }
    }

    function seekRelative(seconds) {
        els.audio.currentTime = Math.max(0, Math.min(els.audio.duration || 0, els.audio.currentTime + seconds));
    }

    function seekFromClick(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        els.audio.currentTime = percent * (els.audio.duration || 0);
    }

    function setVolume(value) {
        const vol = value / 100;
        els.audio.volume = vol;
        state.volume = vol;
        els.fpVolume.value = value;
        if (els.modalVolume) els.modalVolume.value = value;
        if (els.modalVolValue) els.modalVolValue.textContent = value + '%';
        const iconClass = vol === 0 ? 'fa-volume-xmark' : vol < 0.5 ? 'fa-volume-low' : 'fa-volume-high';
        els.fpVolumeIcon.className = `fas ${iconClass}`;
    }

    function cycleSpeed() {
        const speeds = [0.75, 1, 1.25, 1.5, 2];
        const currentIdx = speeds.indexOf(state.playbackRate);
        const nextIdx = (currentIdx + 1) % speeds.length;
        state.playbackRate = speeds[nextIdx];
        els.audio.playbackRate = state.playbackRate;
        updateSpeedLabel();
        showNotification(`Velocidad: ${state.playbackRate}x`);
    }

    function updateSpeedLabel() {
        if (els.fpSpeedLabel) els.fpSpeedLabel.textContent = `${state.playbackRate}x`;
        if (els.modalSpeedLabel) els.modalSpeedLabel.textContent = `Velocidad: ${state.playbackRate}x`;
    }

    function toggleSleepTimer() {
        if (state.sleepTimer) {
            clearTimeout(state.sleepTimer);
            state.sleepTimer = null;
            state.sleepRemaining = 0;
            showNotification('Temporizador cancelado');
            els.fpSleep?.classList.remove('active');
            els.modalSleep?.classList.remove('active');
            return;
        }

        const minutes = prompt('¿Después de cuántos minutos detener la reproducción?', '30');
        if (!minutes || isNaN(minutes)) return;

        state.sleepRemaining = parseInt(minutes) * 60;
        state.sleepTimer = setInterval(() => {
            state.sleepRemaining--;
            if (state.sleepRemaining <= 0) {
                els.audio.pause();
                clearInterval(state.sleepTimer);
                state.sleepTimer = null;
                showNotification('Temporizador finalizado. Buenas noches.');
                els.fpSleep?.classList.remove('active');
                els.modalSleep?.classList.remove('active');
            }
        }, 1000);

        showNotification(`Temporizador: ${minutes} minutos`);
        els.fpSleep?.classList.add('active');
        els.modalSleep?.classList.add('active');
    }

    function toggleFavorite() {
        const currentSrc = els.audio.src;
        if (!currentSrc || currentSrc === window.location.href) {
            showNotification('Reproduce algo primero');
            return;
        }

        const idx = state.favorites.findIndex(f => f.url === currentSrc || f.title === state.title);
        
        if (idx >= 0) {
            state.favorites.splice(idx, 1);
            showNotification('Eliminado de favoritos');
        } else {
            state.favorites.push({
                title: state.title,
                artist: state.artist,
                url: currentSrc,
                date: new Date().toISOString()
            });
            showNotification('Agregado a favoritos');
        }

        localStorage.setItem('classicRadio_favorites', JSON.stringify(state.favorites));
        updateFavoriteIcon();
    }

    function updateFavoriteIcon() {
        const currentSrc = els.audio?.src;
        const isFav = currentSrc && state.favorites.some(f => f.url === currentSrc || f.title === state.title);
        
        const iconClass = isFav ? 'fas fa-heart' : 'far fa-heart';
        if (els.fpFavIcon) els.fpFavIcon.className = iconClass;
        if (els.modalFavIcon) els.modalFavIcon.className = iconClass;
        
        if (isFav) {
            els.fpFavorite?.classList.add('active');
            els.modalFavorite?.classList.add('active');
        } else {
            els.fpFavorite?.classList.remove('active');
            els.modalFavorite?.classList.remove('active');
        }
    }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        
        els.audio.src = url;
        state.sourceType = 'file';
        state.fileData = arrayBuffer;
        state.fileName = file.name;
        state.title = file.name.replace(/\.[^/.]+$/, '');
        state.artist = 'Audio local';
        
        updateDisplay();
        updateFavoriteIcon();
        await saveAudioToDB(arrayBuffer, { fileName: file.name, title: state.title, artist: state.artist });
        els.audio.play().catch(err => console.error(err));
        
        syncFileInputs(file);
        showNotification('Audio cargado');
    }

    function syncFileInputs(file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (els.fpFile) els.fpFile.files = dataTransfer.files;
        if (els.modalFile) els.modalFile.files = dataTransfer.files;
    }

    function promptForUrl() {
        const url = prompt('Ingresa la URL del audio:');
        if (!url) return;
        loadUrl(url);
    }

    function loadUrl(url) {
        els.audio.src = url;
        state.sourceType = 'url';
        state.url = url;
        state.title = 'Stream en vivo';
        state.artist = url.length > 40 ? url.substring(0, 40) + '...' : url;
        updateDisplay();
        updateFavoriteIcon();
        saveMetadata();
        els.audio.play().catch(err => {
            console.error('Error:', err);
            showNotification('URL no válida');
        });
    }

    function playPodcast(btn) {
        const card = btn.closest('.podcast-card');
        const url = card.dataset.src;
        const title = card.dataset.title;
        const artist = card.dataset.artist;
        
        if (els.audio.src === url && !els.audio.paused) {
            els.audio.pause();
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i> Escuchar';
            return;
        }
        
        document.querySelectorAll('.podcast-play').forEach(b => {
            b.classList.remove('playing');
            b.innerHTML = '<i class="fas fa-play"></i> Escuchar';
        });
        
        btn.classList.add('playing');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
        
        state.sourceType = 'url';
        state.url = url;
        state.title = title;
        state.artist = artist;
        
        els.audio.src = url;
        updateDisplay();
        updateFavoriteIcon();
        saveMetadata();
        
        els.audio.play().then(() => {
            btn.innerHTML = '<i class="fas fa-pause"></i> Reproduciendo';
            showNotification(`Reproduciendo: ${title}`);
        }).catch(err => {
            console.error('Error:', err);
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i> Escuchar';
            showNotification('Error al cargar el audio');
        });
    }

    function filterPodcasts(btn) {
        els.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        
        els.podcastCards.forEach(card => {
            if (filter === 'all') {
                card.classList.remove('hidden');
            } else if (filter === 'favoritos') {
                const title = card.dataset.title;
                const isFav = state.favorites.some(f => f.title === title);
                card.classList.toggle('hidden', !isFav);
            } else {
                card.classList.toggle('hidden', card.dataset.category !== filter);
            }
        });
    }

    async function clearAudio() {
        if (!confirm('¿Limpiar el audio guardado?')) return;
        
        els.audio.pause();
        els.audio.src = '';
        state.sourceType = null;
        state.fileData = null;
        state.url = null;
        state.title = 'Esperando transmisión...';
        state.artist = 'Con Leonardo';
        
        await clearAudioDB();
        localStorage.removeItem('classicRadio_meta');
        
        updateDisplay();
        updateFavoriteIcon();
        resetProgress();
        
        document.querySelectorAll('.podcast-play').forEach(b => {
            b.classList.remove('playing');
            b.innerHTML = '<i class="fas fa-play"></i> Escuchar';
        });
        
        showNotification('Audio limpiado');
    }

    function updateDisplay() {
        if (els.fpTitle) els.fpTitle.textContent = state.title;
        if (els.fpArtist) els.fpArtist.textContent = state.artist;
        if (els.modalTitle) els.modalTitle.textContent = state.title;
        if (els.modalArtist) els.modalArtist.textContent = state.artist;
    }

    function updateDuration() {
        const total = formatTime(els.audio.duration);
        if (els.modalTotal) els.modalTotal.textContent = total;
        updateTimeDisplay();
    }

    function updateProgress() {
        if (!els.audio.duration) return;
        const percent = (els.audio.currentTime / els.audio.duration) * 100;
        if (els.fpProgressFill) els.fpProgressFill.style.width = `${percent}%`;
        if (els.modalProgressFill) els.modalProgressFill.style.width = `${percent}%`;
        updateTimeDisplay();
        
        if (Math.floor(els.audio.currentTime) % 5 === 0) saveMetadata();
    }

    function updateTimeDisplay() {
        const current = formatTime(els.audio.currentTime);
        const total = formatTime(els.audio.duration);
        if (els.fpTime) els.fpTime.textContent = `${current} / ${total}`;
        if (els.modalCurrent) els.modalCurrent.textContent = current;
    }

    function resetProgress() {
        if (els.fpProgressFill) els.fpProgressFill.style.width = '0%';
        if (els.modalProgressFill) els.modalProgressFill.style.width = '0%';
        if (els.fpTime) els.fpTime.textContent = '0:00 / 0:00';
        if (els.modalCurrent) els.modalCurrent.textContent = '0:00';
        if (els.modalTotal) els.modalTotal.textContent = '0:00';
    }

    function onAudioPlay() {
        state.isPlaying = true;
        if (els.fpPlayIcon) els.fpPlayIcon.className = 'fas fa-pause';
        if (els.modalPlayIcon) els.modalPlayIcon.className = 'fas fa-pause';
        if (els.modalVisualizer) els.modalVisualizer.classList.add('active');
    }

    function onAudioPause() {
        state.isPlaying = false;
        if (els.fpPlayIcon) els.fpPlayIcon.className = 'fas fa-play';
        if (els.modalPlayIcon) els.modalPlayIcon.className = 'fas fa-play';
        if (els.modalVisualizer) els.modalVisualizer.classList.remove('active');
        saveState();
    }

    function onAudioEnded() {
        state.isPlaying = false;
        if (els.fpPlayIcon) els.fpPlayIcon.className = 'fas fa-play';
        if (els.modalPlayIcon) els.modalPlayIcon.className = 'fas fa-play';
        if (els.modalVisualizer) els.modalVisualizer.classList.remove('active');
        state.title = 'Transmisión finalizada';
        updateDisplay();
    }

    function showNotification(text) {
        if (!els.notification) return;
        els.notificationText.textContent = text;
        els.notification.classList.add('show');
        setTimeout(() => els.notification.classList.remove('show'), 3000);
    }

    function handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                seekRelative(-15);
                break;
            case 'ArrowRight':
                e.preventDefault();
                seekRelative(15);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(Math.min(100, parseInt(els.fpVolume.value) + 5));
                els.fpVolume.value = els.audio.volume * 100;
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(Math.max(0, parseInt(els.fpVolume.value) - 5));
                els.fpVolume.value = els.audio.volume * 100;
                break;
            case 'KeyM':
                setVolume(els.audio.volume === 0 ? 70 : 0);
                els.fpVolume.value = els.audio.volume * 100;
                break;
            case 'KeyF':
                toggleFavorite();
                break;
        }
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', ClassicPlayer.init);