const video = document.getElementById("video");

const player = document.getElementById("player");

const scoreElement = document.getElementById("score");

const statusElement = document.getElementById("status");

const game = document.getElementById("game");

let score = 0;

let gameOver = false;

let jumping = false;

let ducking = false;

let obstacles = [];

function jump(){

    if(jumping) return;

    jumping = true;

    player.classList.add("jump");

    setTimeout(()=>{

        player.classList.remove("jump");

        jumping = false;

    },600);
}

function duck(){

    if(ducking) return;

    ducking = true;

    player.classList.add("duck");

    setTimeout(()=>{

        player.classList.remove("duck");

        ducking = false;

    },500);
}

function createObstacle(){

    if(gameOver) return;

    const obs = document.createElement("div");

    obs.classList.add("obstacle");

    obs.style.right = "-50px";

    game.appendChild(obs);

    obstacles.push(obs);
}

setInterval(createObstacle,2000);

function gameLoop(){

    if(gameOver) return;

    score++;

    scoreElement.textContent = score;

    obstacles.forEach((obs,index)=>{

        let right = parseInt(obs.style.right);

        right += 8;

        obs.style.right = right + "px";

        const x = 800 - right;

        if(x < 130 && x > 50){

            if(!jumping && !ducking){

                gameOver = true;

                statusElement.textContent =
                    "GAME OVER";

            }
        }

        if(right > 900){

            obs.remove();

            obstacles.splice(index,1);
        }
    });
}

setInterval(gameLoop,50);

document.getElementById("restart")
.addEventListener("click",()=>{

    location.reload();

});

function distance(a,b){

    return Math.hypot(
        a.x-b.x,
        a.y-b.y
    );
}

const faceMesh = new FaceMesh({

    locateFile:(file)=>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`

});

faceMesh.setOptions({

    maxNumFaces:1,
    refineLandmarks:true

});

faceMesh.onResults(results=>{

    if(
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length===0
    ){
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
        (leftEye+rightEye)/2;

    if(mouth > 0.30){

        jump();

    }

    if(eye < 0.15){

        duck();

    }
});

const camera = new Camera(video,{

    onFrame:async()=>{

        await faceMesh.send({
            image:video
        });

    },

    width:640,
    height:480

});

camera.start().then(()=>{

    statusElement.textContent =
        "張嘴跳躍｜閉眼下蹲";

});
