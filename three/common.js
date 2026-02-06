/**
 * Abyssal Puzzle - 公共 JavaScript 模块
 * 包含 Cookie 操作、冷却管理、音频播放等公共功能
 */

// ========== Cookie 操作模块 ==========

/**
 * 设置 Cookie
 * @param {string} name - Cookie 名称
 * @param {string} value - Cookie 值
 * @param {number} seconds - 过期时间（秒）
 */
function setCookie(name, value, seconds) {
    const date = new Date();
    date.setTime(date.getTime() + seconds * 1000);
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

/**
 * 获取 Cookie
 * @param {string} name - Cookie 名称
 * @returns {string|null} Cookie 值或 null
 */
function getCookie(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length);
        }
    }
    return null;
}

/**
 * 删除 Cookie
 * @param {string} name - Cookie 名称
 */
function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

// ========== 冷却管理模块 ==========

/**
 * 冷却管理器类
 * 管理密码验证的冷却状态
 */
class CooldownManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.cookieName - Cookie 名称
     * @param {number} options.cooldownSeconds - 冷却时间（秒）
     * @param {HTMLElement} options.inputElement - 输入框元素
     * @param {HTMLElement} options.buttonElement - 按钮元素
     * @param {HTMLElement} options.errorElement - 错误消息元素
     * @param {HTMLElement} options.formElement - 表单容器元素
     * @param {string} options.buttonDefaultText - 按钮默认文字
     * @param {string} options.buttonLoadingText - 按钮加载时文字
     * @param {Function} options.onCooldownEnd - 冷却结束回调（可选）
     */
    constructor(options) {
        this.cookieName = options.cookieName;
        this.cooldownSeconds = options.cooldownSeconds;
        this.inputElement = options.inputElement;
        this.buttonElement = options.buttonElement;
        this.errorElement = options.errorElement;
        this.formElement = options.formElement;
        this.buttonDefaultText = options.buttonDefaultText || '验证';
        this.buttonLoadingText = options.buttonLoadingText || '验证中...';
        this.onCooldownEnd = options.onCooldownEnd || (() => {});

        this.activeCooldownTimer = null;
        this.activeCooldownTimeout = null;
    }

    /**
     * 检查冷却状态
     * @returns {Object} { cooldown: boolean, remaining: number }
     */
    checkCooldown() {
        const expiryTime = getCookie(this.cookieName);
        if (expiryTime) {
            const now = Date.now();
            if (now < parseInt(expiryTime)) {
                const remaining = Math.ceil((parseInt(expiryTime) - now) / 1000);
                return { cooldown: true, remaining };
            }
        }
        return { cooldown: false, remaining: 0 };
    }

    /**
     * 设置冷却
     */
    setCooldown() {
        const expiryTime = Date.now() + this.cooldownSeconds * 1000;
        setCookie(this.cookieName, expiryTime, this.cooldownSeconds);
    }

    /**
     * 清除冷却
     */
    clearCooldown() {
        deleteCookie(this.cookieName);
    }

    /**
     * 清理冷却状态
     * @param {boolean} forceClearMessage - 是否强制清除错误消息
     */
    clearCooldownState(forceClearMessage = false) {
        if (this.activeCooldownTimer) {
            clearInterval(this.activeCooldownTimer);
            this.activeCooldownTimer = null;
        }
        if (this.activeCooldownTimeout) {
            clearTimeout(this.activeCooldownTimeout);
            this.activeCooldownTimeout = null;
        }
        this.formElement.classList.remove('cooldown-active');
        this.inputElement.disabled = false;
        this.buttonElement.disabled = false;
        this.buttonElement.textContent = this.buttonDefaultText;
        if (forceClearMessage) {
            this.errorElement.textContent = '';
        }
    }

    /**
     * 启动前端冷却计时器
     * @param {number} remaining - 剩余秒数
     */
    startFrontendCooldownTimers(remaining) {
        this.inputElement.disabled = true;
        this.buttonElement.disabled = true;
        this.formElement.classList.add('cooldown-active');
        this.buttonElement.textContent = '请等待...';

        let countdown = Math.ceil(remaining);

        // 清除旧计时器
        if (this.activeCooldownTimer) clearInterval(this.activeCooldownTimer);
        if (this.activeCooldownTimeout) clearTimeout(this.activeCooldownTimeout);

        // 更新倒计时显示
        const updateTimerDisplay = () => {
            if (this.formElement.classList.contains('cooldown-active')) {
                if (countdown > 0) {
                    this.errorElement.textContent = `密码错误！请等待 ${countdown} 秒...`;
                    countdown--;
                } else {
                    this.errorElement.textContent = `请稍候...`;
                    clearInterval(this.activeCooldownTimer);
                    this.activeCooldownTimer = null;
                }
            } else {
                clearInterval(this.activeCooldownTimer);
                this.activeCooldownTimer = null;
            }
        };

        updateTimerDisplay();
        this.activeCooldownTimer = setInterval(updateTimerDisplay, 1000);

        // 冷却结束后恢复
        this.activeCooldownTimeout = setTimeout(() => {
            this.activeCooldownTimer = null;
            if (this.formElement.classList.contains('cooldown-active')) {
                console.log('前端冷却结束。重新启用控件。');
                this.clearCooldownState(false);
                this.errorElement.textContent = '';
                this.onCooldownEnd();
            } else {
                console.log('冷却时间到，但 UI 状态已改变。');
                this.clearCooldownState(true);
            }
            this.activeCooldownTimeout = null;
        }, remaining * 1000);
    }

    /**
     * 设置验证中状态
     */
    setVerifyingState() {
        this.buttonElement.disabled = true;
        this.inputElement.disabled = true;
        this.buttonElement.textContent = this.buttonLoadingText;
        this.errorElement.textContent = '';
        this.formElement.classList.remove('cooldown-active');
        if (this.activeCooldownTimer) clearInterval(this.activeCooldownTimer);
        this.activeCooldownTimer = null;
        if (this.activeCooldownTimeout) clearTimeout(this.activeCooldownTimeout);
        this.activeCooldownTimeout = null;
    }
}

