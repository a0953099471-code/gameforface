// 檢查 CDN 依賴是否已加載
function checkDependencies() {
    const missing = [];
    if (typeof Chart === 'undefined') missing.push('Chart.js');
    if (typeof FaceMesh === 'undefined') missing.push('MediaPipe FaceMesh');
    if (typeof Camera === 'undefined') missing.push('MediaPipe Camera');
    if (typeof drawConnectors === 'undefined') missing.push('MediaPipe Drawing Utils');
    return missing;
}

const videoElement = document.getElementById('video');
const overlayElement = document.getElementById('overlay');
const canvasCtx = overlayElement.getContext('2d');
const cameraStatus = document.getElementById('camera-status');
const detectedActionLabel = document.getElementById('detected-action');
const mouthValue = document.getElementById('mouth-value');
const eyeValue = document.getElementById('eye-value');
const playerHpLabel = document.getElementById('player-hp');
const bossHpLabel = document.getElementById('boss-hp');
const energyText = document.getElementById('energy-text');
const effectText = document.getElementById('effect-text');
const cooldownValues = document.getElementById('cooldown-values');
const playerBar = document.getElementById('player-bar');
const bossBar = document.getElementById('boss-bar');
const energyBar = document.getElementById('energy-bar');
const restartBtn = document.getElementById('restart-btn');
const overlayPanel = document.getElementById('game-over-panel');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverText = document.getElementById('game-over-text');
const overlayRestart = document.getElementById('overlay-restart');
const statusChartCtx = document.getElementById('status-chart').getContext('2d');

// 全局相機和 Face Mesh 引用
let globalCamera = null;
let globalFaceMesh = null;
let gameLoopInterval = null;

const ACTIONS = {
    ATTACK: 'ATTACK',
    DEFEND: 'DEFEND',
    CHARGE: 'CHARGE',
    ULTIMATE: 'ULTIMATE',
    NEUTRAL: '等待偵測',
};

const THRESHOLDS = {
    mouthOpen: 0.34,
    mouthClosed: 0.18,
    eyeOpen: 0.28,
    eyeClosed: 0.17,
};

const TIME = {
    stableMs: 800,
    actionCooldownMs: 2000,
    ultimateCooldownMs: 10000,
    bossAttackMs: 3000,
};

const gameState = {
    playerHp: 100,
    bossHp: 200,
    energy: 0,
    defenseActive: false,
    bossTimer: TIME.bossAttackMs,
    score: 0,
    currentAction: ACTIONS.NEUTRAL,
    confirmedAction: null,
    rawAction: ACTIONS.NEUTRAL,
    rawActionSince: 0,
    lastActionAt: {
        ATTACK: 0,
        DEFEND: 0,
        CHARGE: 0,
        ULTIMATE: 0,
    },
    cooldowns: {
        ATTACK: 0,
        DEFEND: 0,
        CHARGE: 0,
        ULTIMATE: 0,
    },
    gameOver: false,
    effectMessage: '等待穩定動作後觸發技能。',
    faceDetected: false,
};

// Chart 延遲初始化
let chart = null;

