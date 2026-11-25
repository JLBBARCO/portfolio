// unique identifier for the most recent dynamic-content load; used to
// ignore stale async results (e.g. user switched language mid-load).
let _currentLoadId = 0;

// Helper para normalizar classes do Font Awesome
function faClass(style, icon, size) {
    let styleClass = style || 'fa-solid';
    if (styleClass && !styleClass.startsWith('fa-')) styleClass = `fa-${styleClass}`;
    let iconClass = icon || '';
    if (iconClass && !iconClass.startsWith('fa-')) iconClass = `fa-${iconClass}`;
    let sizeClass = size || '';
    if (sizeClass && !sizeClass.startsWith('fa-')) sizeClass = `fa-${sizeClass}`;
    return [styleClass, iconClass, sizeClass].filter(Boolean).join(' ');
}

const preconnectLinks = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const insertHeader = [
    "<link href='https://fonts.googleapis.com/css2?family=Audiowide&family=Caveat:wght@400..700&family=MedievalSharp&family=Overlock:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&display=swap' rel='stylesheet'>",
];

// Mantém as classes fa-* existentes como identificadores, sem depender do kit FontAwesome.
const _faAliasMap = {
    javascript: 'javascript',
    js: 'javascript',
    html: 'html',
    html5: 'html',
    css: 'css',
    css3: 'css',
    'c#': 'c-sharp',
    csharp: 'c-sharp',
    'c++': 'cplusplus',
    node: 'node-js',
    nodejs: 'node-js',
    'vue-js': 'vue',
    react: 'react',
    angular: 'angular',
    'svelte-sveltekit': 'svelte',
    'github-actions': 'github-actions',
};

const _theSvgUiAliasMap = {
    'angle-left': 'chevron-left',
    'angle-right': 'chevron-right',
    'arrow-up-right-from-square': 'external-link',
    bars: 'menu',
    'chevron-down': 'chevron-down',
    close: 'x',
    envelope: 'mail',
    minus: 'minus',
    menu: 'menu',
    plus: 'plus',
    star: 'star',
    'text-slash': 'text-slash',
    'universal-access': 'accessibility',
    xmark: 'x',
    'arrow-up': 'arrow-up',
};

const _customSvgIconMap = {
    powershell: { style: 'fa-solid', icon: 'fa-powershell' },
    pwsh: { style: 'fa-solid', icon: 'fa-powershell' },
    shell: { style: 'fa-solid', icon: 'fa-shell' },
    ssh: { style: 'fa-solid', icon: 'fa-shell' },
    'secure-shell': { style: 'fa-solid', icon: 'fa-shell' },
    batchfile: { style: 'fa-solid', icon: 'fa-batchfile' },
    'batch-file': { style: 'fa-solid', icon: 'fa-batchfile' },
    'batch-script': { style: 'fa-solid', icon: 'fa-batchfile' },
    bat: { style: 'fa-solid', icon: 'fa-batchfile' },
    cmd: { style: 'fa-solid', icon: 'fa-batchfile' },
};

const _iconExceptionRules = {
    email: {
        aliases: ['email', 'e-mail', 'mail'],
        fa: { style: 'fa-regular', icon: 'fa-envelope' },
    },
    github: {
        aliases: ['github', 'git-hub'],
        fa: { style: 'fa-brands', icon: 'fa-github' },
    },
    linkedin: {
        aliases: ['linkedin', 'linked-in'],
        fa: { style: 'fa-brands', icon: 'fa-linkedin' },
    },
    instagram: {
        aliases: ['instagram', 'insta'],
        fa: { style: 'fa-brands', icon: 'fa-instagram' },
    },
};

function normalizeIconToken(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/^fa-/, '')
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
}

function getCustomSvgIcon(value) {
    const key = normalizeIconToken(value);
    return key ? _customSvgIconMap[key] || null : null;
}

function findIconException(token) {
    const normalizedToken = normalizeIconToken(token);
    if (!normalizedToken) return null;

    const entries = Object.entries(_iconExceptionRules);
    for (const [key, rule] of entries) {
        const aliases = Array.isArray(rule.aliases) ? rule.aliases : [];
        if (normalizedToken === normalizeIconToken(key)) {
            return { key, rule };
        }
        if (aliases.some((alias) => normalizeIconToken(alias) === normalizedToken)) {
            return { key, rule };
        }
    }
    return null;
}

