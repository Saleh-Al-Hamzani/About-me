/* ==========================================================================
   MAIN APPLICATION LOGIC
   File: js/main.js
   Purpose: State initialization, theme toggle, language switch,
            GitHub stats updater, scroll progress hairline, and scroll reveals.
   ========================================================================== */

// State
let currentLang = 'en';
let currentTheme = 'light';

function detectBrowserLanguage() {
    const browserLangs = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || navigator.userLanguage || ''];

    const isArabic = browserLangs.some(l => l && l.toLowerCase().startsWith('ar'));
    return isArabic ? 'ar' : 'en';
}

function init() {
    // 1. URL parameter override (?lang=ar or ?lang=en)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');

    // 2. Saved user preference (when user explicitly clicked language toggle)
    // Storage can be unavailable in some mobile/private browsing contexts.
    const savedManualLang = safeStorageGet('user_lang_manual');
    const savedTheme = safeStorageGet('theme');

    if (urlLang === 'ar' || urlLang === 'en') {
        currentLang = urlLang;
    } else if (savedManualLang === 'ar' || savedManualLang === 'en') {
        currentLang = savedManualLang;
    } else {
        // 3. Auto-detect from browser languages
        currentLang = detectBrowserLanguage();
    }

    if (savedTheme === 'light' || savedTheme === 'dark') currentTheme = savedTheme;

    applyTheme(currentTheme);
    applyLang(currentLang);
    initScrollReveal();
    initScrollProgress();
    initFreelanceCarousel();

    // Event Listeners
    const langToggleBtn = document.getElementById('langToggle');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            currentLang = currentLang === 'en' ? 'ar' : 'en';
            applyLang(currentLang);
            safeStorageSet('user_lang_manual', currentLang);
            safeStorageSet('lang', currentLang);
        });
    }

    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            // Update the visible page first; persistence should never block the click.
            applyTheme(currentTheme);
            safeStorageSet('theme', currentTheme);
        });
    }

    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileMenu');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    
    if (mobileBtn && mobileOverlay) {
        mobileBtn.addEventListener('click', () => {
            mobileOverlay.classList.add('active');
        });
    }

    if (closeMenuBtn && mobileOverlay) {
        closeMenuBtn.addEventListener('click', () => {
            mobileOverlay.classList.remove('active');
        });
    }

    document.querySelectorAll('.mobile-nav-links .nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (mobileOverlay) mobileOverlay.classList.remove('active');
        });
    });
}

// ==========================================
// UI UPDATERS
// ==========================================
function applyLang(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    const langToggleBtn = document.getElementById('langToggle');
    if (langToggleBtn) {
        langToggleBtn.textContent = 'EN / عر';
        langToggleBtn.setAttribute('aria-label', lang === 'en' ? 'Switch Language to Arabic' : 'Switch Language to English');
    }
    
    if (typeof dict !== 'undefined' && dict[lang]) {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (dict[lang][key]) {
                el.innerHTML = dict[lang][key];
            }
        });
    }

    // Refresh dynamic GitHub display with localized months and descriptions if loaded
    if (typeof window !== 'undefined' && typeof window.refreshGithubDisplay === 'function') {
        window.refreshGithubDisplay();
    }
}

function applyTheme(theme) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    const root = document.documentElement;

    // data-theme drives the site's CSS custom properties and theme selectors.
    root.setAttribute('data-theme', normalizedTheme);
    root.style.colorScheme = normalizedTheme;

    // Explicitly keep the page canvas tied to the variables so the change is immediate.
    if (document.body) {
        document.body.style.backgroundColor = 'var(--paper)';
        document.body.style.color = 'var(--ink)';
    }

    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.setAttribute('aria-pressed', normalizedTheme === 'dark' ? 'true' : 'false');
        themeToggleBtn.setAttribute(
            'aria-label',
            normalizedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
        );
    }
}

function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        // The current page still works if storage is blocked; only persistence is skipped.
    }
}

// ==========================================
// SCROLL PROGRESS INDICATOR
// ==========================================
function initScrollProgress() {
    const scrollBar = document.getElementById('scroll');
    if (!scrollBar) return;

    window.addEventListener('scroll', () => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / (docHeight || 1)) * 100;
        scrollBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }, { passive: true });
}

// ==========================================
// SCROLL REVEAL OBSERVER
// ==========================================
function initScrollReveal() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal, .clip-reveal').forEach(el => el.classList.add('active'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal, .clip-reveal').forEach(el => observer.observe(el));
}

// ==========================================
// FREELANCE 3D PORTFOLIO SLIDER
// ==========================================
function initFreelanceCarousel() {
    const nav = document.getElementById('freelanceCarouselNav');
    const targetImg = document.getElementById('freelance-slide-img');
    if (!nav || !targetImg) return;

    targetImg.style.transition = 'opacity 0.15s ease';

    const dots = nav.querySelectorAll('.carousel-dot');
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const slideSrc = dot.getAttribute('data-slide');
            if (!slideSrc) return;

            dots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');

            targetImg.style.opacity = '0.3';
            setTimeout(() => {
                targetImg.src = slideSrc;
                targetImg.style.opacity = '1';
            }, 120);
        });
    });
}

document.addEventListener('DOMContentLoaded', init);

