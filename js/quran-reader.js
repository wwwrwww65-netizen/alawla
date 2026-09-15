/**
 * Holy Quran Modern Interactive Reader Engine (المصحف الشريف التفاعلي الحديث)
 * Ultra-Responsive 2026 Mobile UX Architecture:
 * - Fluid Pinch-to-Zoom & Pan Gesture Engine
 * - Immersive Fullscreen Mode with Tap-to-Toggle UI Bars
 * - Instant Preloading & Zero-Latency Page Flipping
 * - One-Click Full Quran PDF Downloader
 * - Complete Isolation from Main App Navigation
 */

(function () {
    let pageNum = 1;
    let totalPages = 569;
    let scale = 1.0;
    let panX = 0;
    let panY = 0;
    let currentTheme = 'default'; // 'default', 'sepia', 'night'
    let surahList = [];
    let isUiVisible = true;
    const prefetchCache = new Set();

    // Universal Open Modal Function
    window.openQuranModal = function () {
        const modal = document.getElementById('quran-modal');
        if (!modal) return;

        // Add body class to completely hide app navigation bars
        document.body.classList.add('quran-reading-mode');

        // Hide other active modals
        document.querySelectorAll('.app.active').forEach(m => {
            if (m !== modal && m.id !== 'status') {
                m.classList.remove('active');
                m.style.display = 'none';
            }
        });

        const isStatusActive = document.getElementById('status')?.classList.contains('active');
        const loginEl = document.getElementById('login');
        if (!isStatusActive && loginEl) {
            loginEl.classList.add('inactive');
        }

        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('active');

        // Reset UI visibility and scale
        showUI();
        window.quranResetZoom();

        // Restore saved bookmark if available
        try {
            const raw = localStorage.getItem('aloula_quran_bookmark');
            if (raw) {
                const data = JSON.parse(raw);
                if (data && data.page && data.page >= 1 && data.page <= totalPages) {
                    pageNum = data.page;
                }
            }
        } catch (e) {}

        // Load Surahs & Render Current Page
        initSurahList();
        renderPage(pageNum);
        updateBookmarkUI();
    };

    window.closeQuranModal = function () {
        const modal = document.getElementById('quran-modal');
        if (!modal) return;

        modal.classList.remove('active');
        document.body.classList.remove('quran-reading-mode');

        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                modal.style.display = 'none';
            }
        }, 180);

        const isStatusActive = document.getElementById('status')?.classList.contains('active');
        const loginEl = document.getElementById('login');
        if (!isStatusActive && loginEl) {
            loginEl.style.display = 'block';
            loginEl.style.visibility = 'visible';
            loginEl.classList.remove('inactive');
        }
    };

    // Single Clean Download Function
    window.downloadQuranFile = async function (event) {
        if (event) {
            if (event.preventDefault) event.preventDefault();
            if (event.stopPropagation) event.stopPropagation();
        }

        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#DFAB52;color:#050811;padding:10px 22px;border-radius:30px;font-weight:900;z-index:2147483647;box-shadow:0 6px 25px rgba(0,0,0,0.8);font-size:0.88rem;transition:opacity 0.3s;pointer-events:none;';
        toast.textContent = 'جاري تنزيل نسخة المصحف الشريف PDF...';
        document.body.appendChild(toast);

        try {
            const resp = await fetch('/mobile-quran.pdf', { cache: 'no-store' });
            if (!resp.ok) throw new Error('Download failed');
            const blob = await resp.blob();
            const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'mobile-quran.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.textContent = 'تم بدء تنزيل المصحف بنجاح ✓';
            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 400);
            }, 2500);
        } catch (err) {
            console.warn('Fallback download triggered', err);
            const a = document.createElement('a');
            a.href = '/download-quran';
            a.download = 'mobile-quran.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.textContent = 'تم بدء التنزيل ✓';
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 400);
            }, 2000);
        }
    };

    window.quranNextPage = function () {
        if (pageNum >= totalPages) return;
        pageNum++;
        window.quranResetZoom();
        renderPage(pageNum);
    };

    window.quranPrevPage = function () {
        if (pageNum <= 1) return;
        pageNum--;
        window.quranResetZoom();
        renderPage(pageNum);
    };

    window.quranGoToPage = function (targetPage) {
        const num = parseInt(targetPage, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
            pageNum = num;
            window.quranResetZoom();
            renderPage(pageNum);
        } else {
            const pageInput = document.getElementById('quranPageInput');
            if (pageInput) pageInput.value = pageNum;
        }
    };

    let sliderTimeout = null;
    window.quranSliderInput = function (val) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
            pageNum = num;
            const pageInput = document.getElementById('quranPageInput');
            if (pageInput) pageInput.value = num;
            
            clearTimeout(sliderTimeout);
            sliderTimeout = setTimeout(() => {
                window.quranResetZoom();
                renderPage(num);
            }, 60);
        }
    };

    window.jumpToSurah = function (page) {
        const p = parseInt(page, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
            pageNum = p;
            window.quranResetZoom();
            renderPage(pageNum);
        }
    };

    // ─── UI Visibility Toggling (Immersive Reading Mode) ───
    function toggleUI() {
        if (isUiVisible) {
            hideUI();
        } else {
            showUI();
        }
    }

    function hideUI() {
        isUiVisible = false;
        const header = document.getElementById('quranHeader');
        const bottom = document.getElementById('quranBottomBar');
        if (header) header.classList.add('ui-hidden');
        if (bottom) bottom.classList.add('ui-hidden');
    }

    function showUI() {
        isUiVisible = true;
        const header = document.getElementById('quranHeader');
        const bottom = document.getElementById('quranBottomBar');
        if (header) header.classList.remove('ui-hidden');
        if (bottom) bottom.classList.remove('ui-hidden');
    }

    // ─── Zoom & Pan Math Engine ───
    window.quranResetZoom = function () {
        scale = 1.0;
        panX = 0;
        panY = 0;
        applyTransform(true);
        updateResetButton();
    };

    function applyTransform(smooth) {
        const img = document.getElementById('quranPageImg');
        if (!img) return;
        
        if (smooth) {
            img.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
        } else {
            img.style.transition = 'none';
        }

        if (scale <= 1.02) {
            scale = 1.0;
            panX = 0;
            panY = 0;
            img.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
        } else {
            // Keep pan bounded
            const maxPanX = (window.innerWidth * (scale - 1)) / 2;
            const maxPanY = (window.innerHeight * (scale - 1)) / 2;
            panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
            panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
            img.style.transform = `translate3d(${panX}px, ${panY}px, 0px) scale(${scale})`;
        }
        updateResetButton();
    }

    function updateResetButton() {
        const btn = document.getElementById('quranZoomResetBtn');
        if (btn) {
            btn.style.display = scale > 1.08 ? 'block' : 'none';
        }
    }

    // ─── Themes (Default / Sepia / Night) ───
    window.toggleQuranTheme = function () {
        const viewer = document.getElementById('quranCanvasContainer');
        if (!viewer) return;

        if (currentTheme === 'default') {
            currentTheme = 'sepia';
            viewer.className = 'quran-viewport-scroll theme-sepia';
        } else if (currentTheme === 'sepia') {
            currentTheme = 'night';
            viewer.className = 'quran-viewport-scroll theme-night';
        } else {
            currentTheme = 'default';
            viewer.className = 'quran-viewport-scroll';
        }
    };

    // ─── Bookmark Management ───
    window.saveQuranBookmark = function () {
        try {
            const select = document.getElementById('quranSurahSelect');
            const surahTitle = select && select.selectedIndex >= 0 ? select.options[select.selectedIndex]?.text : `صفحة ${pageNum}`;
            const data = {
                page: pageNum,
                title: surahTitle,
                savedAt: new Date().toLocaleDateString('ar-SA')
            };
            localStorage.setItem('aloula_quran_bookmark', JSON.stringify(data));
            
            const btn = document.getElementById('quranBookmarkBtn');
            if (btn) {
                btn.style.background = 'rgba(16, 185, 129, 0.35)';
                btn.style.borderColor = '#34d399';
                setTimeout(() => {
                    btn.style.background = '';
                    btn.style.borderColor = '';
                }, 1500);
            }
            updateBookmarkUI();
        } catch (e) {
            console.error('Save bookmark error:', e);
        }
    };

    window.goToQuranBookmark = function () {
        try {
            const raw = localStorage.getItem('aloula_quran_bookmark');
            if (raw) {
                const data = JSON.parse(raw);
                if (data && data.page) {
                    window.quranGoToPage(data.page);
                }
            }
        } catch (e) {}
    };

    function updateBookmarkUI() {
        try {
            const jumpBtn = document.getElementById('quranJumpBookmarkBtn');
            const jumpText = document.getElementById('quranLastBookmarkText');
            const raw = localStorage.getItem('aloula_quran_bookmark');
            if (raw) {
                const data = JSON.parse(raw);
                if (data && data.page) {
                    if (jumpText) jumpText.textContent = `ص ${data.page}`;
                    if (jumpBtn) {
                        jumpBtn.title = `انتقال للعلامة المحفوظة (ص ${data.page})`;
                        jumpBtn.style.display = 'inline-flex';
                    }
                    return;
                }
            }
            if (jumpBtn) jumpBtn.style.display = 'none';
        } catch (e) {}
    }

    // ─── Rendering Engine with Instant Local/Preload Cache ───
    function renderPage(num) {
        const img = document.getElementById('quranPageImg');
        const pageInput = document.getElementById('quranPageInput');
        const totalPagesEl = document.getElementById('quranTotalPages');
        const slider = document.getElementById('quranPageSlider');

        if (pageInput) pageInput.value = num;
        if (slider) slider.value = num;
        if (totalPagesEl) totalPagesEl.textContent = totalPages;

        if (img) {
            const staticUrl = `public/quran-pages/${num}.jpg`;

            const onPageReady = () => {
                img.style.opacity = '1';
                syncSurahSelect(num);
                prefetchNearbyPages(num);
            };

            // If already loaded and active
            if (img.src.endsWith(`public/quran-pages/${num}.jpg`) && img.complete && img.naturalWidth > 0) {
                onPageReady();
                return;
            }

            img.onload = onPageReady;
            img.onerror = function () {
                if (!img.src.includes('/api/quran/page/')) {
                    img.src = `/api/quran/page/${num}`;
                } else {
                    onPageReady();
                }
            };

            img.src = staticUrl;

            if (img.complete && img.naturalWidth > 0) {
                onPageReady();
            }
        }
    }

    function prefetchNearbyPages(current) {
        const toPrefetch = [current + 1, current + 2, current - 1];
        toPrefetch.forEach(p => {
            if (p >= 1 && p <= totalPages && !prefetchCache.has(p)) {
                prefetchCache.add(p);
                const preloadImg = new Image();
                preloadImg.src = `public/quran-pages/${p}.jpg`;
            }
        });
    }

    async function initSurahList() {
        if (surahList.length > 0) return;
        
        // 1. Try API (when running with backend)
        try {
            const resp = await fetch('/api/quran/info');
            if (resp.ok) {
                const json = await resp.json();
                if (json.totalPages) totalPages = json.totalPages;
                if (json.surahs && json.surahs.length) {
                    surahList = json.surahs;
                    populateSurahsDropdown(surahList);
                    syncSurahSelect(pageNum);
                    return;
                }
            }
        } catch (e) {}

        // 2. Try static JSON file directly (MikroTik RouterOS static storage)
        try {
            const jsonResp = await fetch('js/quran-surahs.json').catch(() => fetch('/js/quran-surahs.json'));
            if (jsonResp && jsonResp.ok) {
                const json = await jsonResp.json();
                if (Array.isArray(json) && json.length > 0) {
                    surahList = json;
                    populateSurahsDropdown(surahList);
                    syncSurahSelect(pageNum);
                    return;
                }
            }
        } catch (e) {}
    }

    function populateSurahsDropdown(list) {
        const select = document.getElementById('quranSurahSelect');
        if (!select) return;

        select.innerHTML = '<option value="">📑 فهرس السور...</option>';
        list.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.page;
            opt.textContent = `${s.title} (ص ${s.page})`;
            select.appendChild(opt);
        });
    }

    function syncSurahSelect(pageNumber) {
        const select = document.getElementById('quranSurahSelect');
        if (!select) return;

        if (surahList && surahList.length > 0) {
            for (let i = 0; i < surahList.length; i++) {
                if (surahList[i].page <= pageNumber && (!surahList[i+1] || surahList[i+1].page > pageNumber)) {
                    select.value = surahList[i].page;
                    return;
                }
            }
        } else {
            for (let i = select.options.length - 1; i >= 0; i--) {
                const pVal = parseInt(select.options[i].value, 10);
                if (!isNaN(pVal) && pVal <= pageNumber) {
                    select.selectedIndex = i;
                    break;
                }
            }
        }
    }

    // ─── Touch & Pinch-to-Zoom Engine ───
    function setupTouchEngine() {
        const viewer = document.getElementById('quranViewerContainer');
        if (!viewer) return;

        let isTouchDown = false;
        let isPinching = false;
        let initialDistance = 0;
        let initialScale = 1.0;
        let startTouchX = 0;
        let startTouchY = 0;
        let lastPanX = 0;
        let lastPanY = 0;
        let touchStartTime = 0;
        let lastTapTime = 0;

        const getDistance = (t1, t2) => {
            return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        };

        viewer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Two fingers = Pinch Zoom
                isPinching = true;
                initialDistance = getDistance(e.touches[0], e.touches[1]);
                initialScale = scale;
            } else if (e.touches.length === 1) {
                isPinching = false;
                isTouchDown = true;
                startTouchX = e.touches[0].clientX;
                startTouchY = e.touches[0].clientY;
                lastPanX = panX;
                lastPanY = panY;
                touchStartTime = Date.now();
            }
        }, { passive: false });

        viewer.addEventListener('touchmove', (e) => {
            if (isPinching && e.touches.length === 2) {
                e.preventDefault();
                const dist = getDistance(e.touches[0], e.touches[1]);
                if (initialDistance > 0) {
                    const factor = dist / initialDistance;
                    scale = Math.min(Math.max(initialScale * factor, 1.0), 3.5);
                    applyTransform(false);
                }
            } else if (isTouchDown && e.touches.length === 1 && scale > 1.05) {
                // Pan while zoomed in
                e.preventDefault();
                const deltaX = e.touches[0].clientX - startTouchX;
                const deltaY = e.touches[0].clientY - startTouchY;
                panX = lastPanX + deltaX;
                panY = lastPanY + deltaY;
                applyTransform(false);
            }
        }, { passive: false });

        viewer.addEventListener('touchend', (e) => {
            if (isPinching) {
                if (e.touches.length === 0) {
                    isPinching = false;
                    applyTransform(true);
                }
            } else if (isTouchDown && e.changedTouches.length === 1) {
                isTouchDown = false;
                const endTouchX = e.changedTouches[0].clientX;
                const endTouchY = e.changedTouches[0].clientY;
                const deltaX = endTouchX - startTouchX;
                const deltaY = endTouchY - startTouchY;
                const touchDuration = Date.now() - touchStartTime;

                // Check for quick Tap
                if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && touchDuration < 280) {
                    const now = Date.now();
                    if (now - lastTapTime < 320) {
                        // Double Tap: Toggle 1.8x Zoom
                        if (scale > 1.05) {
                            window.quranResetZoom();
                        } else {
                            scale = 1.8;
                            panX = 0;
                            panY = 0;
                            applyTransform(true);
                        }
                        lastTapTime = 0;
                    } else {
                        // Single Tap in middle zone (20% to 80% screen width)
                        const screenW = window.innerWidth;
                        if (endTouchX > screenW * 0.2 && endTouchX < screenW * 0.8) {
                            toggleUI();
                        }
                        lastTapTime = now;
                    }
                    return;
                }

                // If not zoomed, check for swipe to change page (RTL Arabic Quran)
                if (scale <= 1.05) {
                    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
                        if (deltaX < 0) {
                            // Swiping left = Advance to Next page
                            window.quranNextPage();
                        } else {
                            // Swiping right = Go back to Previous page
                            window.quranPrevPage();
                        }
                    }
                } else {
                    applyTransform(true);
                }
            }
        }, { passive: false });

        // Keyboard navigation (RTL aware)
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('quran-modal');
            if (!modal || !modal.classList.contains('active')) return;

            if (e.key === 'ArrowLeft' || e.key === 'PageDown') {
                window.quranNextPage();
            } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
                window.quranPrevPage();
            } else if (e.key === 'Escape') {
                window.closeQuranModal();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupTouchEngine);
    } else {
        setupTouchEngine();
    }

    // Delegation for opening and downloading
    document.addEventListener('click', function (e) {
        const trigger = e.target.closest('.quran-btn-read, [data-open-quran], button[parent-id="quran-modal"]');
        if (trigger) {
            e.preventDefault();
            window.openQuranModal();
            return;
        }

        const dlTrigger = e.target.closest('.quran-btn-download, [data-download-quran]');
        if (dlTrigger) {
            window.downloadQuranFile(e);
            return;
        }
    });

})();