function resolveIconName(iconData, fallbackName = '') {
    const source =
        iconData && typeof iconData === 'object'
            ? iconData
            : { iconName: String(iconData || fallbackName || '') };

    const candidates = [source.iconName, source.icon, source.name, fallbackName];

    for (const candidate of candidates) {
        const fromException = findIconException(candidate);
        if (fromException) return fromException.key;

        const normalized = normalizeIconToken(candidate);
        if (normalized) return normalized;
    }

    return 'icon-not-found';
}

function resolveIconSpec(iconData, fallbackName = '') {
    const source =
        iconData && typeof iconData === 'object'
            ? iconData
            : { name: String(iconData || fallbackName || '') };

    let style = source.style || '';
    let icon = source.icon || '';
    const iconName = resolveIconName(source, fallbackName);
    const hasExplicitFaIcon = typeof icon === 'string' && icon.trim().startsWith('fa-');

    const fromException = findIconException(iconName);
    if (fromException && (!icon || !hasExplicitFaIcon)) {
        style = style || fromException.rule.fa.style;
        icon = fromException.rule.fa.icon;
    }

    const customByIcon = getCustomSvgIcon(icon);
    if (customByIcon) {
        style = style || customByIcon.style;
        icon = customByIcon.icon;
    }

    if (!icon) {
        const fromName = getCustomSvgIcon(source.name || fallbackName);
        if (fromName) {
            style = style || fromName.style;
            icon = fromName.icon;
        }
    }

    if (!icon && (source.name || fallbackName)) {
        const guessed = guessFaIcon(source.name || fallbackName);
        if (guessed) {
            style = style || guessed.style;
            icon = guessed.icon;
        }
    }

    if (!icon) {
        style = style || 'fa-solid';
        icon = `fa-${iconName}`;
    }

    return { style: style || 'fa-solid', icon, iconName };
}

function guessFaIcon(name) {
    if (!name) return null;
    const key = normalizeIconToken(name);
    const custom = getCustomSvgIcon(name);
    if (custom) return custom;
    if (!key || key === 'icon-not-found') return null;
    return { style: 'fa-brands', icon: `fa-${_faAliasMap[key] || key}` };
}

// choose a stack category based on common language/technology names.  the
// returned object has the same shape as the stack entries in projects.json.
function determineStack(name) {
    const lower = (name || '').toLowerCase();
    const front = [
        'html',
        'css',
        'javascript',
        'js',
        'react',
        'vue',
        'angular',
        'sass',
        'scss',
        'bootstrap',
        'tailwind',
    ];
    const back = [
        'python',
        'java',
        'node',
        'nodejs',
        'php',
        'ruby',
        'go',
        'c#',
        'c++',
        'c',
        'rust',
        'kotlin',
        'swift',
    ];
    if (front.some((w) => lower.includes(w)))
        return { id: 'frontEnd', 'en-US': 'Front-end', 'pt-BR': 'Front-end' };
    if (back.some((w) => lower.includes(w)))
        return { id: 'backEnd', 'en-US': 'Back-end', 'pt-BR': 'Back-end' };
    return { id: 'other', 'en-US': 'Other', 'pt-BR': 'Outro' };
}

// Controle de tamanho de fonte
let fontSize = 1;

// fetch com fallback
function fetchAny(...paths) {
    return new Promise((resolve, reject) => {
        let i = 0;
        function next() {
            if (i >= paths.length) return reject(new Error('All fetch attempts failed'));
            fetch(paths[i])
                .then((res) => {
                    if (res.ok) resolve(res);
                    else {
                        i++;
                        next();
                    }
                })
                .catch(() => {
                    i++;
                    next();
                });
        }
        next();
    });
}

// ============================================================================
// GitHub API helpers
// ============================================================================

/**
 * Retrieve repository list for a user; uses localStorage caching to avoid
 * hammering the unauthenticated rate limit.  The cache expires after one hour.
 * Returns a promise that resolves to the raw array returned by the GitHub API.
 */

function fetchJsonWithFallback(path) {
    const basename = path.split('/').pop();
    return fetchAny(path, basename).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`Fetch failed with status: ${res.status}`)),
    );
}

