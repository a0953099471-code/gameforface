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
let bestScore = Number(localStorage.getItem("bestScore") || 0);

let gameStarted = false;
let gameOver = false;

let jumping = false;
let ducking = false;

let speed = 3.5;
let animationId;

const obstacles = [];

bestScoreElement.textContent = bestScore;

function jump() {
    if (!gameStarted || gameOver || jumping) return;

    jumping = true;

    player.classList.add("jump");
    player.textContent = "😆";

    setTimeout(() => {
        player.classList.remove("jump");
        player.textContent = "😀";
        jumping = false;
    }, 650);
}

function duck() {
    if (!gameStarted || gameOver) return;

    if (ducking) return;

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

    const obstacle = document.createElement("div");

    const type =
        Math.random() > 0.5
            ? "jump"
            : "duck";

    obstacle.classList.add("obstacle", type);

    obstacle.dataset.type = type;

    obstacle.style.left =
        game.clientWidth + "px";

    if (type === "jump") {

        obstacle.textContent = "🌵";

        obstacle.style.bottom = "0px";
        obstacle.style.width = "50px";
        obstacle.style.height = "70px";

    } else {

        obstacle.textContent = "🦅";

        obstacle.style.bottom = "45px";
        obstacle.style.width = "60px";
        obstacle.style.height = "100px";
    }

    game.appendChild(obstacle);
    obstacles.push(obstacle);
}

function getPlayerRect() {

    const rect =
        player.getBoundingClientRect();

    return {
        left: rect.left + 8,
        right: rect.right - 8,
        top: rect.top + 8,
        bottom: rect.bottom - 8
    };
}

function checkCollision(obstacle) {

    const playerRect =
        getPlayerRect();

    const obstacleRect =
        obstacle.getBoundingClientRect();

    const overlap =
        playerRect.left < obstacleRect.right &&
        playerRect.right > obstacleRect.left &&
        playerRect.top < obstacleRect.bottom &&
        playerRect.bottom > obstacleRect.top;

    if (!overlap) return false;

    const type =
        obstacle.dataset.type;

    if (type === "jump") {

        return !jumping;

    } else {

        return !ducking;
    }
}

function endGame() {

    gameOver = true;

    cancelAnimationFrame(animationId);

    if (score > bestScore) {

        bestScore = score;

        localStorage.setItem(
            "bestScore",
            bestScore
        );
    }

    bestScoreElement.textContent =
        bestScore;

    finalScore.textContent =
        score;

    finalBestScore.textContent =
        bestScore;

    gameOverScreen.classList.remove(
        "hidden"
    );

    statusElement.textContent =
        "💀 GAME OVER";
}

let lastObstacle = 0;
let lastScore = 0;

function gameLoop(time) {

    if (!gameStarted || gameOver)
        return;

    if (time - lastScore > 100) {

        score++;

        scoreElement.textContent =
            score;

        lastScore = time;

        if (
            score > 1000 &&
            score % 500 === 0
        ) {
            speed += 0.2;
        }
    }

    if (time - lastObstacle > 2200) {

        createObstacle();

        lastObstacle = time;
    }

    for (
        let i = obstacles.length - 1;
        i >= 0;
        i--
    ) {

        const obstacle =
            obstacles[i];

        let left =
            parseFloat(
                obstacle.style.left
            );

        left -= speed;

        obstacle.style.left =
            left + "px";

        if (
            checkCollision(
                obstacle
            )
        ) {
            endGame();
            return;
        }

        if (left < -100) {

            obstacle.remove();

            obstacles.splice(i, 1);
        }
    }

    animationId =
        requestAnimationFrame(
            gameLoop
        );
}

function startGame() {

    score = 0;

    speed = 3.5;

    gameStarted = true;

    gameOver = false;

    scoreElement.textContent = 0;

    startScreen.classList.add(
        "hidden"
    );

    gameOverScreen.classList.add(
        "hidden"
    );

    obstacles.forEach(o =>
        o.remove()
    );

    obstacles.length = 0;

    lastObstacle = performance.now();
    lastScore = performance.now();

    statusElement.textContent =
        "遊戲進行中";

    animationId =
        requestAnimationFrame(
            gameLoop
        );
}

startButton.addEventListener(
    "click",
    startGame
);

restartButton.addEventListener(
    "click",
    () => {
        location.reload();
    }
);

function distance(a, b) {
    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}

const faceMesh =
    new FaceMesh({
        locateFile: file =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true
});

faceMesh.onResults(results => {

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {
        return;
    }

    const lm =
        results.multiFaceLandmarks[0];

    const mouthRatio =
        distance(
            lm[13],
            lm[14]
        ) /
        distance(
            lm[78],
            lm[308]
        );

    const leftEye =
        distance(
            lm[159],
            lm[145]
        ) /
        distance(
            lm[33],
            lm[133]
        );

    const rightEye =
        distance(
            lm[386],
            lm[374]
        ) /
        distance(
            lm[263],
            lm[362]
        );

    const eyeRatio =
        (
            leftEye +
            rightEye
        ) / 2;

    if (mouthRatio > 0.30) {
        jump();
    }

    if (eyeRatio < 0.15) {
        duck();
    }
});

async function initCamera() {

    try {

        const camera =
            new Camera(
                video,
                {
                    onFrame: async () => {
                        await faceMesh.send({
                            image: video
                        });
                    },
                    width: 640,
                    height: 480
                }
            );

        await camera.start();

        statusElement.textContent =
            "相機已啟動";
    }
    catch (error) {

        console.error(error);

        statusElement.textContent =
            "相機啟動失敗";
    }
}

initCamera();




