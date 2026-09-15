/* ==========================================================================
   GITHUB ACTIVITY DYNAMIC API INTEGRATION
   File: js/github.js
   Purpose: Fetches live data from GitHub REST API for @Saleh-Al-Hamzani,
            dynamically generates repository cards, aggregates total stars,
            calculates byte-level language percentages, and handles rate limits.
   ========================================================================== */

(function () {
    'use strict';

    const GITHUB_USERNAME = 'Saleh-Al-Hamzani';
    const CACHE_KEY = 'gh_activity_data_v1';
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache to protect 60 req/hr rate limit

    // Standard GitHub Language Colors
    const LANG_COLORS = {
        'C#': '#178600',
        'Kotlin': '#A97BFF',
        'HTML': '#E34C26',
        'CSS': '#563D7C',
        'JavaScript': '#F1E05A',
        'TypeScript': '#3178C6',
        'Python': '#3572A5',
        'C++': '#F34B7D',
        'C': '#555555',
        'Java': '#B07219',
        'Rust': '#DEA584',
        'Go': '#00ADD8',
        'ShaderLab': '#222C37',
        'GLSL': '#5686A5',
        'HLSL': '#CAC9C9',
        'GDScript': '#355570',
        'Shell': '#89E051',
        'Markdown': '#083FA1'
    };

    function getLangColor(langName) {
        if (!langName) return 'var(--muted)';
        if (LANG_COLORS[langName]) return LANG_COLORS[langName];
        let hash = 0;
        for (let i = 0; i < langName.length; i++) {
            hash = langName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return 'hsl(' + hue + ', 60%, 50%)';
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function formatMonthYear(dateString, lang) {
        if (!dateString) return '—';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '—';
            
            const monthNamesEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            
            const monthIndex = date.getUTCMonth();
            const year = date.getUTCFullYear();

            if (lang === 'ar') {
                return monthNamesAr[monthIndex] + ' ' + year;
            }
            return monthNamesEn[monthIndex] + ' ' + year;
        } catch (e) {
            return '—';
        }
    }

    let cachedPayload = null;

    function getCachedData() {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const item = JSON.parse(raw);
            if (Date.now() - item.timestamp < CACHE_TTL_MS) {
                return item.data;
            }
        } catch (e) {}
        return null;
    }

    function setCachedData(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {}
    }

    function getTranslation(key, fallback) {
        const lang = document.documentElement.lang || 'en';
        if (window.dict && window.dict[lang] && window.dict[lang][key]) {
            return window.dict[lang][key];
        }
        return fallback;
    }

    function renderLoadingState() {
        const reposEl = document.getElementById('gh-public-repos');
        const starsEl = document.getElementById('gh-total-stars');
        const followersEl = document.getElementById('gh-followers');
        const activeSinceEl = document.getElementById('gh-active-since');

        if (reposEl) reposEl.innerHTML = '<span class="gh-skeleton">...</span>';
        if (starsEl) starsEl.innerHTML = '<span class="gh-skeleton">...</span>';
        if (followersEl) followersEl.innerHTML = '<span class="gh-skeleton">...</span>';
        if (activeSinceEl) activeSinceEl.innerHTML = '<span class="gh-skeleton">...</span>';

        const repoListEl = document.getElementById('gh-repo-list');
        if (repoListEl) {
            const loadingText = getTranslation('tech_loading', 'Fetching live repositories from GitHub API...');
            repoListEl.innerHTML = '<div class="gh-state-box gh-loading-state">' +
                '<i class="fa-solid fa-circle-notch fa-spin"></i> ' +
                '<span>' + loadingText + '</span>' +
                '</div>';
        }

        const barEl = document.getElementById('gh-lang-progress-bar');
        if (barEl) {
            barEl.innerHTML = '<span class="gh-bar-segment gh-bar-loading" style="width: 100%;"></span>';
            barEl.removeAttribute('title');
        }

        const breakdownEl = document.getElementById('gh-lang-breakdown');
        if (breakdownEl) {
            const loadingText = getTranslation('tech_loading_langs', 'Calculating codebase byte distribution...');
            breakdownEl.innerHTML = '<div class="gh-state-box gh-loading-state">' +
                '<i class="fa-solid fa-circle-notch fa-spin"></i> ' +
                '<span>' + loadingText + '</span>' +
                '</div>';
        }
    }

    function renderErrorState(errorMessage, isRateLimit) {
        const reposEl = document.getElementById('gh-public-repos');
        const starsEl = document.getElementById('gh-total-stars');
        const followersEl = document.getElementById('gh-followers');
        const activeSinceEl = document.getElementById('gh-active-since');

        if (reposEl) reposEl.textContent = '—';
        if (starsEl) starsEl.textContent = '—';
        if (followersEl) followersEl.textContent = '—';
        if (activeSinceEl) activeSinceEl.textContent = '—';

        const repoListEl = document.getElementById('gh-repo-list');
        if (repoListEl) {
            const message = isRateLimit 
                ? getTranslation('tech_rate_limited', 'GitHub API rate limit reached for this IP. View repositories directly on GitHub.')
                : (errorMessage || getTranslation('tech_error_load', 'Unable to load GitHub repositories.'));

            repoListEl.innerHTML = '<div class="gh-state-box gh-error-state">' +
                '<i class="fa-solid fa-triangle-exclamation"></i>' +
                '<div class="gh-error-content">' +
                '<p>' + escapeHtml(message) + '</p>' +
                '<a href="https://github.com/' + GITHUB_USERNAME + '" target="_blank" rel="noopener noreferrer" class="gh-error-link">' +
                'github.com/' + GITHUB_USERNAME + ' ↗</a>' +
                '</div>' +
                '</div>';
        }

        const barEl = document.getElementById('gh-lang-progress-bar');
        if (barEl) {
            barEl.innerHTML = '<span class="gh-bar-segment gh-bar-empty" style="width: 100%;"></span>';
            barEl.removeAttribute('title');
        }

        const breakdownEl = document.getElementById('gh-lang-breakdown');
        if (breakdownEl) {
            const noLangsText = getTranslation('tech_no_langs', 'No language data available.');
            breakdownEl.innerHTML = '<div class="gh-state-box gh-empty-state">' +
                '<span>' + escapeHtml(noLangsText) + '</span>' +
                '</div>';
        }
    }

    function renderData(payload) {
        const currentLang = document.documentElement.lang || 'en';

        // 1. Summary Pills
        const reposEl = document.getElementById('gh-public-repos');
        const starsEl = document.getElementById('gh-total-stars');
        const followersEl = document.getElementById('gh-followers');
        const activeSinceEl = document.getElementById('gh-active-since');

        if (reposEl) reposEl.textContent = payload.publicRepos;
        if (starsEl) starsEl.textContent = payload.totalStars;
        if (followersEl) followersEl.textContent = payload.followers;
        if (activeSinceEl) activeSinceEl.textContent = formatMonthYear(payload.createdAt, currentLang);

        // 2. Repository Cards List
        const repoListEl = document.getElementById('gh-repo-list');
        if (repoListEl) {
            if (!payload.repos || payload.repos.length === 0) {
                const emptyText = getTranslation('tech_no_repos', 'No public repositories found.');
                repoListEl.innerHTML = '<div class="gh-state-box gh-empty-state"><span>' + escapeHtml(emptyText) + '</span></div>';
            } else {
                const noDescText = getTranslation('tech_no_desc', 'No description provided.');
                
                const cardsHtml = payload.repos.map(function (repo) {
                    const primaryLang = repo.language || 'Plain Text';
                    const dotColor = getLangColor(primaryLang);
                    const desc = repo.description ? escapeHtml(repo.description) : ('<span class="gh-empty-desc">' + escapeHtml(noDescText) + '</span>');
                    const stars = typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0;

                    return '<a href="' + escapeHtml(repo.html_url) + '" target="_blank" rel="noopener noreferrer" class="gh-repo-item">' +
                        '<div class="gh-repo-top">' +
                        '<span class="gh-repo-name"><i class="fa-regular fa-folder"></i> ' + escapeHtml(repo.name) + '</span>' +
                        '<span class="gh-repo-stars"><i class="fa-regular fa-star"></i> ' + stars + '</span>' +
                        '</div>' +
                        '<p class="gh-repo-desc">' + desc + '</p>' +
                        '<div class="gh-repo-meta">' +
                        '<span class="gh-lang-tag">' +
                        '<span class="gh-lang-dot" style="background-color: ' + dotColor + ';"></span> ' +
                        escapeHtml(primaryLang) +
                        '</span>' +
                        '</div>' +
                        '</a>';
                }).join('');

                repoListEl.innerHTML = cardsHtml;
            }
        }

        // 3. Language Progress Bar & Breakdown List
        const barEl = document.getElementById('gh-lang-progress-bar');
        const breakdownEl = document.getElementById('gh-lang-breakdown');

        if (payload.languages && payload.languages.length > 0) {
            const tooltipParts = payload.languages.map(function (l) {
                return l.name + ': ' + l.percentage.toFixed(1) + '%';
            }).join(' | ');

            if (barEl) {
                barEl.setAttribute('title', tooltipParts);
                barEl.innerHTML = payload.languages.map(function (l) {
                    return '<span class="gh-bar-segment" style="width: ' + l.percentage + '%; background-color: ' + l.color + ';" title="' + escapeHtml(l.name) + ': ' + l.percentage.toFixed(1) + '%"></span>';
                }).join('');
            }

            if (breakdownEl) {
                breakdownEl.innerHTML = payload.languages.map(function (l) {
                    return '<div class="gh-lb-item">' +
                        '<div class="gh-lb-info">' +
                        '<span class="gh-lang-dot" style="background-color: ' + l.color + ';"></span>' +
                        '<span class="gh-lb-name">' + escapeHtml(l.name) + '</span>' +
                        '</div>' +
                        '<span class="gh-lb-pct">' + l.percentage.toFixed(1) + '% <span class="meta-text">(' + formatBytes(l.bytes) + ')</span></span>' +
                        '</div>';
                }).join('');
            }
        } else {
            if (barEl) {
                barEl.innerHTML = '<span class="gh-bar-segment gh-bar-empty" style="width: 100%;"></span>';
                barEl.removeAttribute('title');
            }
            if (breakdownEl) {
                const noLangsText = getTranslation('tech_no_langs', 'No language data available.');
                breakdownEl.innerHTML = '<div class="gh-state-box gh-empty-state"><span>' + escapeHtml(noLangsText) + '</span></div>';
            }
        }
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

    async function loadGithubActivity(forceRefresh) {
        if (!forceRefresh) {
            const cached = getCachedData();
            if (cached) {
                cachedPayload = cached;
                renderData(cached);
                return;
            }
        }

        renderLoadingState();

        try {
            const userRes = await fetch('https://api.github.com/users/' + GITHUB_USERNAME);
            if (!userRes.ok) {
                const isRateLimit = userRes.status === 403 || userRes.status === 429;
                renderErrorState(userRes.statusText, isRateLimit);
                return;
            }
            const userData = await userRes.json();

            const reposRes = await fetch('https://api.github.com/users/' + GITHUB_USERNAME + '/repos?per_page=100&sort=updated');
            if (!reposRes.ok) {
                const isRateLimit = reposRes.status === 403 || reposRes.status === 429;
                renderErrorState(reposRes.statusText, isRateLimit);
                return;
            }
            const rawRepos = await reposRes.json();
            const publicRepos = Array.isArray(rawRepos) ? rawRepos.filter(function (r) { return !r.fork; }) : [];
            const totalStars = publicRepos.reduce(function (acc, r) { return acc + (r.stargazers_count || 0); }, 0);

            const languageByteMap = {};
            let totalBytes = 0;

            const langPromises = publicRepos.map(async function (repo) {
                if (!repo.languages_url) return;
                try {
                    const lRes = await fetch(repo.languages_url);
                    if (lRes.ok) {
                        const lData = await lRes.json();
                        for (const [lang, bytes] of Object.entries(lData)) {
                            languageByteMap[lang] = (languageByteMap[lang] || 0) + bytes;
                            totalBytes += bytes;
                        }
                    }
                } catch (err) {}
            });

            await Promise.allSettled(langPromises);

            const languageList = Object.entries(languageByteMap)
                .map(function (entry) {
                    const name = entry[0];
                    const bytes = entry[1];
                    return {
                        name: name,
                        bytes: bytes,
                        percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
                        color: getLangColor(name)
                    };
                })
                .sort(function (a, b) { return b.bytes - a.bytes; });

            const payload = {
                username: GITHUB_USERNAME,
                publicRepos: userData.public_repos !== undefined ? userData.public_repos : publicRepos.length,
                followers: userData.followers || 0,
                createdAt: userData.created_at,
                totalStars: totalStars,
                repos: publicRepos,
                languages: languageList
            };

            cachedPayload = payload;
            setCachedData(payload);
            renderData(payload);

        } catch (error) {
            console.error('GitHub API fetch failed:', error);
            renderErrorState(error ? error.message : '', false);
        }
    }

    window.refreshGithubDisplay = function () {
        if (cachedPayload) {
            renderData(cachedPayload);
        } else {
            loadGithubActivity(false);
        }
    };

    window.reloadGithubFromAPI = function () {
        loadGithubActivity(true);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { loadGithubActivity(false); });
    } else {
        loadGithubActivity(false);
    }

})();