document.addEventListener('DOMContentLoaded', () => {
    function bindDynamicHeaderControls() {
        const menuButton = document.getElementById('menu-button');
        if (menuButton && !menuButton.dataset.boundToggle) {
            menuButton.addEventListener('click', toggleMenu);
            menuButton.dataset.boundToggle = 'true';
        }

        if (typeof bindLanguageDropdown === 'function') {
            bindLanguageDropdown();
        }
    }

    document.head.insertAdjacentHTML('beforeend', insertHeader.join('\n'));

    _preconnectLinks(preconnectLinks);

    const faviconLink = document.getElementById('favicon');
    const prefersDark =
        typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-color-scheme: dark)')
            : null;

    function updateFavicon(eventOrBool) {
        const isDark =
            typeof eventOrBool === 'boolean'
                ? eventOrBool
                : eventOrBool && typeof eventOrBool.matches !== 'undefined'
                  ? eventOrBool.matches
                  : prefersDark
                    ? prefersDark.matches
                    : false;
        if (!faviconLink) return;
        // Os links dos favicones ficam em src/json/areas/images.json.
        const imageId = isDark ? 'faviconDark' : 'faviconLight';
        const applyHref = (href) => {
            if (!href) return;
            faviconLink.href = href + (href.includes('?') ? '&' : '?') + 'v=' + Date.now();
        };

        if (window.SiteImages && typeof window.SiteImages.src === 'function') {
            const immediate = window.SiteImages.srcSync(imageId);
            if (immediate) applyHref(immediate);
            else
                window.SiteImages.src(imageId)
                    .then(applyHref)
                    .catch(() => {});
        }
    }

    updateFavicon(prefersDark ? prefersDark.matches : false);
    if (prefersDark) {
        if (typeof prefersDark.addEventListener === 'function') {
            prefersDark.addEventListener('change', updateFavicon);
        } else if (typeof prefersDark.addListener === 'function') {
            prefersDark.addListener(updateFavicon);
        }
    }

    let savedFontSize;
    try {
        savedFontSize = localStorage.getItem('fontSize');
    } catch (e) {
        console.warn('localStorage unavailable when reading fontSize:', e);
        savedFontSize = null;
    }
    if (savedFontSize) {
        document.body.style.fontSize = savedFontSize;
        const parsed = parseFloat(savedFontSize);
        if (!isNaN(parsed)) fontSize = parsed;
    }

    bindDynamicHeaderControls();

    const accessibilityButton = document.getElementById('accessibility-button');
    const increaseFontButton = document.getElementById('increase-font');
    const decreaseFontButton = document.getElementById('decrease-font');
    const resetFontButton = document.getElementById('reset-font');
    const backToTopButton = document.getElementById('back-to-top');

    function updateBackToTopVisibility() {
        if (!backToTopButton) return;
        const doc = document.documentElement;
        const hasScrollableContent = doc.scrollHeight - window.innerHeight > 4;
        const isAwayFromTop =
            (window.scrollY || doc.scrollTop || document.body.scrollTop || 0) > 120;
        const shouldShow = hasScrollableContent && isAwayFromTop;

        backToTopButton.style.display = shouldShow ? 'inline-flex' : 'none';
        backToTopButton.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }

    if (accessibilityButton) accessibilityButton.addEventListener('click', accessibilityToggle);
    if (increaseFontButton) increaseFontButton.addEventListener('click', increaseFont);
    if (decreaseFontButton) decreaseFontButton.addEventListener('click', decreaseFont);
    if (resetFontButton) resetFontButton.addEventListener('click', resetFont);
    if (backToTopButton) {
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        window.addEventListener('scroll', updateBackToTopVisibility, {
            passive: true,
        });
        window.addEventListener('resize', updateBackToTopVisibility);
        updateBackToTopVisibility();
    }

    document.addEventListener('click', (event) => {
        const accessibilityMenu = document.getElementById('accessibility-menu');
        if (accessibilityMenu && accessibilityMenu.style.display === 'flex') {
            const isClickInsideMenu = accessibilityMenu.contains(event.target);
            const isClickOnButton =
                accessibilityButton && accessibilityButton.contains(event.target);
            if (!isClickInsideMenu && !isClickOnButton) {
                accessibilityMenu.style.display = 'none';
                accessibilityMenu.setAttribute('aria-hidden', 'true');
                if (accessibilityButton) accessibilityButton.setAttribute('aria-expanded', 'false');
            }
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const menu = document.getElementById('accessibility-menu');
        if (!menu || menu.style.display !== 'flex') return;

        menu.style.display = 'none';
        menu.setAttribute('aria-hidden', 'true');
        if (accessibilityButton) {
            accessibilityButton.setAttribute('aria-expanded', 'false');
            accessibilityButton.focus();
        }
    });

    function loadDynamicContent() {
        // prevent concurrent runs which can cause duplicated sections when
        // language change fires repeatedly in quick succession.
        if (document.body.dataset.dynamicLoadRunning === 'true') {
            // queue a single delayed retry so the latest event still triggers
            if (document.body.dataset.dynamicLoadQueued !== 'true') {
                document.body.dataset.dynamicLoadQueued = 'true';
                setTimeout(() => {
                    document.body.dataset.dynamicLoadQueued = 'false';
                    loadDynamicContent();
                }, 100);
            }
            return;
        }

        // bump token for this run; any previous promises will become stale
        const myLoadId = ++_currentLoadId;
        document.body.dataset.dynamicLoadRunning = 'true';

        // Remove TODAS as secoes dinamicas antes de recriar.
        //
        // Antes existia uma lista fixa de ids ("Formations", "AboutMe") que estava
        // fora de sincronia com os ids reais criados pelos modulos ("Formation",
        // "About_Me"). Por isso, ao clicar em #languageBtn, essas secoes nao eram
        // removidas e uma copia traduzida era acrescentada abaixo do conteudo
        // existente. Agora as secoes dinamicas se identificam com
        // data-dynamic-section="true" e as secoes estaticas ficam numa lista curta.
        const staticSectionIds = new Set(['Home']);
        Array.from(document.querySelectorAll('main > section')).forEach((el) => {
            if (el.dataset.dynamicSection === 'true' || !staticSectionIds.has(el.id)) {
                el.remove();
            }
        });

        Array.from(document.querySelectorAll('.btn.prev, .btn.next')).forEach((el) => el.remove());

        let storedLang;
        try {
            storedLang = localStorage.getItem('language');
        } catch (e) {
            console.warn('localStorage unavailable when reading language:', e);
            storedLang = null;
        }
        const currentLang = (storedLang || navigator.language || 'pt-BR').toLowerCase();
        const locale = currentLang.startsWith('pt') ? 'pt-BR' : 'en-US';

        const githubOwner = document.body.dataset.githubOwner || 'JLBBARCO';
        // Always try GitHub API first; setupProjects will fallback to local JSON if API fails
        const projectsSource = 'github';
        // Ordem das áreas: Home -> Projetos -> Tecnologias -> Formação -> Sobre mim -> Rodapé
        const pProjects = setupProjects(projectsSource, locale, githubOwner, myLoadId);
        const pTechnologies = loadAllTechnologies(locale, myLoadId);
        const pFormations = setupFormations('src/json/areas/formation.json', locale, myLoadId);
        // const pCurses = curses("src/json/areas/curses.json", locale, myLoadId);
        const pAbout =
            typeof aboutMe === 'function' ? Promise.resolve(aboutMe()) : Promise.resolve();
        const pFooter =
            typeof footer === 'function'
                ? Promise.resolve(
                      footer('src/json/areas/contact.json', 'contactContainer', myLoadId),
                  )
                : Promise.resolve();
        const pHeader = header();
        const pCardProjectTranslation = translationProjects(locale);

        Promise.allSettled([
            pHeader,
            pTechnologies,
            pProjects,
            pCardProjectTranslation,
            pFormations,
            // pCurses,
            pAbout,
            pFooter,
        ])
            .then((results) => {
                const rejected = results.filter((r) => r.status === 'rejected');
                if (rejected.length) {
                    console.warn(
                        `Carregamento dinâmico concluído com ${rejected.length} falha(s).`,
                        rejected,
                    );
                }

                bindDynamicHeaderControls();

                const menuIcon = document.getElementById('menuIcon');
                if (menuIcon) {
                    menuIcon.classList.remove('fa-xmark', 'fa-close', 'fa-menu');
                    if (!menuIcon.classList.contains('fa-bars')) {
                        menuIcon.classList.add('fa-bars');
                    }
                }

                setupCarouselButtons();
                addNewIcons('src/json/svg.json');
                initializeProfileImage();
                semiHiddenCards();
                updateBackToTopVisibility();
                document.body.dataset.dynamicLoadRunning = 'false';
                // ensure queued retry runs if one was requested while running
                if (document.body.dataset.dynamicLoadQueued === 'true') {
                    // the queued timeout will call loadDynamicContent; no-op here.
                }
                window.dispatchEvent(new Event('dynamicContentReady'));
            })
            .catch((err) => console.warn('Erro no carregamento dinâmico:', err));
    }

    function setupCarouselButtons() {
        const carrosselContainer = document.querySelector('.carrousel');
        if (!carrosselContainer) return;

        const parent = carrosselContainer.parentNode;
        Array.from(parent.querySelectorAll('.btn.prev, .btn.next')).forEach((el) => el.remove());

        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn prev';
        prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
        prevBtn.setAttribute('aria-label', 'Previous projects');
        prevBtn.onclick = prevProjects;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn next';
        nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
        nextBtn.setAttribute('aria-label', 'Next projects');
        nextBtn.onclick = nextProjects;

        parent.insertBefore(prevBtn, carrosselContainer);
        parent.appendChild(nextBtn);

        carrosselContainer.addEventListener(
            'wheel',
            function (e) {
                const atStart = carrosselContainer.scrollLeft === 0;
                const atEnd =
                    carrosselContainer.scrollLeft + carrosselContainer.clientWidth >=
                    carrosselContainer.scrollWidth - 10;

                if ((!atEnd && e.deltaY > 0) || (!atStart && e.deltaY < 0)) {
                    e.preventDefault();
                    const scrollSpeed = 2;
                    carrosselContainer.scrollLeft += e.deltaY * scrollSpeed;
                }
            },
            { passive: false },
        );
    }

    loadDynamicContent();
    window.addEventListener('languageChanged', loadDynamicContent);
});