function initializeChart() {
    if (chart) return;  // 已初始化
    const missing = checkDependencies();
    if (missing.length > 0) {
        cameraStatus.textContent = `缺少依賴：${missing.join(', ')}`;
        return false;
    }
    chart = new Chart(statusChartCtx, {
        type: 'doughnut',
        data: {
            labels: ['玩家 HP', 'Boss HP', '能量'],
            datasets: [{
                data: [gameState.playerHp, gameState.bossHp, gameState.energy],
                backgroundColor: ['#4ca0ff', '#ff6d84', '#5af58a'],
                borderWidth: 0,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#d6e8ff' },
                },
            },
        },
    });
    return true;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function updateBars() {
    playerHpLabel.textContent = gameState.playerHp;
    bossHpLabel.textContent = gameState.bossHp;
    energyText.textContent = gameState.energy;
    playerBar.style.width = `${gameState.playerHp}%`;
    bossBar.style.width = `${gameState.bossHp / 2}%`;
    energyBar.style.width = `${gameState.energy}%`;
    detectedActionLabel.textContent = gameState.currentAction;
    effectText.textContent = gameState.effectMessage;

    const cooldownText = Object.entries(gameState.cooldowns)
        .map(([action, value]) => `${action}: ${Math.ceil(value / 1000)}s`)
        .join(' / ');
    cooldownValues.textContent = cooldownText;

    if (chart) {
        chart.data.datasets[0].data = [gameState.playerHp, gameState.bossHp, gameState.energy];
        chart.update();
    }
}

function setGameOver(title, message) {
    gameState.gameOver = true;
    gameOverTitle.textContent = title;
    gameOverText.textContent = message;
    overlayPanel.classList.remove('hidden');
}

function resetGame() {
    gameState.playerHp = 100;
    gameState.bossHp = 200;
    gameState.energy = 0;
    gameState.defenseActive = false;
    gameState.bossTimer = TIME.bossAttackMs;
    gameState.score = 0;
    gameState.currentAction = ACTIONS.NEUTRAL;
    gameState.confirmedAction = null;
    gameState.rawAction = ACTIONS.NEUTRAL;
    gameState.rawActionSince = performance.now();
    gameState.lastActionAt = {
        ATTACK: 0,
        DEFEND: 0,
        CHARGE: 0,
        ULTIMATE: 0,
    };
    gameState.cooldowns = {
        ATTACK: 0,
        DEFEND: 0,
        CHARGE: 0,
        ULTIMATE: 0,
    };
    gameState.gameOver = false;
    gameState.effectMessage = '等待穩定動作後觸發技能。';
    overlayPanel.classList.add('hidden');
    updateBars();
}

function triggerAction(action) {
    if (gameState.gameOver || action === ACTIONS.NEUTRAL) {
        return;
    }

    const now = performance.now();
    const onCooldown = gameState.cooldowns[action] > 0;
    const tooSoon = now - gameState.lastActionAt[action] < TIME.actionCooldownMs;

    if (onCooldown || tooSoon) {
        gameState.effectMessage = `${action} 冷卻中，請稍待。`;
        return;
    }

    gameState.currentAction = action;
    gameState.lastActionAt[action] = now;
    gameState.cooldowns[action] = action === ACTIONS.ULTIMATE ? TIME.ultimateCooldownMs : TIME.actionCooldownMs;
    gameState.confirmedAction = action;

    if (action === ACTIONS.ATTACK) {
        const damage = 14;
        gameState.bossHp = clamp(gameState.bossHp - damage, 0, 200);
        gameState.energy = clamp(gameState.energy + 10, 0, 100);
        gameState.effectMessage = `ATTACK！對 Boss 造成 ${damage} 點傷害。`;
        gameState.score += 12;
    } else if (action === ACTIONS.DEFEND) {
        gameState.defenseActive = true;
        gameState.effectMessage = 'DEFEND！進入防禦狀態，下一次傷害減半。';
        gameState.score += 8;
    } else if (action === ACTIONS.CHARGE) {
        gameState.energy = clamp(gameState.energy + 18, 0, 100);
        gameState.effectMessage = 'CHARGE！能量增加。';
        gameState.score += 10;
    } else if (action === ACTIONS.ULTIMATE) {
        if (gameState.energy >= 100) {
            const damage = 45;
            gameState.bossHp = clamp(gameState.bossHp - damage, 0, 200);
            gameState.energy = 0;
            gameState.effectMessage = `ULTIMATE！釋放終極一擊，造成 ${damage} 點傷害。`;
            gameState.score += 28;
        } else {
            gameState.effectMessage = 'ULTIMATE 需要滿能量。請先集氣。';
        }
    }

    if (gameState.bossHp <= 0) {
        gameState.bossHp = 0;
        setGameOver('勝利！', `你擊敗了 Boss，分數：${gameState.score}`);
    }

    updateBars();
}

function determineAction(mouthRatio, eyeRatio) {
    if (eyeRatio < THRESHOLDS.eyeClosed) {
        return ACTIONS.ULTIMATE;
    }
    if (mouthRatio > THRESHOLDS.mouthOpen) {
        return ACTIONS.ATTACK;
    }
    if (mouthRatio < THRESHOLDS.mouthClosed) {
        return ACTIONS.DEFEND;
    }
    if (eyeRatio > THRESHOLDS.eyeOpen) {
        return ACTIONS.CHARGE;
    }
    return ACTIONS.NEUTRAL;
}

function handleStableAction(rawAction) {
    const now = performance.now();
    if (rawAction !== gameState.rawAction) {
        gameState.rawAction = rawAction;
        gameState.rawActionSince = now;
    }

    if (rawAction === ACTIONS.NEUTRAL) {
        gameState.currentAction = ACTIONS.NEUTRAL;
        detectedActionLabel.textContent = '等待臉部表情';
        return;
    }

    const elapsed = now - gameState.rawActionSince;
    if (elapsed >= TIME.stableMs) {
        detectedActionLabel.textContent = `${rawAction} 已穩定`;
        triggerAction(rawAction);
    } else {
        const progress = Math.min(100, Math.floor((elapsed / TIME.stableMs) * 100));
        detectedActionLabel.textContent = `${rawAction} 偵測中... ${progress}%`;
    }
}

function updateCooldowns(delta) {
    Object.keys(gameState.cooldowns).forEach((key) => {
        gameState.cooldowns[key] = Math.max(0, gameState.cooldowns[key] - delta);
    });
}

function bossAttack() {
    if (gameState.gameOver || gameState.bossHp <= 0 || gameState.playerHp <= 0) {
        return;
    }

    const damage = 10 + Math.round(Math.random() * 8);
    const finalDamage = gameState.defenseActive ? Math.ceil(damage / 2) : damage;
    gameState.playerHp = clamp(gameState.playerHp - finalDamage, 0, 100);
    gameState.defenseActive = false;
    gameState.effectMessage = `Boss 發動攻擊，受到 ${finalDamage} 點傷害。`;
    if (gameState.playerHp <= 0) {
        gameState.playerHp = 0;
        setGameOver('失敗...', `你被 Boss 擊敗了，分數：${gameState.score}`);
    }
}

function tickGame() {
    if (gameState.gameOver) {
        return;
    }

    const delta = 100;
    gameState.bossTimer -= delta;
    if (gameState.bossTimer <= 0) {
        bossAttack();
        gameState.bossTimer = TIME.bossAttackMs;
    }

    updateCooldowns(delta);
    updateBars();
}

function onFaceMeshResults(results) {
    if (!results.image) return;

    overlayElement.width = results.image.width;
    overlayElement.height = results.image.height;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, overlayElement.width, overlayElement.height);
    canvasCtx.drawImage(results.image, 0, 0, overlayElement.width, overlayElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: '#64c8ff', lineWidth: 0.9 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#85ffdf', lineWidth: 2 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#85ffdf', lineWidth: 2 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#ff98a5', lineWidth: 2 });

        const mouthRatio = computeMouthRatio(landmarks);
        const eyeRatio = computeEyeRatio(landmarks);

        mouthValue.textContent = mouthRatio.toFixed(2);
        eyeValue.textContent = eyeRatio.toFixed(2);
        gameState.faceDetected = true;
        cameraStatus.textContent = 'Face Mesh 已偵測到臉部，請控制你的表情。';

        const rawAction = determineAction(mouthRatio, eyeRatio);
        handleStableAction(rawAction);
    } else {
        gameState.faceDetected = false;
        detectedActionLabel.textContent = '無臉部偵測';
        gameState.effectMessage = '請將臉部置中並允許相機使用。';
        cameraStatus.textContent = '未偵測到臉部，請調整鏡頭。';
        gameState.rawAction = ACTIONS.NEUTRAL;
    }

    canvasCtx.restore();
    updateBars();
}

