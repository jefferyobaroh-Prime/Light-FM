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

    // Station details used around the site. Change them here when the final
    // name, frequency and address are confirmed.
    var STATION_BLURB = 'The Voice of Sapele. News, music and community talk, live online.';
    var STATION_ADDRESS = 'c/o Mimshach Chambers, 53 Sapele-Warri Road, Ajogodo, Sapele, Delta State';

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
       SCHEDULE (from the business plan, Section 12)
       Used by the Shows page, the player bar and the Live page.
       ===================================================== */

    // ----- THE SCHEDULE (from the business plan, Section 12) -----
    // start / end are 24-hour times. "00:00" as an end means midnight.
    // Add  host: 'Name'  to any show once presenters are confirmed.
    // Anything between shows, or overnight, shows as "off air".
    var WEEKDAY = [
        { start: '05:00', end: '06:00', title: 'Sunrise This Side of Delta',   about: 'Inspirational messages, headlines, weather, traffic and community announcements' },
        { start: '06:00', end: '10:00', title: 'Morning Pulse',               about: 'News, current affairs, music, comedy, discussions, interviews and phone-ins' },
        { start: '10:00', end: '12:00', title: 'The Business of Business',    about: 'Business, SME promotion and market information' },
        { start: '12:00', end: '13:00', title: 'Midday News & Community Report', about: 'Local, state and national news summary' },
        { start: '13:00', end: '15:00', title: 'Afternoon Groove',            about: 'Music, dedications and listener interaction' },
        { start: '15:00', end: '17:00', title: 'Community Voice',             about: 'Community issues, local politics, phone-ins and public engagement' },
        { start: '17:00', end: '19:00', title: 'Drive Time Sapele',           about: 'Traffic, entertainment, sports and discussions' },
        { start: '19:00', end: '20:00', title: 'The People’s Forum',     about: 'Current affairs and social issues' },
        { start: '20:00', end: '22:00', title: 'Naija Delta Spotlight',       about: 'Night Vibes: edutainment, lifestyle and youth discussions' },
        { start: '22:00', end: '00:00', title: 'Classic & Chill',             about: 'Old-school music and relaxation' }
    ];

    var SATURDAY = [
        { start: '06:00', end: '09:00', title: 'Sapele Weekend Wake-Up',       about: 'Community announcements, events and interviews' },
        { start: '09:00', end: '12:00', title: 'Our Markets & Business Show',  about: 'Entrepreneurs and advertising opportunities' },
        { start: '12:00', end: '15:00', title: 'Naija Entertainment Zone',     about: 'Music countdown and entertainment news' },
        { start: '16:00', end: '19:00', title: 'Sports Arena',                 about: 'Football analysis, local sports and fan discussions' },
        { start: '20:00', end: '00:00', title: 'Weekend Party Zone',           about: 'DJ mixes and events promotion' }
    ];

    var SUNDAY = [
        { start: '06:00', end: '10:00', title: 'Faith & Inspiration',  about: 'Religious and inspirational programming' },
        { start: '10:00', end: '12:00', title: 'Community Voices',     about: 'NGOs, development issues and social conversations' },
        { start: '12:00', end: '15:00', title: 'Family & Culture',     about: 'Family, traditions, relationships and local stories' },
        { start: '16:00', end: '19:00', title: 'Youth Corner',         about: 'Education, careers, skills and technology' },
        { start: '19:00', end: '21:00', title: 'The Churches Today',   about: 'News and stories from the churches' },
        { start: '21:00', end: '00:00', title: 'Week in Retrospect',   about: 'News, phone-ins, the week in review and a look ahead to the new work week' }
    ];

    var SCHEDULE = { mon: WEEKDAY, tue: WEEKDAY, wed: WEEKDAY, thu: WEEKDAY, fri: WEEKDAY, sat: SATURDAY, sun: SUNDAY };

    var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    var DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

    function toMinutes(time) {
        var parts = time.split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
    }

    function endMinutes(show) {
        var end = toMinutes(show.end);
        return end <= toMinutes(show.start) ? end + 24 * 60 : end;
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

    // what is on air now (null when off air), and what comes next
    function findState() {
        var now = stationNow();
        var list = SCHEDULE[now.day];
        var live = null;
        var next = null;

        for (var i = 0; i < list.length; i++) {
            if (toMinutes(list[i].start) <= now.minutes && now.minutes < endMinutes(list[i])) { live = { day: now.day, index: i }; }
            else if (!next && toMinutes(list[i].start) > now.minutes) { next = { day: now.day, index: i }; }
        }

        if (!next) {
            var tomorrow = DAYS[(DAYS.indexOf(now.day) + 1) % 7];
            next = { day: tomorrow, index: 0 };
        }
        return { live: live, next: next, today: now.day };
    }

    function durationLabel(show) {
        var hours = Math.round(((endMinutes(show) - toMinutes(show.start)) / 60) * 10) / 10;
        return hours + (hours === 1 ? ' hr' : ' hrs');
    }


    // what the station is doing right now, in words, for the players
    function onAirNow() {
        var st = findState();
        if (st.live) {
            var show = SCHEDULE[st.live.day][st.live.index];
            return { live: true, title: show.title, sub: show.host || STATION_NAME, show: show, next: st.next };
        }
        var nextShow = SCHEDULE[st.next.day][st.next.index];
        return { live: false, title: STATION_NAME, sub: 'Next: ' + nextShow.title + ' at ' + prettyTime(nextShow.start), show: null, next: st.next };
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
        var now = onAirNow();
        qa('[data-lfm-title]').forEach(function (el) { el.textContent = now.title; });
        qa('[data-lfm-artist]').forEach(function (el) { el.textContent = now.sub; });
        qa('[data-lfm-airlabel]').forEach(function (el) { el.textContent = now.live ? 'ON AIR NOW' : 'OFF AIR'; });
        updateLivePage(now);

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

        if ('mediaSession' in navigator && window.MediaMetadata) {
            try { navigator.mediaSession.metadata = new MediaMetadata({ title: now.title, artist: now.sub, album: STATION_NAME }); } catch (e) { /* ignore */ }
        }

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

        var firstImage = q('.hostSec img', wrapper);
        var defaultImage = firstImage ? firstImage.getAttribute('src') : '';

        function buildCard(show, status) {
            var isLive = status === 'live';
            var card = make('div', isLive ? 'showListCard1' : 'showListCard');

            var time = make('div', 'timeSec');
            time.appendChild(make('h3', '', prettyTime(show.start)));
            time.appendChild(make('p', '', isLive ? 'Now' : status === 'next' ? 'Up next' : durationLabel(show)));

            var host = make('div', 'hostSec');
            var img = doc.createElement('img');
            img.src = show.img || defaultImage;
            img.alt = show.host || show.title;
            host.appendChild(img);

            var about = make('div', 'showAbout');
            about.appendChild(make('h4', '', show.title));
            if (isLive) {
                var badge = make('div', 'liveUp');
                badge.appendChild(make('p', '', '• LIVE'));
                about.appendChild(badge);
            }
            about.appendChild(make('p', '', (show.host ? 'with ' + show.host + ' · ' : '') + show.about));

            var play = make('button', 'playBtn', '▶');
            play.type = 'button';
            if (isLive) {
                play.setAttribute('data-lfm-toggle', '');
                play.setAttribute('aria-label', 'Listen live to ' + show.title);
            } else {
                play.disabled = true;
                play.setAttribute('aria-label', show.title + ' starts at ' + prettyTime(show.start));
                play.title = 'Starts at ' + prettyTime(show.start);
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
            var state = findState();

            panel.innerHTML = '';

            // nothing on air right now: say so, and say what is next
            if (!state.live && currentDay === state.today) {
                var nextShow = SCHEDULE[state.next.day][state.next.index];
                var when = state.next.day === state.today ? 'at ' + prettyTime(nextShow.start) : DAY_NAMES[state.next.day] + ' at ' + prettyTime(nextShow.start);
                panel.appendChild(make('p', 'showNote', 'Nothing on air right now. Next up: ' + nextShow.title + ' ' + when + '.'));
            }

            for (var i = 0; i < list.length; i++) {
                var status = 'later';
                if (state.live && state.live.day === currentDay && state.live.index === i) { status = 'live'; }
                else if (state.next.day === currentDay && state.next.index === i) { status = 'next'; }
                panel.appendChild(buildCard(list[i], status));
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
        select(stationNow().day, false);
        wrapper.appendChild(panel);
        oldCards.forEach(function (card) { wrapper.removeChild(card); });

        // keep "on air" accurate while the page stays open
        var lastKey = '';
        function tick() {
            var st = findState();
            var key = (st.live ? st.live.day + st.live.index : 'off') + '|' + st.today;
            if (lastKey !== '' && key !== lastKey) { markToday(); render(); }
            lastKey = key;
        }
        tick();
        var timer = setInterval(tick, 30000);
        cleanups.push(function () { clearInterval(timer); });

        render();
        fillWaves();
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

    // fill the Live page's "Now Playing" card and the list under it from the schedule
    function updateLivePage(now) {
        var card = q('.nowPlayingCard');
        if (!card) { return; }

        var label = q('h4', card);
        var title = q('h1', card);
        var line = q('p', card);
        if (label) { label.textContent = now.live ? 'ON AIR NOW' : 'OFF AIR'; }
        if (title) { title.textContent = now.title; }
        if (line) { line.textContent = now.live ? (now.show.host ? 'with ' + now.show.host + ' \u00b7 ' : '') + now.show.about : now.sub; }

        // up next
        var nextShow = SCHEDULE[now.next.day][now.next.index];
        var nextRow = q('.upNext .next', card);
        if (nextRow) {
            var ps = qa('p', nextRow);
            if (ps[0]) {
                var span = doc.createElement('span');
                span.setAttribute('style', 'color: #0a1f44; font-weight: 600;');
                span.textContent = nextShow.title;
                ps[0].textContent = '';
                ps[0].appendChild(span);
                ps[0].appendChild(doc.createTextNode(' \u2014 ' + nextShow.about));
            }
            if (ps[1]) { ps[1].textContent = prettyTime(nextShow.start); }
        }

        // "Just played" becomes today's shows (earlier, or coming up if none yet)
        var section = q('.justPlayedSec');
        if (!section) { return; }
        var cards = qa('.justPlayedCard', section);
        var st = findState();
        var nowMin = stationNow().minutes;
        var today = SCHEDULE[st.today];
        var done = today.filter(function (sh) { return endMinutes(sh) <= nowMin; }).reverse().slice(0, cards.length);
        var shown = done;
        var heading = 'EARLIER TODAY';
        var sub = 'What you may have caught on Light FM.';
        if (!done.length) {
            shown = today.filter(function (sh) { return toMinutes(sh.start) > nowMin; }).slice(0, cards.length);
            heading = 'LATER TODAY';
            sub = 'What is coming up on Light FM.';
        }
        var h3 = q('h3', section);
        var h1 = q('h1', section);
        if (h3) { h3.textContent = heading; }
        if (h1) { h1.textContent = sub; }
        cards.forEach(function (c, i) {
            var sh = shown[i];
            c.hidden = !sh;
            if (!sh) { return; }
            var h6 = q('.songDiv h6', c);
            var sp = q('.songDiv p', c);
            var tp = qa('p', c);
            if (h6) { h6.textContent = sh.title; }
            if (sp) { sp.textContent = sh.host || prettyTime(sh.start) + ' to ' + prettyTime(sh.end === '00:00' ? '24:00' : sh.end); }
            if (tp.length) { tp[tp.length - 1].textContent = durationLabel(sh); }
        });
    }

    /* ----- Home page: "On air today" list from the schedule ----- */
    function pageHome() {
        var list = q('.showSection .showList');
        if (!list) { return; }

        var st = findState();
        var today = SCHEDULE[st.today];
        var startIndex = st.live ? st.live.index : (st.next.day === st.today ? st.next.index : today.length);
        var items = [];
        for (var i = startIndex; i < today.length && items.length < 5; i++) { items.push({ show: today[i], index: i, tomorrow: false }); }
        // near the end of the day, carry on into tomorrow's shows
        
        if (items.length < 3) {
            var nextDay = DAYS[(DAYS.indexOf(st.today) + 1) % 7];
            for (var j = 0; j < SCHEDULE[nextDay].length && items.length < 5; j++) { items.push({ show: SCHEDULE[nextDay][j], index: j, tomorrow: true }); }
        }

        list.innerHTML = '';
        var upNextGiven = false;
        items.forEach(function (item, n) {
            var isLive = st.live && n === 0 && !item.tomorrow;
            var card = make('div', isLive ? 'listCard1' : 'listCard');

            var time = make('div', 'time');
            time.appendChild(make('p', '', item.show.start));

            var info = make('div', 'showInfo');
            info.appendChild(make('h3', '', item.show.title));
            info.appendChild(make('p', '', item.show.host ? 'with ' + item.show.host : item.show.about));

            var tag = make('div', 'lineUp');
            var label = '\u2022 LIVE';
            if (!isLive) {
                if (item.tomorrow) { label = 'Tomorrow'; }
                else if (!upNextGiven) { label = 'Up next'; upNextGiven = true; }
                else { label = 'Later today'; }
            }
            tag.appendChild(make('p', '', label));

            card.appendChild(time);
            card.appendChild(info);
            card.appendChild(tag);
            list.appendChild(card);
        });
    }

    /* ----- every page: footer wording and address ----- */
    function pageFooter() {
        var blurb = q('.footerSec .logoText p');
        if (blurb) { blurb.textContent = STATION_BLURB; }
        var holder = q('.footerSec .logoText');
        if (holder && !q('.footAddress', holder)) {
            var address = make('p', 'footAddress', STATION_ADDRESS);
            address.style.marginTop = '.8rem';
            address.style.fontSize = '.8rem';
            holder.appendChild(address);
        }
    }

    function initPage() {
        pageNav();
        pageShows();
        pageNews();
        pageLive();
        pageHome();
        pageFooter();
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


    // buttons that act as links: <button data-href="shows.html">
    doc.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target.closest('[data-href]') : null;
        if (!target || event.defaultPrevented) { return; }
        var link = doc.createElement('a');
        link.href = target.getAttribute('data-href');
        if (isSwappable(link)) { go(link.href, true); }
        else { window.location.href = link.href; }
    });

    window.addEventListener('popstate', function () {
        if (PAGE_SWAP && window.location.protocol !== 'file:') { go(window.location.href, false); }
    });


    /* =====================================================
       START
       ===================================================== */

    initPage();
    setInterval(render, 30000);   // keep the "on air now" wording fresh

    // arrived with #play on the address (a "listen live" link): try to start now.
    // Browsers may block this; then the player just waits for a press on play.
    if (window.location.hash === '#play') { start(true); }
})();