function toggleMenu() {
    const navLinks = document.querySelector('.nav-links');
    const menuIcon = document.getElementById('menuIcon');
    const menuButton = document.getElementById('menu-button');
    if (!navLinks) return;

    const isVisible = window.getComputedStyle(navLinks).display !== 'none';
    navLinks.style.display = isVisible ? 'none' : 'flex';

    if (menuIcon) {
        menuIcon.classList.toggle('fa-bars', isVisible);
        menuIcon.classList.toggle('fa-xmark', !isVisible);
    }
    if (menuButton) menuButton.setAttribute('aria-expanded', !isVisible);
}

function accessibilityToggle() {
    const menu = document.getElementById('accessibility-menu');
    const btn = document.getElementById('accessibility-button');
    if (!menu) return;

    const isVisible = menu.style.display === 'flex';
    menu.style.display = isVisible ? 'none' : 'flex';
    menu.setAttribute('aria-hidden', !isVisible);
    if (btn) {
        btn.setAttribute('aria-expanded', !isVisible);
        if (!isVisible) {
            const firstAction = menu.querySelector('button');
            (firstAction || menu).focus();
        }
    }
}

function updateFontSize(newSize) {
    fontSize = Math.max(0.6, Math.min(3.0, Math.round(newSize * 10) / 10));
    document.body.style.fontSize = fontSize + 'em';
    // persist in localStorage instead of cookie
    try {
        localStorage.setItem('fontSize', `${fontSize}em`);
    } catch (e) {
        console.warn('Unable to save fontSize:', e);
    }
}