function computeMouthRatio(landmarks) {
    const top = landmarks[13];
    const bottom = landmarks[14];
    const left = landmarks[78];
    const right = landmarks[308];
    const vertical = distance(top, bottom);
    const horizontal = distance(left, right);
    return horizontal > 0 ? vertical / horizontal : 0;
}

function computeEyeRatio(landmarks) {
    const leftTop = landmarks[159];
    const leftBottom = landmarks[145];
    const leftLeft = landmarks[33];
    const leftRight = landmarks[133];
    const rightTop = landmarks[386];
    const rightBottom = landmarks[374];
    const rightLeft = landmarks[263];
    const rightRight = landmarks[362];
    const leftRatio = distance(leftTop, leftBottom) / distance(leftLeft, leftRight);
    const rightRatio = distance(rightTop, rightBottom) / distance(rightLeft, rightRight);
    return (leftRatio + rightRatio) / 2;
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function stopCamera() {
    if (globalCamera) {
        globalCamera.stop();
        globalCamera = null;
    }
    globalFaceMesh = null;
}

function createFaceMesh() {
    const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
    });
    faceMesh.onResults(onFaceMeshResults);
    return faceMesh;
}

function startCamera() {
    // 停止舊相機以防止資源洩漏
    stopCamera();

    const faceMesh = createFaceMesh();
    globalFaceMesh = faceMesh;  // 保存全局引用
    
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: 1280,
        height: 720,
    });

    globalCamera = camera;  // 保存全局引用

    camera.start()
        .then(() => {
            cameraStatus.textContent = '相機已啟動，開始進行 Face Mesh 偵測。';
        })
        .catch((error) => {
            cameraStatus.textContent = `相機啟動失敗：${error.message}`;
        });
}

restartBtn.addEventListener('click', () => {
    resetGame();
    startCamera();
});

overlayRestart.addEventListener('click', () => {
    resetGame();
    startCamera();
});

window.addEventListener('DOMContentLoaded', () => {
    // 檢查 CDN 依賴
    const missing = checkDependencies();
    if (missing.length > 0) {
        cameraStatus.textContent = `等待加載... ${missing.join(', ')}`;
        // 延遲初始化，等待 CDN 加載
        const checkInterval = setInterval(() => {
            const stillMissing = checkDependencies();
            if (stillMissing.length === 0) {
                clearInterval(checkInterval);
                if (initializeChart()) {
                    resetGame();
                    startCamera();
                    gameLoopInterval = setInterval(tickGame, 100);
                }
            }
        }, 100);
        return;
    }

    // CDN 已加載，正常初始化
    if (initializeChart()) {
        resetGame();
        startCamera();
        gameLoopInterval = setInterval(tickGame, 100);
    }
});
