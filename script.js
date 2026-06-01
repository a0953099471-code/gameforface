const video = document.getElementById("video");
const player = document.getElementById("player");
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("bestScore");
const finalScore = document.getElementById("finalScore");
const finalBestScore = document.getElementById("finalBestScore");
const statusElement = document.getElementById("status");
const game = document.getElementById("game");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

let score = 0;
let gameStarted = false;
let gameOver = false;
let jumping = false;
let ducking = false;
let speed = 4;
const obstacleInterval = 2500;
const obstacles = [];
let lastObstacleTime = 0;
let lastScoreTime = 0;
let lastFrameTime = 0;
let gameTimer = null;

function jump() {
  if (!gameStarted || gameOver || jumping) return;
  jumping = true;
  player.classList.add("jump");
  player.textContent = "😆";
  setTimeout(() => {
    player.classList.remove("jump");
    player.textContent = "😀";
    jumping = false;
  }, 600);
}

function duck() {
  if (!gameStarted || gameOver || ducking) return;
  ducking = true;
  player.classList.add("duck");
  player.textContent = "😑";
  setTimeout(() => {
    player.classList.remove("duck");
    player.textContent = "😀";
    ducking = false;
  }, 500);
}

function createObstacle() {
  if (!gameStarted || gameOver) return;
  const obstacle = document.createElement("div");
  const type = Math.random() > 0.5 ? "jump" : "duck";
  obstacle.classList.add("obstacle", type);
  obstacle.dataset.type = type;
  obstacle.textContent = type === "jump" ? "🌵" : "🦅";
  obstacle.style.left = `${game.clientWidth}px`;
  if (type === "jump") {
    obstacle.style.height = "70px";
  } else {
    obstacle.style.height = "50px";
  }
  game.appendChild(obstacle);
  obstacles.push(obstacle);
}

const playerRect =
    player.getBoundingClientRect();

const obstacleRect =
    obs.getBoundingClientRect();

const collision =

    playerRect.left <
        obstacleRect.right &&

    playerRect.right >
        obstacleRect.left &&

    playerRect.top <
        obstacleRect.bottom &&

    playerRect.bottom >
        obstacleRect.top;

if(collision){

    const type =
        obs.dataset.type;

    if(
        type === "jump"
        &&
        !player.classList.contains("jump")
    ){

        endGame();

        return;
    }

    if(
        type === "duck"
        &&
        !player.classList.contains("duck")
    ){

        endGame();

        return;
    }
}

function cancelGameLoop() {
  if (gameTimer !== null) {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(gameTimer);
    }
    clearTimeout(gameTimer);
    gameTimer = null;
  }
}

function scheduleGameLoop() {
  gameTimer = setTimeout(() => loopStep(performance.now()), 1000 / 60);
}

function loopStep(time) {
  if (!gameStarted || gameOver) {
    return;
  }

  gameLoop(time || performance.now());
  scheduleGameLoop();
}

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  gameOver = false;
  score = 0;
  speed = 4;
  lastScoreTime = performance.now();
  lastObstacleTime = performance.now();
  lastFrameTime = performance.now();
  scoreElement.textContent = score;
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  statusElement.textContent = "遊戲進行中...";
  cancelGameLoop();
  scheduleGameLoop();
}

function endGame() {
  cancelGameLoop();
  if (gameOver) return;
  gameOver = true;
  const best = Math.max(score, Number(localStorage.getItem("bestScore") || 0));
  localStorage.setItem("bestScore", best);
  finalScore.textContent = score;
  finalBestScore.textContent = best;
  bestScoreElement.textContent = best;
  statusElement.textContent = "💀 GAME OVER";
  gameOverScreen.classList.remove("hidden");
}