function increaseFont() {
    updateFontSize(fontSize + 0.1);
}

function decreaseFont() {
    updateFontSize(fontSize - 0.1);
}

function resetFont() {
    updateFontSize(1);
}

function getLocalized(value, language) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return (
        value[language] ||
        value['pt-BR'] ||
        value['en-US'] ||
        value.pt ||
        value.en ||
        Object.values(value)[0] ||
        ''
    );
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Converte string de data (MM/AAAA ou AAAA) em timestamp.
 * retorna 0 se a data for inválida ou ausente, facilitando comparações
 * de ordenação.
 * @param {string} dateStr
 * @returns {number}
 */
function parseDate(dateStr) {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 2) {
        const [month, year] = parts;
        return new Date(parseInt(year, 10), parseInt(month, 10) - 1).getTime();
    } else if (parts.length === 1) {
        return new Date(parseInt(parts[0], 10), 0).getTime();
    }
    return 0;
}

function updateFilterButtons(activeFilter) {
    Array.from(document.querySelectorAll('.filter-button')).forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === activeFilter);
    });
}

function toggleShowAllButtonVisibility(sectionId, isAllFilterActive) {
    if (!sectionId) return;
    const section = document.getElementById(sectionId);
    if (!section) return;

    const button = section.querySelector('.show-all-button');
    if (!button) return;

    button.style.display = isAllFilterActive ? '' : 'none';
}

const _theSvgMarkupCache = new Map();
let _localSvgFallbackPromise = null;
let _theSvgObserver = null;

