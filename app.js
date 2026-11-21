const current = location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".innerNav a"). forEach(link => {
    if (link.getAttribute("href") === current) {
        link.classList.add("active");
    }
});

/* =====================================================
   LIGHT FM - SITE SCRIPT
   Paste this at the END of app.js.
   (If you pasted player.js or page-features.js there before, delete those
   two blocks first. This file replaces both.)

   What it does
   1. One live player that never stops while visitors move around the site
   2. A floating player bar at the bottom of every page
   3. Page swapping: links load the next page without a full reload,
      so the music keeps playing
   4. Page features: nav highlight, Shows tabs + on-air-now, News filters
   ===================================================== */
(function () {
    'use strict';

    if (window.lightFMBooted) { return; }
    window.lightFMBooted = true;

    /* =====================================================
       SETTINGS
       ===================================================== */

    // Your station's stream link (Icecast / Shoutcast / similar).
    // The default below is a public test stream, for development only.
    var STREAM_URL = window.LIGHTFM_STREAM_URL || 'https://stream.radioparadise.com/mp3-128';

    var STATION_NAME = 'Light FM';

    // Shown in the player bar until the backend can supply the real song.
    var NOW_PLAYING = { title: 'Golden Hour', artist: 'Jasmine Rae' };

    // The station's own clock. "On air now" follows this, not the visitor's clock.
    var STATION_TIMEZONE = 'Africa/Lagos';

    // true  = links swap pages without reloading (music keeps playing)
    // false = normal page loads (music stops on every link)
    var PAGE_SWAP = true;

    /* ===================================================== */

    var KEY_VOLUME = 'lightfm.volume';
    var KEY_MUTED = 'lightfm.muted';

    var TEXT = {
        idle:    { status: 'Ready to play',                          label: 'Listen live',         sub: 'One tap. You’re in.' },
        loading: { status: 'Connecting…',                       label: 'Connecting…',    sub: 'One moment' },
        playing: { status: 'Live now',                              label: 'You’re live',    sub: 'Tap to pause' },
        error:   { status: 'Stream unavailable. Press play to retry.', label: 'Couldn’t connect', sub: 'Tap to try again' }
    };

    var WAVE = [8, 14, 24, 12, 30, 18, 36, 22, 12, 28, 16, 34, 20, 10, 26, 38, 14, 22, 30, 12, 24, 34, 16, 28, 10, 32, 18, 26];

    var doc = document;

    function qa(selector, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(selector)); }
    function q(selector, root) { return (root || doc).querySelector(selector); }

    function make(tag, className, text) {
        var node = doc.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function readStore(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function writeStore(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* storage blocked: ignore */ }
    }


    /* =====================================================
       1. THE PLAYER (one audio, many controls)
       ===================================================== */

    var audio = new Audio();
    audio.preload = 'none';

    var state = 'idle';

    var ICON = {
        play:  '<svg class="lfmIconPlay" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
        pause: '<svg class="lfmIconPause" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
        vol:   '<svg class="lfmIconVol" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor"/></svg>',
        muted: '<svg class="lfmIconMuted" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3zm13.6 2 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z" fill="currentColor"/></svg>'
    };

    // the floating bar: built once, never removed
    var bar = make('div', 'lfmPlayer');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', STATION_NAME + ' live player');
    bar.innerHTML =
        '<button type="button" class="lfmPlay" data-lfm-toggle aria-label="Play live radio">' + ICON.play + ICON.pause + '</button>' +
        '<div class="lfmMeta">' +
            '<div class="lfmTop">' +
                '<span class="lfmLive"><i></i>LIVE</span>' +
                '<span class="lfmStatus" role="status" aria-live="polite" data-lfm-status></span>' +
            '</div>' +
            '<div class="lfmTrack"><strong data-lfm-title></strong><span class="lfmArtist"> — <span data-lfm-artist></span></span></div>' +
        '</div>' +
        '<div class="lfmWave" data-lfm-wave aria-hidden="true"></div>' +
        '<div class="lfmVolume">' +
            '<button type="button" class="lfmMute" aria-label="Mute">' + ICON.vol + ICON.muted + '</button>' +
            '<input type="range" class="lfmVol" min="0" max="100" step="1" aria-label="Volume">' +
        '</div>';

    doc.body.appendChild(bar);
    doc.body.classList.add('hasLfmPlayer');

    var muteBtn = q('.lfmMute', bar);
    var volInput = q('.lfmVol', bar);
    var barPlay = q('.lfmPlay', bar);

    // fill any waveform placeholder with bars
    function fillWaves() {
        qa('[data-lfm-wave]').forEach(function (wave) {
            if (wave.getAttribute('data-filled')) { return; }
            var count = Number(wave.getAttribute('data-bars')) || WAVE.length;
            for (var i = 0; i < count; i++) {
                var barEl = make('i');
                barEl.style.setProperty('--h', WAVE[i % WAVE.length] + 'px');
                barEl.style.animationDelay = ((i % 7) * 0.12) + 's';
                barEl.style.animationDuration = (0.8 + (i % 5) * 0.15) + 's';
                wave.appendChild(barEl);
            }
            wave.setAttribute('data-filled', '1');
        });
    }

    // update every control and label on the page to match the player
    function render() {
        var text = TEXT[state];
        var active = state === 'playing' || state === 'loading';

        doc.documentElement.setAttribute('data-lfm-state', state);

        qa('[data-lfm-status]').forEach(function (el) { el.textContent = text.status; });
        qa('[data-lfm-label]').forEach(function (el) { el.textContent = text.label; });
        qa('[data-lfm-sub]').forEach(function (el) { el.textContent = text.sub; });
        qa('[data-lfm-title]').forEach(function (el) { el.textContent = NOW_PLAYING.title; });
        qa('[data-lfm-artist]').forEach(function (el) { el.textContent = NOW_PLAYING.artist; });

        qa('[data-lfm-toggle]').forEach(function (el) {
            if (el === barPlay) {
                el.setAttribute('aria-label', active ? 'Stop live radio' : 'Play live radio');
            } else {
                el.setAttribute('aria-pressed', active ? 'true' : 'false');
            }
        });

        // the "listen live" button in the nav keeps its own wording
        qa('.liveBtn').forEach(function (btn) {
            if (!btn.hasAttribute('data-label')) { btn.setAttribute('data-label', btn.innerHTML); }
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            if (state === 'playing') { btn.innerHTML = '&#10074;&#10074;&nbsp; pause'; }
            else if (state === 'loading') { btn.innerHTML = 'connecting…'; }
            else { btn.innerHTML = btn.getAttribute('data-label'); }
        });

        if ('mediaSession' in navigator) {
            try { navigator.mediaSession.playbackState = state === 'playing' ? 'playing' : 'paused'; } catch (e) { /* ignore */ }
        }
    }

    function setState(next) {
        state = next;
        render();
    }

    function start(isAutoStart) {
        setState('loading');
        audio.src = STREAM_URL;
        var attempt = audio.play();
        if (attempt && attempt.catch) {
            attempt.catch(function (err) {
                if (err && err.name === 'AbortError') { return; }             // we stopped it ourselves
                if (isAutoStart && err && err.name === 'NotAllowedError') {   // browser blocked auto-start
                    audio.removeAttribute('src');
                    audio.load();
                    setState('idle');
                    return;
                }
                setState('error');
            });
        }
    }

    function stop() {
        audio.pause();
        // drop the connection so "play" always rejoins the live broadcast
        audio.removeAttribute('src');
        audio.load();
        setState('idle');
    }

    function toggle() {
        if (state === 'playing' || state === 'loading') { stop(); }
        else { start(false); }
    }

    audio.addEventListener('playing', function () { setState('playing'); });
    audio.addEventListener('waiting', function () {
        if (audio.getAttribute('src') && state === 'playing') { setState('loading'); }
    });
    audio.addEventListener('stalled', function () {
        if (audio.getAttribute('src') && state === 'playing') { setState('loading'); }
    });
    audio.addEventListener('error', function () {
        if (audio.getAttribute('src')) { setState('error'); }
    });
    audio.addEventListener('ended', function () {
        if (audio.getAttribute('src')) { setState('error'); }
    });

    // any play button anywhere: the bar, the hero button, the nav "listen live"
    doc.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target.closest('[data-lfm-toggle], .liveBtn') : null;
        if (!target) { return; }
        event.preventDefault();
        toggle();
    });

    // volume and mute
    function syncVolumeUi() {
        var silent = audio.muted || audio.volume === 0;
        bar.classList.toggle('lfmSilent', silent);
        muteBtn.setAttribute('aria-label', silent ? 'Unmute' : 'Mute');
        volInput.value = audio.muted ? 0 : Math.round(audio.volume * 100);
    }

    var savedVolume = parseFloat(readStore(KEY_VOLUME));
    audio.volume = isNaN(savedVolume) ? 0.8 : Math.min(1, Math.max(0, savedVolume));
    audio.muted = readStore(KEY_MUTED) === '1';
    syncVolumeUi();

    volInput.addEventListener('input', function () {
        var level = Number(volInput.value) / 100;
        audio.volume = level;
        audio.muted = level === 0;
        if (level > 0) { writeStore(KEY_VOLUME, String(level)); }
        writeStore(KEY_MUTED, audio.muted ? '1' : '0');
        syncVolumeUi();
    });

    muteBtn.addEventListener('click', function () {
        if (audio.muted || audio.volume === 0) {
            audio.muted = false;
            if (audio.volume === 0) { audio.volume = 0.8; }
        } else {
            audio.muted = true;
        }
        writeStore(KEY_MUTED, audio.muted ? '1' : '0');
        writeStore(KEY_VOLUME, String(audio.volume));
        syncVolumeUi();
    });

    // lock-screen / headset controls
    if ('mediaSession' in navigator && window.MediaMetadata) {
        try {
            navigator.mediaSession.metadata = new MediaMetadata({ title: NOW_PLAYING.title, artist: NOW_PLAYING.artist, album: STATION_NAME });
            navigator.mediaSession.setActionHandler('play', function () { if (state === 'idle' || state === 'error') { start(false); } });
            navigator.mediaSession.setActionHandler('pause', stop);
            navigator.mediaSession.setActionHandler('stop', stop);
        } catch (e) { /* some browsers do not support every action */ }
    }

    window.lightFMPlayer = {
        play: function () { if (state === 'idle' || state === 'error') { start(false); } },
        stop: stop,
        toggle: toggle,
        getState: function () { return state; },
        audio: audio
    };


    /* =====================================================
       2. PAGE FEATURES (re-run every time a page is swapped in)
       ===================================================== */

    var cleanups = [];

    function runCleanups() {
        cleanups.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
        cleanups = [];
    }

    /* ----- nav: highlight the current page ----- */
    function pageNav() {
        function pageName(path) {
            var name = (path || '').split('#')[0].split('?')[0].split('/').pop().toLowerCase();
            name = name.replace(/\.html?$/, '');
            return name === '' ? 'index' : name;
        }
        var current = pageName(window.location.pathname);
        qa('.innerNav a').forEach(function (link) {
            var href = link.getAttribute('href');
            if (href && pageName(href) === current) { link.setAttribute('aria-current', 'page'); }
            else { link.removeAttribute('aria-current'); }
        });
    }

    /* ----- Shows page: day tabs + on-air-now ----- */
    function pageShows() {
        var tablist = q('.daysList');
        var wrapper = q('.showWrapper');
        if (!tablist || !wrapper) { return; }

        var tabs = qa('.days', tablist);
        if (tabs.length !== 7) { return; }

        // Each show starts at its time and runs until the next one starts.
        // The last show of the day runs until the first show of the next day.
        var WEEKDAY = [
            { time: '06:00', title: 'The Morning Show', host: 'Maya Bennett', about: 'The best songs, stories and listener moments' },
            { time: '10:00', title: 'Easy Mornings',    host: 'Chris Adams',  about: 'The best songs, stories and listener moments' },
            { time: '13:00', title: 'The Midday Mix',   host: 'Sophie King',  about: 'The best songs, stories and listener moments' },
            { time: '16:00', title: 'Drive Home',       host: 'Daniel Reed',  about: 'The best songs, stories and listener moments' },
            { time: '20:00', title: 'After Dark',       host: 'Alex Morgan',  about: 'The best songs, stories and listener moments' }
        ];

        // Give any day its own lineup by replacing WEEKDAY with a list like the one above.
        // Saturday and Sunday use the weekday lineup until the weekend shows are added.
        var SCHEDULE = { mon: WEEKDAY, tue: WEEKDAY, wed: WEEKDAY, thu: WEEKDAY, fri: WEEKDAY, sat: WEEKDAY, sun: WEEKDAY };

        var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        var firstImage = q('.hostSec img', wrapper);
        var defaultImage = firstImage ? firstImage.getAttribute('src') : '';

        function toMinutes(time) {
            var parts = time.split(':');
            return Number(parts[0]) * 60 + Number(parts[1]);
        }

        function prettyTime(time) {
            var parts = time.split(':');
            return Number(parts[0]) + ':' + parts[1];
        }

        function stationNow() {
            try {
                var parts = new Intl.DateTimeFormat('en-GB', {
                    timeZone: STATION_TIMEZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
                }).formatToParts(new Date());
                var out = {};
                for (var i = 0; i < parts.length; i++) { out[parts[i].type] = parts[i].value; }
                return { day: out.weekday.toLowerCase().slice(0, 3), minutes: Number(out.hour) * 60 + Number(out.minute) };
            } catch (e) {
                var d = new Date();   // older browsers: fall back to the visitor's own clock
                return { day: DAYS[(d.getDay() + 6) % 7], minutes: d.getHours() * 60 + d.getMinutes() };
            }
        }

        function findOnAir() {
            var now = stationNow();
            var day = now.day;
            var list = SCHEDULE[day];
            if (now.minutes < toMinutes(list[0].time)) {
                // before today's first show: last night's final show is still running
                day = DAYS[(DAYS.indexOf(day) + 6) % 7];
                return { day: day, index: SCHEDULE[day].length - 1 };
            }
            var index = 0;
            for (var i = 0; i < list.length; i++) {
                if (toMinutes(list[i].time) <= now.minutes) { index = i; }
            }
            return { day: day, index: index };
        }

        function durationLabel(list, i) {
            var start = toMinutes(list[i].time);
            var end = i + 1 < list.length ? toMinutes(list[i + 1].time) : toMinutes(list[0].time) + 24 * 60;
            var hours = Math.round(((end - start) / 60) * 10) / 10;
            return hours + (hours === 1 ? ' hr' : ' hrs');
        }

        function buildCard(show, status, duration) {
            var isLive = status === 'live';
            var card = make('div', isLive ? 'showListCard1' : 'showListCard');

            var time = make('div', 'timeSec');
            time.appendChild(make('h3', '', prettyTime(show.time)));
            time.appendChild(make('p', '', isLive ? 'Now' : status === 'next' ? 'Up next' : duration));

            var host = make('div', 'hostSec');
            var img = doc.createElement('img');
            img.src = show.img || defaultImage;
            img.alt = show.host;
            host.appendChild(img);

            var about = make('div', 'showAbout');
            about.appendChild(make('h4', '', show.title));
            if (isLive) {
                var badge = make('div', 'liveUp');
                badge.appendChild(make('p', '', '• LIVE'));
                about.appendChild(badge);
            }
            about.appendChild(make('p', '', 'with ' + show.host + ' · ' + show.about));

            var play = make('button', 'playBtn', '▶');
            play.type = 'button';
            if (isLive) {
                // the live show's button joins the broadcast (handled by the player)
                play.setAttribute('data-lfm-toggle', '');
                play.setAttribute('aria-label', 'Listen live to ' + show.title);
            } else {
                play.disabled = true;
                play.setAttribute('aria-label', show.title + ' starts at ' + prettyTime(show.time));
                play.title = 'Starts at ' + prettyTime(show.time);
            }

            card.appendChild(time);
            card.appendChild(host);
            card.appendChild(about);
            card.appendChild(play);
            return card;
        }

        var panel = make('div', 'showCards');
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-label', 'Show schedule');

        var currentDay = null;

        function render() {
            var list = SCHEDULE[currentDay];
            var live = findOnAir();
            var today = stationNow().day;

            panel.innerHTML = '';
            for (var i = 0; i < list.length; i++) {
                var status = 'later';
                if (live.day === currentDay) {
                    if (i === live.index) { status = 'live'; }
                    else if (i === live.index + 1) { status = 'next'; }
                    else if (i < live.index) { status = 'earlier'; }
                } else if (today === currentDay && i === 0) {
                    status = 'next';   // before the first show of today
                }
                panel.appendChild(buildCard(list[i], status, durationLabel(list, i)));
            }
        }

        function select(dayKey, moveFocus) {
            currentDay = dayKey;
            for (var i = 0; i < tabs.length; i++) {
                var active = DAYS[i] === dayKey;
                tabs[i].classList.toggle('isActive', active);
                tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
                tabs[i].setAttribute('tabindex', active ? '0' : '-1');
                if (active && moveFocus) { tabs[i].focus(); }
            }
            render();
        }

        function markToday() {
            var today = stationNow().day;
            for (var i = 0; i < tabs.length; i++) { tabs[i].classList.toggle('isToday', DAYS[i] === today); }
        }

        tablist.setAttribute('role', 'tablist');
        tablist.setAttribute('aria-label', 'Day of the week');

        tabs.forEach(function (tab, index) {
            tab.setAttribute('role', 'tab');
            tab.addEventListener('click', function () { select(DAYS[index], false); });
            tab.addEventListener('keydown', function (event) {
                var next = null;
                if (event.key === 'ArrowRight') { next = (index + 1) % 7; }
                else if (event.key === 'ArrowLeft') { next = (index + 6) % 7; }
                else if (event.key === 'Home') { next = 0; }
                else if (event.key === 'End') { next = 6; }
                else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(DAYS[index], false); return; }
                if (next !== null) { event.preventDefault(); select(DAYS[next], true); }
            });
        });

        // swap the hand-written cards for the live ones
        var oldCards = Array.prototype.filter.call(wrapper.children, function (child) {
            return child.className === 'showListCard' || child.className === 'showListCard1';
        });

        markToday();
        select(findOnAir().day, false);
        wrapper.appendChild(panel);
        oldCards.forEach(function (card) { wrapper.removeChild(card); });

        // keep "on air" accurate while the page stays open
        var lastKey = '';
        function tick() {
            var live = findOnAir();
            var key = live.day + live.index + '|' + stationNow().day;
            if (lastKey !== '' && key !== lastKey) { markToday(); render(); }
            lastKey = key;
        }
        tick();
        var timer = setInterval(tick, 30000);
        cleanups.push(function () { clearInterval(timer); });

        render();
        fillWaves();
        window.lightFMPlayerRefresh && window.lightFMPlayerRefresh();
    }

    /* ----- News page: category filters ----- */
    function pageNews() {
        var chips = qa('.newsCatWrapper button');
        var cards = qa('.newsCard');
        var grid = q('.newsWrapper');
        if (!chips.length || !cards.length || !grid) { return; }

        var empty = doc.createElement('p');
        empty.setAttribute('role', 'status');
        empty.hidden = true;
        empty.textContent = 'No stories in this category yet.';
        empty.style.gridColumn = '1 / -1';
        empty.style.color = 'rgba(0, 0, 0, 0.671)';
        grid.appendChild(empty);

        function categoryOf(card) {
            var label = q('.categry h6', card);
            return label ? label.textContent.trim().toLowerCase() : '';
        }

        function filterBy(chip) {
            var wanted = chip.textContent.trim().toLowerCase();
            var shown = 0;
            chips.forEach(function (c) {
                var isActive = c === chip;
                c.className = isActive ? 'newsCat1' : 'newsCat';
                c.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            cards.forEach(function (card) {
                var match = wanted === 'all' || categoryOf(card) === wanted;
                card.hidden = !match;
                if (match) { shown++; }
            });
            empty.hidden = shown !== 0;
        }

        chips.forEach(function (chip) {
            chip.setAttribute('type', 'button');
            chip.setAttribute('aria-pressed', chip.className === 'newsCat1' ? 'true' : 'false');
            chip.addEventListener('click', function () { filterBy(chip); });
        });
    }

    /* ----- Live page: play control inside the "Now Playing" card ----- */
    function pageLive() {
        var card = q('.nowPlayingCard');
        if (!card || q('.cardPlayer', card)) { return; }

        var row = make('div', 'cardPlayer');
        row.innerHTML =
            '<button type="button" class="cardPlay" data-lfm-toggle aria-label="Play live radio">' + ICON.play + ICON.pause + '</button>' +
            '<div class="cardText">' +
                '<span class="cardStatus" role="status" aria-live="polite" data-lfm-status></span>' +
                '<span class="cardSub">' + STATION_NAME + ' &middot; live stream</span>' +
            '</div>' +
            '<span class="cardLive">&bull; LIVE</span>';

        var upNext = q('.upNext', card);
        if (upNext) { card.insertBefore(row, upNext); }
        else { card.appendChild(row); }
    }

    function initPage() {
        pageNav();
        pageShows();
        pageNews();
        pageLive();
        fillWaves();
        render();
    }


    /* =====================================================
       3. PAGE SWAPPING (keeps the music playing between pages)
       ===================================================== */

    var navToken = 0;

    function isSwappable(link) {
        if (!PAGE_SWAP || window.location.protocol === 'file:') { return false; }
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) === '#') { return false; }
        if (link.target && link.target !== '_self') { return false; }
        if (link.hasAttribute('download')) { return false; }
        if (link.origin !== window.location.origin) { return false; }
        if (!/(\.html?|\/)$/i.test(link.pathname)) { return false; }
        // a link to a spot on the page you are already on: let the browser scroll
        if (link.pathname === window.location.pathname && link.search === window.location.search && link.hash) { return false; }
        return true;
    }

    // load any stylesheets the next page needs that we do not have yet
    function loadStyles(newDoc, baseUrl) {
        var have = qa('link[rel="stylesheet"]').map(function (l) { return l.href; });
        var wanted = [];
        var waits = [];

        qa('link[rel="stylesheet"]', newDoc).forEach(function (l) {
            var href = new URL(l.getAttribute('href'), baseUrl).href;
            wanted.push(href);
            if (have.indexOf(href) !== -1) { return; }
            var link = doc.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            waits.push(new Promise(function (resolve) {
                link.onload = resolve;
                link.onerror = resolve;
                setTimeout(resolve, 4000);
            }));
            doc.head.appendChild(link);
        });

        return { wanted: wanted, ready: Promise.all(waits) };
    }

    function swapIn(newDoc, url, push, styles) {
        runCleanups();

        // drop the old page (the player bar and scripts stay)
        qa('body > *').forEach(function (node) {
            if (node === bar || node.tagName === 'SCRIPT') { return; }
            node.parentNode.removeChild(node);
        });

        // bring in the new page
        Array.prototype.slice.call(newDoc.body.children).forEach(function (node) {
            if (node.tagName === 'SCRIPT') { return; }
            doc.body.insertBefore(doc.importNode(node, true), bar);
        });

        // drop stylesheets the new page does not use
        qa('link[rel="stylesheet"]').forEach(function (link) {
            if (styles.wanted.indexOf(link.href) === -1) { link.parentNode.removeChild(link); }
        });

        doc.title = newDoc.title || doc.title;
        if (push) { window.history.pushState({}, '', url); }

        initPage();

        var target = window.location.hash ? q(window.location.hash) : null;
        if (target && target.scrollIntoView) { target.scrollIntoView(); }
        else { window.scrollTo(0, 0); }

        var main = q('main');
        if (main) {
            main.setAttribute('tabindex', '-1');
            main.focus({ preventScroll: true });
        }

        if (window.location.hash === '#play' && (state === 'idle' || state === 'error')) { start(true); }
    }

    function go(url, push) {
        var token = ++navToken;

        fetch(url, { credentials: 'same-origin' })
            .then(function (response) {
                var type = response.headers.get('content-type') || '';
                if (!response.ok || type.indexOf('text/html') === -1) { throw new Error('not a page'); }
                return response.text();
            })
            .then(function (html) {
                if (token !== navToken) { return; }
                var newDoc = new DOMParser().parseFromString(html, 'text/html');
                if (!newDoc.body || !q('main, nav', newDoc)) { throw new Error('not a site page'); }
                var styles = loadStyles(newDoc, url);
                return styles.ready.then(function () {
                    if (token !== navToken) { return; }
                    swapIn(newDoc, url, push, styles);
                });
            })
            .catch(function () {
                if (token === navToken) { window.location.href = url; }   // anything odd: plain page load
            });
    }

    doc.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0) { return; }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) { return; }
        var link = event.target && event.target.closest ? event.target.closest('a') : null;
        if (!link || !isSwappable(link)) { return; }
        event.preventDefault();
        go(link.href, true);
    });

    window.addEventListener('popstate', function () {
        if (PAGE_SWAP && window.location.protocol !== 'file:') { go(window.location.href, false); }
    });


    /* =====================================================
       START
       ===================================================== */

    initPage();

    // arrived with #play on the address (a "listen live" link): try to start now.
    // Browsers may block this; then the player just waits for a press on play.
    if (window.location.hash === '#play') { start(true); }
})();