function gameLoop(time) {
  if (!gameStarted || gameOver) {
    return;
  }

  const deltaTime = time - lastFrameTime;
  lastFrameTime = time;
  const frameFactor = deltaTime / (1000 / 60);

  const scoreSteps = Math.floor((time - lastScoreTime) / 100);
  if (scoreSteps > 0) {
    score += scoreSteps;
    lastScoreTime += scoreSteps * 100;
    scoreElement.textContent = score;
    speed = 4 + Math.max(0, Math.floor((score - 1000) / 500));
  }

  const obstacleSteps = Math.floor((time - lastObstacleTime) / obstacleInterval);
  for (let i = 0; i < obstacleSteps; i++) {
    createObstacle();
    lastObstacleTime += obstacleInterval;
  }

  obstacles.slice().forEach((obs) => {
    // Move using left coordinate for smooth, consistent movement
    let left = parseFloat(obs.style.left);
    if (isNaN(left)) left = game.clientWidth;

    const playerRect = getPlayerCollisionRect();
    const obsRectBefore = obs.getBoundingClientRect();
    const overlapBefore = (
      playerRect.right > obsRectBefore.left &&
      playerRect.left < obsRectBefore.right &&
      playerRect.bottom > obsRectBefore.top &&
      playerRect.top < obsRectBefore.bottom
    );

    if (overlapBefore) {
      const type = obs.dataset.type;
      const isJumping = player.classList.contains('jump');
      const isDucking = player.classList.contains('duck');
      try { window.lastCollision = { type, isJumping, isDucking, before: { playerRect, obsRect: obsRectBefore } }; } catch (e) {}
      if ((type === 'jump' && !isJumping) || (type === 'duck' && !isDucking)) {
        endGame();
      }
    }

    left -= speed * frameFactor;
    obs.style.left = `${left}px`;
    void obs.offsetHeight;

    const obsRectAfter = obs.getBoundingClientRect();
    const overlapAfter = (
      playerRect.right > obsRectAfter.left &&
      playerRect.left < obsRectAfter.right &&
      playerRect.bottom > obsRectAfter.top &&
      playerRect.top < obsRectAfter.bottom
    );

    if (overlapAfter) {
      const type = obs.dataset.type;
      const isJumping = player.classList.contains('jump');
      const isDucking = player.classList.contains('duck');
      try { window.lastCollision = { type, isJumping, isDucking, after: { playerRect, obsRect: obsRectAfter } }; } catch (e) {}
      if ((type === 'jump' && !isJumping) || (type === 'duck' && !isDucking)) {
        endGame();
      }
    }

    // Remove when fully past left side
    const obstacleRight = left + obs.offsetWidth;
    if (obstacleRight < -100) {
      obs.remove();
      const removeIndex = obstacles.indexOf(obs);
      if (removeIndex !== -1) {
        obstacles.splice(removeIndex, 1);
      }
    }
  });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true
});

faceMesh.onResults((results) => {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    return;
  }

  const lm = results.multiFaceLandmarks[0];
  const mouth = distance(lm[13], lm[14]) / distance(lm[78], lm[308]);
  const leftEye = distance(lm[159], lm[145]) / distance(lm[33], lm[133]);
  const rightEye = distance(lm[386], lm[374]) / distance(lm[263], lm[362]);
  const eye = (leftEye + rightEye) / 2;

  if (mouth > 0.30) {
    jump();
  }

  if (eye < 0.15) {
    duck();
  }
});

let camera;

async function initCamera() {
  const best = Number(localStorage.getItem("bestScore") || 0);
  bestScoreElement.textContent = best;

  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    statusElement.textContent = "無法取得相機，請允許相機或直接按開始遊戲";
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideoInput = devices.some((device) => device.kind === "videoinput");
    if (!hasVideoInput) {
      statusElement.textContent = "無法取得相機，請允許相機或直接按開始遊戲";
      return;
    }

    camera = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width: 640,
      height: 480
    });

    await camera.start();
    statusElement.textContent = "張嘴跳躍、閉眼下蹲，按下開始遊戲";
  } catch (error) {
    statusElement.textContent = "無法取得相機，請允許相機或直接按開始遊戲";
    console.error('Camera start failed:', error);
  }
}

initCamera();

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", () => {
  location.reload();
});