function addNewIcons(linkFile = 'src/json/svg.json') {
    const styleClasses = new Set([
        'fa-solid', 'fa-regular', 'fa-brands', 'fa-light', 'fa-thin', 'fa-duotone',
        'fa-sharp', 'fa-sharp-solid', 'fa-sharp-regular', 'fa-sharp-light',
    ]);
    const utilityClass = /^fa-(2xs|xs|sm|lg|xl|2xl|[1-9]x|10x|spin|spin-pulse|spin-reverse|beat|beat-fade|bounce|fade|flip|shake|fw|border|inverse|pull-left|pull-right|rotate-\d+|test-icon)$/;

    function getIconToken(element) {
        const explicitName = element.dataset.iconName || element.dataset.icon;
        if (explicitName) return normalizeIconToken(explicitName);
        const iconClass = Array.from(element.classList || []).find((className) =>
            className.startsWith('fa-') && !styleClasses.has(className) && !utilityClass.test(className),
        );
        return normalizeIconToken(iconClass || '');
    }

    function fetchSvg(url) {
        const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(6000)
            : undefined;
        return fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache', signal })
            .then((response) => response.ok ? response.text() : null)
            .then((markup) => markup && /<svg\b/i.test(markup) ? markup : null)
            .catch(() => null);
    }

    function loadLocalFallback() {
        if (_localSvgFallbackPromise) return _localSvgFallbackPromise;
        const fallbackPath = linkFile || 'src/json/svg.json';
        const basename = String(fallbackPath).split('/').pop();
        const absoluteUrl = /^https?:\/\//i.test(fallbackPath)
            ? fallbackPath
            : new URL(fallbackPath, document.baseURI).href;
        _localSvgFallbackPromise = fetchAny(absoluteUrl, fallbackPath, basename)
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
                const index = new Map();
                (data && Array.isArray(data.icons) ? data.icons : []).forEach((icon) => {
                    if (!icon || !icon.svg) return;
                    [icon.class, icon.name, ...(Array.isArray(icon.aliases) ? icon.aliases : [])]
                        .filter(Boolean)
                        .forEach((key) => index.set(normalizeIconToken(key), icon.svg));
                });
                return index;
            })
            .catch((error) => {
                console.warn('[icons] Não foi possível carregar src/json/svg.json:', error);
                return new Map();
            });
        return _localSvgFallbackPromise;
    }

    async function getTheSvgMarkup(token) {
        const urls = [];
        const uiSlug = _theSvgUiAliasMap[token];
        if (uiSlug) urls.push(`https://thesvg.org/ui/${encodeURIComponent(uiSlug)}/outline.svg`);

        const brandSlug = _faAliasMap[token] || token;
        [...new Set([brandSlug, token])].forEach((slug) => {
            if (!slug) return;
            urls.push(`https://thesvg.org/icons/${encodeURIComponent(slug)}/mono.svg`);
            urls.push(`https://thesvg.org/icons/${encodeURIComponent(slug)}/default.svg`);
        });

        for (const url of urls) {
            const markup = await fetchSvg(url);
            if (markup) return markup;
        }
        return null;
    }

    function uniquifySvgIds(svgElement) {
        const idMap = new Map();
        const prefix = `icon${Date.now()}_${Math.random().toString(36).slice(2, 7)}_`;
        svgElement.querySelectorAll('[id]').forEach((node) => {
            const oldId = node.getAttribute('id');
            if (!oldId) return;
            idMap.set(oldId, `${prefix}${oldId}`);
            node.setAttribute('id', `${prefix}${oldId}`);
        });
        if (!idMap.size) return;
        [svgElement, ...svgElement.querySelectorAll('*')].forEach((node) => {
            Array.from(node.attributes || []).forEach((attribute) => {
                let value = attribute.value;
                idMap.forEach((newId, oldId) => {
                    value = value.replaceAll(`url(#${oldId})`, `url(#${newId})`);
                    if (value === `#${oldId}`) value = `#${newId}`;
                });
                if (value !== attribute.value) node.setAttribute(attribute.name, value);
            });
        });
    }

    function parseMonochromeSvg(rawSvg) {
        if (!rawSvg) return null;
        const parsed = new DOMParser().parseFromString(String(rawSvg), 'image/svg+xml');
        const svg = parsed.documentElement;
        if (!svg || svg.localName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) return null;

        svg.querySelectorAll('script, foreignObject, iframe, object, embed').forEach((node) => node.remove());
        [svg, ...svg.querySelectorAll('*')].forEach((node) => {
            Array.from(node.attributes || []).forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim();
                if (name.startsWith('on')) node.removeAttribute(attribute.name);
                if ((name === 'href' || name === 'xlink:href') && value && !value.startsWith('#') && !value.startsWith('data:image/')) {
                    node.removeAttribute(attribute.name);
                }
                if (name === 'fill' && value.toLowerCase() !== 'none') node.setAttribute(attribute.name, 'currentColor');
                if ((name === 'stroke' || name === 'stop-color') && value.toLowerCase() !== 'none') node.setAttribute(attribute.name, 'currentColor');
                if (name === 'style') {
                    node.setAttribute('style', value.replace(/(fill|stroke|stop-color)\s*:\s*[^;]+/gi, '$1:currentColor'));
                }
            });
        });

        svg.setAttribute('fill', 'currentColor');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.classList.add('svg-icon');
        uniquifySvgIds(svg);
        return document.importNode(svg, true);
    }

    function resolveMarkup(token) {
        if (_theSvgMarkupCache.has(token)) return _theSvgMarkupCache.get(token);
        const promise = (async () => {
            const fromTheSvg = await getTheSvgMarkup(token);
            if (fromTheSvg) return fromTheSvg;
            const fallbackIndex = await loadLocalFallback();
            return fallbackIndex.get(token) || null;
        })();
        _theSvgMarkupCache.set(token, promise);
        return promise;
    }

    function processIcon(element) {
        if (!(element instanceof HTMLElement) || element.tagName !== 'I') return;
        const token = getIconToken(element);
        if (!token || element.dataset.svgResolvedName === token || element.dataset.svgLookupPending === token) return;
        element.dataset.svgLookupPending = token;
        resolveMarkup(token).then((markup) => {
            if (!element.isConnected || getIconToken(element) !== token) return;
            delete element.dataset.svgLookupPending;
            if (!markup) {
                element.dataset.svgLookupDone = token;
                return;
            }
            const svg = parseMonochromeSvg(markup);
            if (!svg) return;
            element.replaceChildren(svg);
            element.dataset.svgResolvedName = token;
            element.dataset.svgReplaced = 'true';
        });
    }

    function processTree(root) {
        if (!root) return;
        if (root.nodeType === Node.ELEMENT_NODE && root.matches('i')) processIcon(root);
        root.querySelectorAll && root.querySelectorAll('i').forEach(processIcon);
    }

    processTree(document.body);
    if (!_theSvgObserver && document.body) {
        _theSvgObserver = new MutationObserver((records) => {
            records.forEach((record) => {
                if (record.type === 'attributes') processIcon(record.target);
                else record.addedNodes.forEach(processTree);
            });
        });
        _theSvgObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-icon-name', 'data-icon'],
        });
    }
}