// ========== 音频播放模块 ==========

/**
 * 音频播放器类
 * 管理背景音乐的播放
 */
class AudioPlayer {
    /**
     * 构造函数
     * @param {HTMLAudioElement} audioElement - 音频元素
     * @param {Object} options - 配置选项
     * @param {boolean} options.autoPlayOnFirstClick - 是否在第一次点击时自动播放
     * @param {boolean} options.showControlButton - 是否显示控制按钮
     * @param {HTMLElement} options.controlButton - 控制按钮元素（可选）
     */
    constructor(audioElement, options = {}) {
        this.audioElement = audioElement;
        this.autoPlayOnFirstClick = options.autoPlayOnFirstClick !== false;
        this.showControlButton = options.showControlButton || false;
        this.controlButton = options.controlButton || null;
        this.played = false;
        this.isPlaying = false;

        if (this.showControlButton && this.controlButton) {
            this.setupControlButton();
        }

        if (this.autoPlayOnFirstClick) {
            this.setupAutoPlayOnFirstClick();
        }
    }

    /**
     * 设置控制按钮
     */
    setupControlButton() {
        if (!this.controlButton) return;

        this.updateControlButtonText();
        this.controlButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlay();
        });

        // 监听音频播放状态
        this.audioElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.played = true;
            this.updateControlButtonText();
        });

        this.audioElement.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updateControlButtonText();
        });

        this.audioElement.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updateControlButtonText();
        });
    }

    /**
     * 更新控制按钮文字
     */
    updateControlButtonText() {
        if (!this.controlButton) return;
        this.controlButton.textContent = this.isPlaying ? '暂停音乐' : '播放音乐';
    }

    /**
     * 设置第一次点击自动播放
     */
    setupAutoPlayOnFirstClick() {
        const playHandler = () => {
            if (!this.played && this.audioElement) {
                this.play().then(() => {
                    console.log('背景音乐已开始播放。');
                }).catch(error => {
                    console.warn('音频自动播放失败:', error);
                });
            }
        };

        // 延迟绑定，避免页面加载时误触发
        setTimeout(() => {
            document.addEventListener('click', playHandler, { once: true });
        }, 100);
    }

    /**
     * 播放音频
     * @returns {Promise}
     */
    play() {
        return this.audioElement.play();
    }

    /**
     * 暂停音频
     */
    pause() {
        this.audioElement.pause();
    }

    /**
     * 切换播放/暂停
     */
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play().catch(error => {
                console.error('音频播放失败:', error);
            });
        }
    }
}

// ========== LocalStorage 操作模块 ==========

/**
 * 加载解锁状态
 * @param {string} key - LocalStorage 键名
 * @param {Array} defaultValue - 默认值
 * @returns {Array} 解锁状态数组
 */
function loadUnlockedState(key, defaultValue) {
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('加载解锁状态失败:', e);
        }
    }
    return defaultValue;
}

/**
 * 保存解锁状态
 * @param {string} key - LocalStorage 键名
 * @param {Object} state - 要保存的状态对象
 */
function saveUnlockedState(key, state) {
    localStorage.setItem(key, JSON.stringify(state));
}

// ========== 密码验证工具函数 ==========

/**
 * 验证密码并处理结果
 * @param {string} inputPassword - 用户输入的密码
 * @param {string} correctPassword - 正确的密码
 * @param {CooldownManager} cooldownManager - 冷却管理器实例
 * @param {Function} onSuccess - 密码正确时的回调函数
 */
function verifyPassword(inputPassword, correctPassword, cooldownManager, onSuccess) {
    if (!inputPassword) {
        cooldownManager.errorElement.textContent = '请输入密钥。';
        cooldownManager.buttonElement.disabled = false;
        cooldownManager.inputElement.disabled = false;
        return;
    }

    cooldownManager.setVerifyingState();

    // 前端验证密码
    if (inputPassword === correctPassword) {
        console.log('密码正确！');
        cooldownManager.clearCooldownState(true);
        cooldownManager.clearCooldown();
        onSuccess();
    } else {
        // 密码错误
        console.log('密码错误！');
        cooldownManager.inputElement.value = '';
        cooldownManager.setCooldown();
        const cooldownStatus = cooldownManager.checkCooldown();
        cooldownManager.errorElement.textContent = `密码错误！请等待 ${cooldownStatus.remaining} 秒...`;
        cooldownManager.startFrontendCooldownTimers(cooldownStatus.remaining);
    }
}