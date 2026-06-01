const video = document.getElementById("video");
const player = document.getElementById("player");
const scoreElement = document.getElementById("score");
const statusElement = document.getElementById("status");
const game = document.getElementById("game");

let score = 0;
let gameOver = false;

let jumping = false;
let ducking = false;

let speed = 8;

let obstacles = [];

function jump() {

    if (jumping || gameOver) return;

    jumping = true;

    player.classList.add("jump");

    setTimeout(() => {

        player.classList.remove("jump");

        jumping = false;

    }, 600);
}

function duck() {

    if (ducking || gameOver) return;

    ducking = true;

    player.classList.add("duck");

    setTimeout(() => {

        player.classList.remove("duck");

        ducking = false;

    }, 500);
}

function createObstacle() {

    if (gameOver) return;

    const obstacle =
        document.createElement("div");

    obstacle.classList.add("obstacle");

    const type =
        Math.random() > 0.5
            ? "jump"
            : "duck";

    obstacle.dataset.type = type;

    if(type === "jump"){

        obstacle.innerHTML = "🌵";

        obstacle.style.height = "70px";

        obstacle.style.bottom = "0px";

    }
    else{

        obstacle.innerHTML = "🦅";

        obstacle.style.height = "40px";

        obstacle.style.bottom = "130px";
    }

    obstacle.style.background = "transparent";
    obstacle.style.fontSize = "40px";
    obstacle.style.right = "-50px";

    game.appendChild(obstacle);

    obstacles.push(obstacle);
}

let obstacleTimer =
    setInterval(createObstacle, 1800);

function gameLoop() {

    if (gameOver) {

        return;
    }

    score++;

    scoreElement.textContent = score;

    if (score % 500 === 0) {

        speed += 1;
    }

    obstacles.forEach((obs, index) => {

        let right =
            parseInt(obs.style.right);

        right += speed;

        obs.style.right =
            right + "px";

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
                !jumping
            ){

                gameOver = true;
            }

            if(
                type === "duck"
                &&
                !ducking
            ){

                gameOver = true;
            }

            if(gameOver){

                const best =
                    Math.max(
                        score,
                        Number(
                            localStorage.getItem(
                                "bestScore"
                            ) || 0
                        )
                    );

                localStorage.setItem(
                    "bestScore",
                    best
                );

                statusElement.textContent =
                    `💀 GAME OVER | 本次 ${score} | 最高 ${best}`;

                clearInterval(
                    obstacleTimer
                );
            }
        }

        if (right > 1500) {

            obs.remove();

            obstacles.splice(index, 1);
        }
    });

    requestAnimationFrame(gameLoop);
}

function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}

const faceMesh = new FaceMesh({

    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`

});

faceMesh.setOptions({

    maxNumFaces: 1,
    refineLandmarks: true

});

faceMesh.onResults((results) => {

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {
        return;
    }

    const lm =
        results.multiFaceLandmarks[0];

    const mouth =

        distance(
            lm[13],
            lm[14]
        )

        /

        distance(
            lm[78],
            lm[308]
        );

    const leftEye =

        distance(
            lm[159],
            lm[145]
        )

        /

        distance(
            lm[33],
            lm[133]
        );

    const rightEye =

        distance(
            lm[386],
            lm[374]
        )

        /

        distance(
            lm[263],
            lm[362]
        );

    const eye =
        (leftEye + rightEye) / 2;

    if (mouth > 0.30) {

        jump();
    }

    if (eye < 0.15) {

        duck();
    }
});

const camera = new Camera(video, {

    onFrame: async () => {

        await faceMesh.send({
            image: video
        });
    },

    width: 640,
    height: 480

});

camera.start().then(() => {

    const best =
        localStorage.getItem(
            "bestScore"
        ) || 0;

    statusElement.textContent =
        `😆 張嘴跳躍｜😑 閉眼下蹲｜🏆最高 ${best}`;
});

document
    .getElementById("restart")
    .addEventListener("click", () => {

        location.reload();
    });

requestAnimationFrame(gameLoop);