addNewIcons('src/json/svg.json');

function prevProjects() {
    // dynamically compute scroll distance based on the width of a card
    // (plus a little margin) so the carousel stays snappy on different layouts.
    const prevEl = document.getElementById('projectsContainer');
    if (prevEl) prevEl.scrollBy({ left: -300, behavior: 'smooth' });
}

function nextProjects() {
    const container = document.getElementById('projectsContainer');
    if (!container) return;
    const card = container.querySelector('.card');
    const delta = card ? card.getBoundingClientRect().width + 16 : 300;
    container.scrollBy({ left: delta, behavior: 'smooth' });
}

function getAverageColor(imgElement) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (!imgElement) {
        console.warn('Elemento de imagem não fornecido');
        return { r: 124, g: 77, b: 255 };
    }

    if (imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
        console.warn('Imagem não carregada corretamente');
        return { r: 124, g: 77, b: 255 };
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        console.warn('Contexto canvas não disponível');
        return { r: 124, g: 77, b: 255 };
    }

    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;

    try {
        context.drawImage(imgElement, 0, 0);
    } catch (e) {
        console.warn('Erro ao desenhar imagem no canvas:', e);
        return { r: 124, g: 77, b: 255 };
    }

    try {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r = 0,
            g = 0,
            b = 0;
        const totalPixels = data.length / 4;

        if (totalPixels === 0) {
            console.warn('Imagem vazia ou inválida');
            return { r: 124, g: 77, b: 255 };
        }

        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }

        percentageAddLightMode = 50;

        return {
            r: isDark
                ? Math.round(r / totalPixels)
                : Math.round(r / totalPixels + percentageAddLightMode),
            g: isDark
                ? Math.round(g / totalPixels)
                : Math.round(g / totalPixels + percentageAddLightMode),
            b: isDark
                ? Math.round(b / totalPixels)
                : Math.round(b / totalPixels + percentageAddLightMode),
        };
    } catch (e) {
        console.warn('Erro ao processar dados da imagem:', e);
        return { r: 124, g: 77, b: 255 };
    }
}

function setCSSVariables(color) {
    const root = document.documentElement;
    root.style.setProperty('--accent', `rgb(${color.r}, ${color.g}, ${color.b})`);
    root.style.setProperty(
        '--accent-transparent',
        `rgba(${color.r}, ${color.g}, ${color.b}, 0.67)`,
    );

    const hoverR = Math.max(0, color.r - 30),
        hoverG = Math.max(0, color.g - 30),
        hoverB = Math.max(0, color.b - 30);
    root.style.setProperty('--hover-accent', `rgb(${hoverR}, ${hoverG}, ${hoverB})`);
}

