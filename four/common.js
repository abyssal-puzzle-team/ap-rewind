// four/common.js
// Mock backend explicitly for Abyssal Puzzle 4
(function () {
    console.log("Mock backend initializing...");

    const API_BASE_URL = 'https://abyssal4.asterveil.top/api';
    const ANSWERS_JSON_PATH = '/four/answers.json';
    const MOCK_DB_KEY = 'abyssal4_mock_db';

    // Store mock meta timer in session to survive reload but not forever
    let metaTimer = {
        timerId: null,
        endTime: null,
        status: 'idle', // 'idle', 'running', 'finished'
    };

    // --- Helpers ---
    function getMetaTimer() {
        const stored = localStorage.getItem('abyssal4_meta_timer');
        if (stored) {
            return JSON.parse(stored);
        }
        return metaTimer;
    }

    function saveMetaTimer(timer) {
        metaTimer = timer;
        localStorage.setItem('abyssal4_meta_timer', JSON.stringify(timer));
    }

    async function loadAnswers() {
        try {
            const originalFetch = window.__originalFetch || window.fetch;
            const res = await originalFetch(ANSWERS_JSON_PATH);
            return await res.json();
        } catch (e) {
            console.error("Failed to load answers.json", e);
            return {};
        }
    }

    function getDB() {
        const dbString = localStorage.getItem(MOCK_DB_KEY);
        if (dbString) return JSON.parse(dbString);
        return { accounts: {}, ipCooldowns: {}, simpleCooldowns: {}, fourByFourCooldowns: {}, goalkeeperCooldowns: {} };
    }

    function saveDB(db) {
        localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
    }

    function getIp() {
        return "local-user"; // Mock IP
    }

    function checkUserCooldown(cooldownMap, username) {
        if (cooldownMap[username]) {
            const endTime = cooldownMap[username];
            if (Date.now() < endTime) {
                return Math.ceil((endTime - Date.now()) / 1000);
            } else {
                delete cooldownMap[username];
            }
        }
        return 0;
    }

    // --- Create a default user if none exists so bypass login works smoothly ---
    function initializeDefaultUser() {
        const db = getDB();
        const username = "guest";
        if (!db.accounts[username]) {
            db.accounts[username] = {
                password: "123",
                cool_down: "0",
                progress: "1",
                meta_xy: "[0,0]",
                meta_progress: "",
                meta_key_number: "0",
                meta_power_number: "0",
                meta_card: false
            };
            saveDB(db);
        }

        // Auto-login logic: set cookies if not exists
        if (!document.cookie.includes('username=')) {
            document.cookie = `username=${username}; path=/`;
            document.cookie = `password=123; path=/`;
        }
    }
    initializeDefaultUser();


    // --- Interceptor ---
    const originalFetch = window.fetch;
    window.__originalFetch = originalFetch; // Save it to load answers.json without infinite loop

    window.fetch = async function (resource, options) {
        // Only intercept API calls
        if (typeof resource === 'string' && resource.startsWith(API_BASE_URL)) {
            const path = resource.replace(API_BASE_URL, '');
            console.log(`[Mock API Intercepted] ${options?.method || 'GET'} ${path}`);

            const reqBody = options && options.body ? JSON.parse(options.body) : {};
            const answers = await loadAnswers();
            const db = getDB();

            async function jsonResponse(data, status = 200) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
                saveDB(db); // Save DB state
                return new Response(JSON.stringify(data), {
                    status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // --- Handlers ---
            if (path === '/acc_check_password' && options?.method === 'POST') {
                const { username } = reqBody;
                let targetUser = username;
                if (!db.accounts[targetUser]) targetUser = "guest";
                return jsonResponse({ success: true, message: '密码正确。', user_data: db.accounts[targetUser] });
            }

            if (path === '/cooldown-status' && (!options || options.method === 'GET')) {
                const ip = getIp();
                let remaining = 0;
                if (db.ipCooldowns[ip]) {
                    remaining = Math.ceil((db.ipCooldowns[ip] - Date.now()) / 1000);
                    if (remaining <= 0) {
                        remaining = 0;
                        delete db.ipCooldowns[ip];
                    }
                }
                return jsonResponse({ cooldownRemaining: remaining });
            }

            if (path === '/set_user_data' && options?.method === 'POST') {
                const { username, option, value } = reqBody;
                const user = db.accounts[username] || db.accounts["guest"];
                let processedValue = value;
                if (option === 'meta_card') {
                    processedValue = (value === true || String(value).toLowerCase() === 'true');
                }
                user[option] = processedValue;
                return jsonResponse({ success: true, message: `Mock User ${username} 的 ${option} 已更新。`, updated_user: user });
            }

            if (path === '/check-key' && options?.method === 'POST') {
                const { nodeId, key } = reqBody;
                const ip = getIp();
                if (db.ipCooldowns[ip]) {
                    const endTime = db.ipCooldowns[ip];
                    if (Date.now() < endTime) {
                        return jsonResponse({ success: false, message: '请求过于频繁，请稍后再试。', cooldown: Math.ceil((endTime - Date.now()) / 1000) }, 429);
                    } else {
                        delete db.ipCooldowns[ip];
                    }
                }
                const correctKey = answers[`${nodeId}_pass`];
                if (!correctKey || typeof key === 'undefined') {
                    return jsonResponse({ success: false, message: '请求无效或缺少参数。' }, 400);
                }
                if (key !== correctKey) {
                    const coolTime = parseInt(answers.cool_time || "180", 10);
                    db.ipCooldowns[ip] = Date.now() + coolTime * 1000;
                    return jsonResponse({ success: false, message: '密钥错误，已触发冷却。', cooldown: coolTime }, 401);
                }

                const mTimer = getMetaTimer();
                switch (nodeId) {
                    case 'false_meta':
                        return jsonResponse({ success: true, message: '假Meta解答正确！', metaStarted: true });
                    case 'true_meta':
                        if (mTimer.status !== 'running') return jsonResponse({ success: false, message: '最终阶段尚未激活，无法提交真Meta。' }, 400);
                        const remaining = mTimer.endTime - Date.now();
                        mTimer.status = 'idle';
                        mTimer.endTime = null;
                        saveMetaTimer(mTimer);
                        return jsonResponse({ success: true, message: '恭喜！你已成功解开最终Meta！', remainingSeconds: remaining > 0 ? Math.ceil(remaining / 1000) : 0 });
                    default:
                        return jsonResponse({ success: true, message: '密钥正确!' });
                }
            }

            if (path === '/meta-status' && (!options || options.method === 'GET')) {
                const mTimer = getMetaTimer();

                // Automatically start the 24h global timer on the first poll
                if (mTimer.status === 'idle') {
                    const metaDuration = parseInt(answers.meta_time || "86400", 10);
                    mTimer.status = 'running';
                    mTimer.endTime = Date.now() + metaDuration * 1000;
                    saveMetaTimer(mTimer);
                }

                let remainingSeconds = 0;
                if (mTimer.status === 'running' && mTimer.endTime) {
                    const remaining = mTimer.endTime - Date.now();
                    remainingSeconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
                    if (remainingSeconds === 0) {
                        mTimer.status = 'finished';
                        saveMetaTimer(mTimer);
                    }
                }
                return jsonResponse({ status: mTimer.status, remainingSeconds: remainingSeconds });
            }

            if (path === '/add_meta' && options?.method === 'POST') {
                const { username, progress } = reqBody;
                const user = db.accounts[username] || db.accounts["guest"];
                if (user.meta_progress) {
                    if (!user.meta_progress.includes(progress)) user.meta_progress += `,${progress}`;
                } else {
                    user.meta_progress = progress;
                }
                return jsonResponse({ success: true, new_progress: user.meta_progress });
            }

            if (path === '/diminish_meta_time' && options?.method === 'POST') {
                const mTimer = getMetaTimer();
                if (mTimer.status !== 'running') return jsonResponse({ success: false, message: 'Meta 倒计时未在运行中。' }, 400);
                const reductionSeconds = parseInt(answers.SIMPLE_PUZZLE_TIME_REDUCTION || "120", 10);
                mTimer.endTime -= reductionSeconds * 1000;
                if (mTimer.endTime < Date.now()) mTimer.endTime = Date.now();
                saveMetaTimer(mTimer);
                return jsonResponse({ success: true, message: `Meta 总时间已减少 ${reductionSeconds} 秒。` });
            }

            if (path === '/change_meta_xy' && options?.method === 'POST') {
                const { username, new_xy } = reqBody;
                const user = db.accounts[username] || db.accounts["guest"];
                user.meta_xy = new_xy;
                return jsonResponse({ success: true, new_xy: user.meta_xy });
            }

            if (path === '/simple_cooldown_status' && options?.method === 'POST') {
                return jsonResponse({ cooldownRemaining: checkUserCooldown(db.simpleCooldowns, reqBody.username) });
            }

            if (path === '/start_simple_cooldown' && options?.method === 'POST') {
                const coolTime = parseInt(answers.SIMPLE_PUZZLE_COOLDOWN || "120", 10);
                db.simpleCooldowns[reqBody.username] = Date.now() + coolTime * 1000;
                return jsonResponse({ success: true });
            }

            if (path === '/4x4_cooldown_status' && options?.method === 'POST') {
                return jsonResponse({ cooldownRemaining: checkUserCooldown(db.fourByFourCooldowns, reqBody.username) });
            }

            if (path === '/start_4x4_cooldown' && options?.method === 'POST') {
                const coolTime = parseInt(answers.FOUR_BY_FOUR_COOLDOWN || "300", 10);
                db.fourByFourCooldowns[reqBody.username] = Date.now() + coolTime * 1000;
                return jsonResponse({ success: true });
            }

            if (path === '/check_4x4_key' && options?.method === 'POST') {
                const { username, keys } = reqBody;
                if (checkUserCooldown(db.fourByFourCooldowns, username) > 0) return jsonResponse({ success: false, message: '还在冷却中！' }, 403);
                const correctKeys = [answers.FOUR_BY_FOUR_KEY_1, answers.FOUR_BY_FOUR_KEY_2, answers.FOUR_BY_FOUR_KEY_3, answers.FOUR_BY_FOUR_KEY_4];
                let allCorrect = true;
                for (let i = 0; i < 4; i++) {
                    if (keys[i] !== correctKeys[i]) { allCorrect = false; break; }
                }
                if (allCorrect) return jsonResponse({ success: true });
                return jsonResponse({ success: false, message: '密钥有误。' });
            }

            if (path === '/goalkeeper_cooldown_status' && options?.method === 'POST') {
                return jsonResponse({ cooldownRemaining: checkUserCooldown(db.goalkeeperCooldowns, reqBody.username) });
            }

            if (path === '/check_goalkeeper_key' && options?.method === 'POST') {
                const { username, id, key } = reqBody;
                if (checkUserCooldown(db.goalkeeperCooldowns, username) > 0) return jsonResponse({ success: false, message: '还在冷却中！' }, 403);
                const correctKey = answers[`GOALKEEPER_KEY_${id}`];
                if (key === correctKey) return jsonResponse({ success: true });
                const coolTime = parseInt(answers.GOALKEEPER_COOLDOWN || "180", 10);
                db.goalkeeperCooldowns[username] = Date.now() + coolTime * 1000;
                return jsonResponse({ success: false, message: '密钥错误。' });
            }

            if (path === '/random' && (!options || options.method === 'GET')) {
                try {
                    const res = await originalFetch('/four/meta_random.json');
                    const data = await res.json();
                    const randomPuzzle = data.puzzles[Math.floor(Math.random() * data.puzzles.length)];
                    return jsonResponse({ success: true, puzzle: randomPuzzle });
                } catch (e) {
                    console.error("Failed to load meta_random.json", e);
                    return jsonResponse({ success: false, message: '无法加载随机题库' }, 500);
                }
            }

            // --- Unhandled ---
            console.warn("Mock backend unhandled route:", path);
            return jsonResponse({ success: false, message: 'Mock backend unhandled route' }, 404);
        }

        // If not an API request, proceed with normal fetch
        return originalFetch(resource, options);
    };

})();