/**
 * Aplica o tema JA CALCULADO no servidor (snapshot.theme), que analisa a
 * imagem de perfil de hora em hora. Retorna true quando conseguiu aplicar.
 */
function applyServerTheme() {
    if (!window.SiteData || typeof window.SiteData.theme !== 'function') {
        return Promise.resolve(false);
    }

    return window.SiteData.theme()
        .then((theme) => {
            if (!theme || !theme.dark || !theme.light) return false;
            const prefersDark =
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(prefers-color-scheme: dark)').matches;
            const variant = prefersDark ? theme.dark : theme.light;
            const rgb = variant.rgb || variant;
            if (
                !Number.isFinite(Number(rgb.r)) ||
                !Number.isFinite(Number(rgb.g)) ||
                !Number.isFinite(Number(rgb.b))
            ) {
                return false;
            }
            setCSSVariables({
                r: Number(rgb.r),
                g: Number(rgb.g),
                b: Number(rgb.b),
            });
            return true;
        })
        .catch(() => false);
}

let _serverThemeWatcherBound = false;

function initializeProfileImage() {
    // Caminho principal: cor media entregue pronta pelo servidor (sem canvas,
    // sem CORS, sem custo no navegador).
    const themePromise = applyServerTheme();

    if (!_serverThemeWatcherBound && typeof window.matchMedia === 'function') {
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyServerTheme();
        if (typeof query.addEventListener === 'function') {
            query.addEventListener('change', onChange);
            _serverThemeWatcherBound = true;
        } else if (typeof query.addListener === 'function') {
            query.addListener(onChange);
            _serverThemeWatcherBound = true;
        }
    }

    const img = document.getElementById('profile');
    if (!img) return themePromise;

    // Reserva: se o servidor nao entregou o tema, calcula no canvas como antes.
    function applyAverageColorIfNeeded(appliedByServer) {
        if (appliedByServer) return;
        setCSSVariables(getAverageColor(img));
    }

    return themePromise.then((appliedByServer) => {
        if (appliedByServer) return true;
        if (img.complete && img.naturalHeight !== 0) {
            applyAverageColorIfNeeded(false);
        } else {
            img.addEventListener('load', () => applyAverageColorIfNeeded(false), {
                once: true,
            });
            img.addEventListener(
                'error',
                () => {
                    console.warn('Erro ao carregar a imagem do perfil');
                    setCSSVariables({ r: 124, g: 77, b: 255 });
                },
                { once: true },
            );
        }
        return false;
    });
}

function semiHiddenCards() {
    const containers = document.querySelectorAll('.semi-hidden');
    containers.forEach((container) => {
        const cards = Array.from(container.querySelectorAll('.card-projects, .card-formation'));
        if (!cards.length) return;

        cards.forEach((card, idx) => {
            card.style.display = idx >= 6 ? 'none' : '';
        });

        const hiddenCards = cards.filter((_, idx) => idx >= 6);
        const section = container.closest('section');
        if (!section || !hiddenCards.length) return;

        const existingBtn = section.querySelector('.show-all-button');
        if (existingBtn) existingBtn.remove();

        let currentLang = 'en-us';
        try {
            currentLang = localStorage.getItem('language') || 'en-us';
        } catch (e) {
            currentLang = 'en-us';
        }

        const showAllButton = document.createElement('button');
        showAllButton.className = 'filter-button show-all-button';
        showAllButton.textContent = currentLang.startsWith('pt') ? 'Mostrar todos' : 'Show all';
        showAllButton.dataset.filter = 'show-all';
        showAllButton.addEventListener('click', () => {
            hiddenCards.forEach((card) => {
                card.style.display = '';
            });
            showAllButton.remove();
        });

        section.appendChild(showAllButton);

        const activeFilterButton = section.querySelector('.filter-container .filter-button.active');
        const isAllFilterActive =
            !activeFilterButton || activeFilterButton.dataset.filter === 'all';
        toggleShowAllButtonVisibility(section.id, isAllFilterActive);
    });
}

function _preloadLinks(list) {
    if (!Array.isArray(list)) return;
    list.forEach((url) => {
        if (!url || typeof url !== 'string') return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        link.as = 'image';
        document.head.appendChild(link);
    });
}

function _preconnectLinks(list) {
    if (!Array.isArray(list)) return;
    list.forEach((url) => {
        if (!url || typeof url !== 'string') return;
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = url;
        document.head.appendChild(link);
    });
}
