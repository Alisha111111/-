// --- 全域變數宣告 ---
let video, handpose, predictions = [];
let questions = [];
let current = 0, score = 0, showResult = false, lock = false;
let hoverA = false, hoverB = false, lastSelectTime = 0;
let timer = 10, timerStart = 0, timerActive = false;
let animProgress = 0, animDir = 1;
let showTip = false, tipText = "";
let bgHue = 200;
let selectAnim = {active: false, x: 0, y: 0, t: 0};
let lang = "zh-tw";
let imgs = [];
let gameStage = "start";
let startHover = false, startHoverStartTime = 0, startHoverCountdown = 3;
let showCorrectAnim = false, correctAnimT = 0;
let showWrongAnim = false, wrongAnimT = 0;
let okHover = false, okHoverStartTime = 0, okCountdown = 3;
let showReplay = false;
let replayShowTime = 0;

// 第二關：手勢收集狀態
let imgGestureMatched = [false, false, false, false];
let imgGestureAnimT = [0, 0, 0, 0];
let imgGestureTip = [
  "這是拳頭手勢！",
  "這是大拇指讚手勢！",
  "這是食指手勢！",
  "這是手掌張開手勢！"
];

// --- 題庫 ---
questions = [
  {
    q: { "zh-tw": "AI 教育的核心是？" },
    a: { "zh-tw": "個人化學習" },
    b: { "zh-tw": "填鴨式教學" },
    ans: "A",
    tip: { "zh-tw": "AI 教育強調依據學生需求調整學習內容。" }
  },
  {
    q: { "zh-tw": "STEAM 教育多了一個什麼？" },
    a: { "zh-tw": "藝術" },
    b: { "zh-tw": "數學" },
    ans: "A",
    tip: { "zh-tw": "STEAM = 科學、科技、工程、藝術、數學。" }
  },
  {
    q: { "zh-tw": "虛擬實境的英文縮寫？" },
    a: { "zh-tw": "VR" },
    b: { "zh-tw": "AR" },
    ans: "A",
    tip: { "zh-tw": "VR 是 Virtual Reality，AR 是 Augmented Reality。" }
    }
];

// --- 載入圖片 ---
function preload() {
  imgs[0] = loadImage('影像 4.jpg'); // 文學館
  imgs[1] = loadImage('影像 3.jpg'); // 教育館
  imgs[2] = loadImage('影像 7.jpg'); // 陳慶帆老師
}

// --- 初始化 ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);
  video = createCapture(VIDEO);
  video.size(windowWidth, windowHeight);
  video.hide();
  handpose = ml5.handpose(video, () => {});
  handpose.on("predict", results => predictions = results);
  textFont('Noto Sans TC');
  timerStart = millis();
  timerActive = false;
}

// --- 主迴圈 ---
function draw() {
  bgHue = (bgHue + 0.1) % 360;
  setGlassBg(bgHue);

  // 攝影機畫面全螢幕
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 60);
  image(video, 0, 0, width, height);
  pop();

  if (gameStage === "start") {
    drawStartScreen();
    handStartInteraction();
  } else if (gameStage === "level1") {
    if (!showResult) {
      animProgress += animDir * 0.05;
      animProgress = constrain(animProgress, 0, 1);
      drawQuestion(animProgress);
      handInteraction();
      drawTimer();
      if (showTip) drawTip();
      if (showCorrectAnim) drawCorrectAnim();
      if (showWrongAnim) drawWrongAnim();
    } else {
      drawResult();
    }
    if (selectAnim.active) drawSelectAnim();
  } else if (gameStage === "level2") {
    drawPairGame();

    if (!pairGameFinished && predictions.length > 0) {
      let idx = predictions[0].landmarks[8];
      let fx = width - idx[0];
      let fy = idx[1];
      let targetImgIdx = pairWords[currentPairIdx].imgIdx;
      let pos = imgPos[targetImgIdx];
      if (pairMatched[targetImgIdx] === null && dist(fx, fy, pos.x, pos.y) < 60) {
        highlightAnim[targetImgIdx] = 1;
        setTimeout(() => {
          pairMatched[targetImgIdx] = true;
          // 換下一個未配對的「詞語」index
          let remain = [];
          for (let j = 0; j < pairWords.length; j++) {
            if (pairMatched[pairWords[j].imgIdx] === null) remain.push(j);
          }
          if (remain.length > 0) {
            let next = floor(random(remain.length));
            currentPairIdx = remain[next];
          } else {
            pairGameFinished = true;
          }
        }, 200);
      }
    }
    // 自動亮下一個詞語（可選：每1.2秒自動換下一個）
    if (!pairGameFinished && typeof delayNextPair !== "undefined" && millis() - delayNextPair < 600) {
      // 暫停一會兒
    }
  }

  // 手部偵測數量顯示
  push();
  fill(0, 0, 100, 100);
  textSize(24);
  textAlign(LEFT, BOTTOM);
  text("手部偵測數量: " + predictions.length, 20, height - 20);
  pop();

  // OK手勢進入下一關
  if (showResult) {
    drawResult();
    okHover = false;
    if (predictions.length >= 1 && isOKGesture(predictions[0])) {
      okHover = true;
      if (okHoverStartTime === 0) okHoverStartTime = millis();
      let remain = okCountdown - (millis() - okHoverStartTime) / 1000;
      push();
      textAlign(CENTER, CENTER);
      textSize(32);
      fill(120, 80, 100, 200);
      text("比OK手勢進入下一關\n倒數：" + nf(remain, 1, 1), width/2, height/2+240);
      pop();
      if (remain <= 0) {
        gameStage = "level2";
        showResult = false;
        okHoverStartTime = 0;
        startLevel2();
      }
    } else {
      okHoverStartTime = 0;
    }
  }

  if (gameStage === "level1" && !lock && !showResult && predictions.length > 0) {
    let idx = predictions[0].landmarks[8];
    let fx = width - idx[0]; // 鏡像
    let fy = idx[1];

    // 選項A區域
    let ax = width/4, oy = 200, ow = 220, oh = 120;
    if (fx > ax-ow/2 && fx < ax+ow/2 && fy > oy && fy < oy+oh) {
      selectAnswer("A");
    }
    // 選項B區域
    let bx = width*3/4;
    if (fx > bx-ow/2 && fx < bx+ow/2 && fy > oy && fy < oy+oh) {
      selectAnswer("B");
    }

    // 畫圓點
    push();
    noStroke();
    // 深藦色（HSB: 220, 80, 60, 220），你可依需求再調整
    fill(220, 80, 60, 220);
    ellipse(fx, fy, 60, 60); // 大一點，原本36改60
    pop();
  }
}

// --- 關卡初始化 ---
function startLevel2() {
  // 詞語初始位置
  wordPos = [];
  imgPos = [];
  let imgW = 160, imgH = 160, gapX = 60;
  let startX = width/2 - (imgW*2 + gapX)/2 + imgW/2;
  let y = height/2 - 80;
  for (let i = 0; i < 3; i++) {
    imgPos.push({ x: startX + i * (imgW + gapX), y: y });
    wordPos.push({ x: width/2 - 160 + i*160, y: height - 100 });
  }
  let remain = [0,1,2];
  currentPairIdx = remain[floor(random(remain.length))];
  pairGameFinished = false;
  highlightAnim = [0, 0, 0];
  pairMatched = [null, null, null];
  pairGameStarted = false;
  currentPairIdx = null; // 不要一開始就選
  updatePairGameLayout();
}

// --- 工具 ---
function isOKGesture(pred) {
  if (!pred || !pred.landmarks) return false;
  let idxTip = pred.landmarks[8];
  let thumbTip = pred.landmarks[4];
  let dx = idxTip[0] - thumbTip[0];
  let dy = idxTip[1] - thumbTip[1];
  let d2 = dx*dx + dy*dy;
  return d2 < 80*80;
}

// --- 手勢判斷 ---
function isFist(pred) {
  let palm = pred.landmarks[0];
  let closed = 0;
  for (let i of [4, 8, 12, 16, 20]) {
    let tip = pred.landmarks[i];
    if (dist(tip[0], tip[1], palm[0], palm[1]) < 45) closed++;
  }
  return closed === 5;
}
function isThumbUp(pred) {
  let palm = pred.landmarks[0];
  let thumbTip = pred.landmarks[4];
  let up = thumbTip[1] < palm[1] - 40 && abs(thumbTip[0] - palm[0]) < 60;
  let closed = 0;
  for (let i of [8, 12, 16, 20]) {
    let tip = pred.landmarks[i];
    if (dist(tip[0], tip[1], palm[0], palm[1]) < 45) closed++;
  }
  return up && closed === 4;
}
function isIndex(pred) {
  let palm = pred.landmarks[0];
  let idxTip = pred.landmarks[8], idxPip = pred.landmarks[6];
  let idxStraight = idxTip[1] < idxPip[1] - 15 && dist(idxTip[0], idxTip[1], palm[0], palm[1]) > 65;
  let closed = 0;
  for (let i of [4, 12, 16, 20]) {
    let tip = pred.landmarks[i];
    if (dist(tip[0], tip[1], palm[0], palm[1]) < 45) closed++;
  }
  return idxStraight && closed === 4;
}
function isPalmOpen(pred) {
  let open = 0;
  for (let i = 0; i < 5; i++) {
    let tip = pred.landmarks[4 + i*4];
    let pip = pred.landmarks[2 + i*4];
    if (tip[1] < pip[1] - 10) open++;
  }
  return open === 5;
}

// --- 第二關主畫面（全新玩法）---
function drawPairGame() {
  // 鏡頭畫面
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 153);
  image(video, 0, 0, width, height);
  pop();

  // 背景半透明
  fill(210, 40, 95, 80);
  rect(0, 0, width, height);

  let boxW = 120, boxH = 70, imgW = 100, imgH = 100, gapY = 60;
  let startY = height/2 - (boxH*2 + gapY*1.5) - 40; // 往下移一點

  // 左側詞語直排
  for (let i = 0; i < 3; i++) {
    let x = 120, y = startY + i*(boxH+gapY);
    wordPos[i] = {x, y};
    push();
    rectMode(CENTER);
    stroke(0,0,100,60);
    strokeWeight(2);
    fill(i === currentPairIdx ? color(210,80,100,220) : color(0,0,100,180));
    rect(x, y, boxW, boxH, 16);
    fill(0,0,30,220);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(22);
    text(pairWords[i].label, x, y);
    pop();
  }

  // 右側圖片直排
  for (let i = 0; i < 3; i++) {
    let x = width-300, y = startY + i*(boxH+gapY);
    imgPos[i] = {x, y};
    let anim = highlightAnim[i];
    push();
    rectMode(CENTER);
    imageMode(CENTER);
    let scaleAmt = 1 + 0.15 * anim;
    translate(x, y);
    scale(scaleAmt);
    stroke(210, 80, 100, 100);
    strokeWeight(3);
    fill(0, 0, 100, 40);
    rect(0, 0, imgW, imgH, 20);
    if (imgs[i]) {
      image(imgs[i], 0, 0, imgW-10, imgH-10);
    }
    // 正確打勾，錯誤打叉
    if (pairMatched[i] === true) {
      stroke(120, 80, 100, 220);
      strokeWeight(6);
      noFill();
      beginShape();
      vertex(-20, 10);
      vertex(-5, 25);
      vertex(25, -15);
      endShape();
    } else if (pairMatched[i] === false) {
      stroke(0, 80, 100, 220);
      strokeWeight(6);
      line(-20, -20, 20, 20);
      line(-20, 20, 20, -20);
    }
    pop();
    // 動畫遞減
    if (highlightAnim[i] > 0) highlightAnim[i] -= 0.08;
  }

  // 等待玩家開始
  if (!pairGameStarted) {
    push();
    fill(0,0,100,220);
    textAlign(CENTER, CENTER);
    textSize(36);
    text("請點擊畫面或比OK手勢開始配對", width/2, height/2);
    pop();

    if (predictions.length > 0 && isOKGesture(predictions[0])) {
      pairGameStarted = true;
      let remain = [];
      for (let j = 0; j < pairWords.length; j++) {
        if (pairMatched[j] !== true) remain.push(j);
      }
      currentPairIdx = remain[floor(random(remain.length))];
    }
    if (mouseIsPressed) {
      pairGameStarted = true;
      let remain = [];
      for (let j = 0; j < pairWords.length; j++) {
        if (pairMatched[j] !== true) remain.push(j);
      }
      currentPairIdx = remain[floor(random(remain.length))];
    }
    return;
  }

  // 食指圓點與配對互動
  if (!pairGameFinished && predictions.length > 0) {
    let idx = predictions[0].landmarks[8];
    let fx = width - idx[0];
    let fy = idx[1];
    push();
    noStroke();
    fill(220, 80, 60, 220);
    ellipse(fx, fy, 60, 60);
    pop();

    // 只允許配對目前亮燈的詞語
    let targetImgIdx = pairWords[currentPairIdx].imgIdx;
    let pos = imgPos[targetImgIdx];
    // 只允許還沒配對過的圖片
    if (pairMatched[targetImgIdx] === null && dist(fx, fy, pos.x, pos.y) < 60) {
      highlightAnim[targetImgIdx] = 1;
      setTimeout(() => {
        pairMatched[targetImgIdx] = true;
        // 換下一個未配對的詞語
        let remain = [];
        for (let j = 0; j < pairWords.length; j++) {
          if (pairMatched[pairWords[j].imgIdx] !== true) remain.push(j);
        }
        if (remain.length > 0) {
          let next = floor(random(remain.length));
          currentPairIdx = remain[next];
        } else {
          pairGameFinished = true;
        }
      }, 200);
    }
  }

  // 全部配對成功
  if (pairGameFinished) {
    push();
    textAlign(CENTER, CENTER);
    textSize(48);
    fill(120, 80, 100, 220);
    stroke(0, 0, 100, 80);
    strokeWeight(8);
    text("恭喜！全部配對成功！", width/2, height/2);
    pop();

    // 一秒後顯示再玩一次按鈕
    if (!showReplay) {
      replayShowTime = millis();
      showReplay = true;
    }
    if (showReplay && millis() - replayShowTime > 1000) {
      push();
      rectMode(CENTER);
      fill(210, 80, 100, 220);
      stroke(0, 0, 100, 80);
      strokeWeight(4);
      rect(width/2, height/2 + 100, 220, 60, 18);
      fill(0, 0, 30, 220);
      noStroke();
      textSize(32);
      textAlign(CENTER, CENTER);
      text("再玩一次", width/2, height/2 + 100);
      pop();
    }
  }
}
  

// --- 第二關手勢互動 ---
function handImgPairInteraction() {
  if (predictions.length < 1) return;
  let pred = predictions[0];

  let idx = -1;
  if (isFist(pred))      idx = 0;
  else if (isThumbUp(pred))   idx = 1;
  else if (isIndex(pred))     idx = 2;
  else if (isPalmOpen(pred))  idx = 3;

  if (idx !== -1 && !imgGestureMatched[idx]) {
    imgGestureMatched[idx] = true;
    imgGestureAnimT[idx] = 1.2; // 動畫時間
  }
}

// --- 第一關手勢互動 ---
function handInteraction() {
  // 第一關用手勢選擇答案
  if (lock || showResult) return;
  if (predictions.length < 1) return;
  let pred = predictions[0];

  // 比「讚」選A，比「食指」選B
  if (isThumbUp(pred)) {
    selectAnswer("A");
  } else if (isIndex(pred)) {
    selectAnswer("B");
  }
}

// --- 畫面繪製 ---
function setGlassBg(hue) {
  background(hue, 40, 95);
  noStroke();
  for (let i = 0; i < 10; i++) {
    fill((hue + i * 20) % 360, 40, 100, 10);
    ellipse(random(width), random(height), random(80, 200));
  }
}
function drawStartScreen() {
  // 動態背景圓點特效
  for (let i = 0; i < 8; i++) {
    let t = millis() * 0.0005 + i;
    let x = width/2 + cos(t*2+i)*320 + sin(t*3+i)*60;
    let y = height/2 + sin(t*2+i)*180 + cos(t*3+i)*40;
    noStroke();
    fill(210 + i*10, 60, 100, 18);
    ellipse(x, y, 120 + sin(t*2)*40, 120 + cos(t*2)*40);
  }

  // 標題字：大、漸層、陰影
  push();
  textAlign(CENTER, CENTER);
  textSize(72);
  drawingContext.shadowColor = 'rgba(80,120,255,0.6)';
  drawingContext.shadowBlur = 32;
  let grad = drawingContext.createLinearGradient(width/2-200, height/2-120, width/2+200, height/2-120);
  grad.addColorStop(0, "#6ec6ff");
  grad.addColorStop(1, "#b388ff");
  drawingContext.fillStyle = grad;
  textStyle(BOLD);
  text("遊戲開始", width/2, height/2 - 120);
  drawingContext.shadowBlur = 0;
  pop();

  // 說明文字
  push();
  textAlign(CENTER, CENTER);
  textSize(28);
  fill(210, 60, 100, 90);
  text("請用手指碰觸下方藍色圓圈，倒數結束自動進入", width/2, height/2 - 60);
  pop();

  // 進入按鈕圓圈（藍色特效）
  let cx = width/2, cy = height/2 + 60, r = 100;
  push();
  drawingContext.shadowColor = 'rgba(80,120,255,0.5)';
  drawingContext.shadowBlur = 40;
  stroke(210, 80, 100, 100);
  strokeWeight(14);
  fill(210, 30, 100, 90);
  ellipse(cx, cy, r*2, r*2);
  drawingContext.shadowBlur = 0;
  pop();

  // 進入文字
  push();
  textAlign(CENTER, CENTER);
  textSize(40);
  textStyle(BOLD);
  fill(0, 0, 100, 255);
  drawingContext.shadowColor = 'rgba(80,120,255,0.7)';
  drawingContext.shadowBlur = 12;
  text("進入", cx, cy);
  drawingContext.shadowBlur = 0;
  pop();

  // 倒數顯示
  if (startHover) {
    let remain = startHoverCountdown - (millis() - startHoverStartTime) / 1000;
    remain = max(0, remain);
    push();
    textAlign(CENTER, CENTER);
    textSize(36);
    fill(210, 80, 100, 255);
    stroke(0, 0, 100, 255);
    strokeWeight(3);
    textStyle(BOLD);
    text(nf(remain, 1, 1), cx, cy);
    pop();
  }

  // 左上角標題
  push();
  textAlign(LEFT, TOP);
  textSize(28);
  textStyle(BOLD);
  fill(0, 0, 100, 255); // 白色
  text("教科一A 413730218 王芊晴 期末作品", 32, 24);
  pop();
}
function handStartInteraction() {
  let cx = width/2, cy = height/2 + 60, r = 100;
  startHover = false;
  if (predictions.length >= 1) {
    let idx = predictions[0].landmarks[8];
    let fx = width - idx[0];
    let fy = idx[1];

    // 畫手指圓點
    push();
    stroke(330, 60, 80, 100);
    strokeWeight(12);
    fill(340, 30, 100, 95);
    ellipse(fx, fy, 80, 80);
    pop();

    // 判斷是否碰到圓圈
    if (dist(fx, fy, cx, cy) < r) {
      startHover = true;
      if (startHoverStartTime === 0) startHoverStartTime = millis();
      let remain = startHoverCountdown - (millis() - startHoverStartTime) / 1000;
      if (remain <= 0) {
        gameStage = "level1";
        timerActive = true;
        timerStart = millis();
        startHoverStartTime = 0;
      }
    } else {
      startHoverStartTime = 0;
    }
  } else {
    startHoverStartTime = 0;
  }
}
function drawQuestion(anim) {
  push();
  translate(0, (1 - anim) * 60);

  // 題目白底區塊（維持原本）
  fill(0, 0, 100, 230);
  noStroke();
  rectMode(CENTER);
  rect(width/2, 100, 600, 120, 28);
  rectMode(CORNER);

  // 題目
  fill(0, 0, 30, 80);
  textSize(32);
  textAlign(CENTER, TOP);
  text(questions[current].q[lang], width/2, 40);

  let ax = width/4, bx = width*3/4, oy = 200, ow = 220, oh = 120;
  drawGlassOption(ax, oy, ow, oh, "A", questions[current].a[lang], hoverA, selectAnim.active && selectAnim.opt === "A");
  drawGlassOption(bx, oy, ow, oh, "B", questions[current].b[lang], hoverB, selectAnim.active && selectAnim.opt === "B");

  // === 分數白底與分數移到左上角 ===
  fill(0, 0, 100, 230);
  noStroke();
  rect(30, 30, 170, 50, 16);

  // 分數與題號
  textSize(18);
  fill(0, 0, 30, 80);
  textAlign(LEFT, TOP);
  text("分數：" + score, 40, 36);
  text("第 " + (current+1) + " / " + questions.length + " 題", 40, 62);

  pop();
}
function drawGlassOption(x, y, w, h, label, textStr, hover, selected) {
  push();
  translate(x, y);
  drawingContext.shadowBlur = hover ? 40 : 20;
  drawingContext.shadowColor = hover ? 'rgba(120,180,255,0.5)' : 'rgba(180,180,255,0.2)';
  fill(210, 30, 100, hover ? 60 : 40);
  stroke(hover ? color(210,80,100,80) : color(210, 30, 100, 40));
  strokeWeight(hover ? 6 : 3);
  rect(-w/2, 0, w, h, 36);
  if (hover) scale(1.08);
  fill(0, 0, 30, 90);
  noStroke();
  textSize(36);
  textAlign(LEFT, CENTER);
  text(label, -w/2 + 24, h/2);
  textSize(28);
  text(textStr, -w/2 + 70, h/2);
  if (selected) {
    stroke(120, 80, 100, 100);
    strokeWeight(6);
    noFill();
    beginShape();
    vertex(-w/2 + 60, h/2 + 10);
    vertex(-w/2 + 80, h/2 + 30);
    vertex(-w/2 + 110, h/2 - 10);
    endShape();
  }
  pop();
}
function drawResult() {
  background(210, 40, 95);
  fill(0, 0, 30, 90);
  textAlign(CENTER, CENTER);
  textSize(44);
  text("第一關結束！", width/2, height/2-80);
  textSize(32);
  text("你的分數：" + score + " / " + questions.length, width/2, height/2-20);
  textSize(22);
  text("請比OK手勢3秒進入下一關", width/2, height/2+30);

  if (score === questions.length) {
    fill(120, 80, 100, 100);
    ellipse(width/2, height/2+100, 80, 80);
    fill(0, 0, 30, 100);
    textSize(24);
    text("滿分徽章", width/2, height/2+100);
  }
}
function drawCorrectAnim() {
  correctAnimT += 0.08;
  push();
  textAlign(CENTER, CENTER);
  textSize(80 + sin(correctAnimT) * 10);
  fill(120, 80, 100, 90 - correctAnimT * 40);
  stroke(0, 0, 100, 80 - correctAnimT * 40);
  strokeWeight(8);
  text("答對了！正確！", width/2, height/2);
  pop();
  if (correctAnimT > 2) showCorrectAnim = false;
}
function drawWrongAnim() {
  wrongAnimT += 0.08;
  push();
  textAlign(CENTER, CENTER);
  textSize(80 + sin(wrongAnimT) * 10);
  fill(0, 80, 100, 90 - wrongAnimT * 40);
  stroke(0, 0, 100, 80 - wrongAnimT * 40);
  strokeWeight(8);
  text("答錯了！再接再厲！", width/2, height/2);
  pop();
  if (wrongAnimT > 2) showWrongAnim = false;
}
function drawTip() {
  push();
  let boxW = 340, boxH = 100;
  let boxX = width - boxW - 30;
  let boxY = height - boxH - 30;
  fill(0, 0, 100, 90);
  stroke(210, 80, 100, 60);
  strokeWeight(2);
  rect(boxX, boxY, boxW, boxH, 18);
  fill(210, 80, 100, 100);
  noStroke();
  textSize(18);
  textAlign(LEFT, TOP);
  text("知識補充：\n" + tipText, boxX + 20, boxY + 12, boxW - 24, boxH - 16);
  pop();
}
function drawTimer() {
  if (!timerActive) return;
  let elapsed = (millis() - timerStart) / 1000;
  let remain = max(0, 10 - elapsed);
  fill(210, 80, 100, 60);
  noStroke();
  rect(0, height - 18, map(remain, 0, 10, 0, width), 18, 12);
  fill(0, 0, 30, 90);
  textSize(18);
  textAlign(RIGHT, BOTTOM);
  text("倒數：" + nf(remain, 2, 1) + " 秒", width - 40, height - 22);
  if (remain <= 0 && !lock) {
    lock = true;
    setTimeout(() => {
      current++;
      lock = false;
      showTip = false;
      timer = 10;
      timerStart = millis();
      if (current >= questions.length) showResult = true;
    }, 800);
  }
}
function drawSelectAnim() {
  selectAnim.t += 0.1;
  if (selectAnim.t > 1) selectAnim.active = false;
}
function selectAnswer(select) {
  timerActive = false;
  lock = true;
  lastSelectTime = millis();
  let correct = (select === questions[current].ans);
  if (correct) {
    score++;
    tipText = questions[current].tip[lang];
    showTip = true;
    showCorrectAnim = true;
    correctAnimT = 0;
  } else {
    tipText = "再接再厲！";
    showTip = true;
    showWrongAnim = true;
    wrongAnimT = 0;
  }
  selectAnim = {active: true, opt: select, t: 0};
  setTimeout(() => {
    current++;
    lock = false;
    showTip = false;
    selectAnim.active = false;
    showCorrectAnim = false;
    showWrongAnim = false;
    correctAnimT = 0;
    wrongAnimT = 0;
    timer = 10;
    timerStart = millis();
    timerActive = true;
    if (current >= questions.length) showResult = true;
  }, 1200);
}
function mousePressed() {
  if (showResult && mouseX > width/2-80 && mouseX < width/2+80 && mouseY > height/2+160 && mouseY < height/2+208) {
    current = 0;
    score = 0;
    showResult = false;
    lock = false;
    timer = 10;
    timerStart = millis();
    showTip = false;
    selectAnim.active = false;
  }
  // 再玩一次按鈕
  if (showReplay && millis() - replayShowTime > 1000) {
    let bx = width/2, by = height/2 + 100, bw = 220, bh = 60;
    if (mouseX > bx-bw/2 && mouseX < bx+bw/2 && mouseY > by-bh/2 && mouseY < by+bh/2) {
      // 重設所有狀態
      showReplay = false;
      replayShowTime = 0;
      gameStage = "level1";
      current = 0;
      score = 0;
      showResult = false;
      lock = false;
      timer = 10;
      timerStart = millis();
      showTip = false;
      selectAnim.active = false;
      pairGameFinished = false;
      pairGameStarted = false;
      currentPairIdx = null;
      pairMatched = [null, null, null];
      highlightAnim = [0, 0, 0];
      updatePairGameLayout();
    }
  }
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (video) video.size(windowWidth, windowHeight);

  // 重新計算第二關的圖片與詞語位置
  updatePairGameLayout();
}

// --- 手勢圖示 ---
function drawHandIcon(x, y, type) {
  push();
  translate(x, y);
  stroke(0,0,30,180);
  strokeWeight(2);
  fill(0,0,100,240);
  ellipse(0, 0, 38, 38); // 掌心
  if (type === "fist") {
    for (let i=0; i<5; i++) ellipse(cos(PI/2+i*PI/5)*14, sin(PI/2+i*PI/5)*14-8, 10, 10);
  } else if (type === "thumb") {
    ellipse(-12, -18, 10, 18);
    for (let i=1; i<5; i++) ellipse(cos(PI/2+i*PI/5)*14, sin(PI/2+i*PI/5)*14-8, 10, 10);
  } else if (type === "index") {
    ellipse(0, -20, 10, 22);
    for (let i=0; i<5; i++) if(i!==1) ellipse(cos(PI/2+i*PI/5)*14, sin(PI/2+i*PI/5)*14-8, 10, 10);
  } else if (type === "palm") {
    for (let i=0; i<5; i++) ellipse(cos(PI/2+i*PI/5)*18, sin(PI/2+i*PI/5)*18-12, 10, 22);
  }
  pop();
}

// --- 配對遊戲變數 ---
let pairWords = [
  { label: "文學館", imgIdx: 0 },
  { label: "教育館", imgIdx: 1 },
  { label: "陳慶帆老師", imgIdx: 2 }
  // { label: "顧大維老師", imgIdx: 3 } // 刪除
];
let wordPos = [];
let imgPos = [];
let pairMatched = [null, null, null]; // 只剩三個
let currentPairIdx = 0;
let pairGameFinished = false;
let highlightAnim = [0, 0, 0];
let pairGameStarted = false;

// --- 更新配對遊戲佈局 ---
function updatePairGameLayout() {
  let boxH = 70, gapY = 60;
  let startY = height/2 - (boxH*2 + gapY*1.5) - 40; // 往下移一點（原本-90）
  for (let i = 0; i < 3; i++) {
    if (wordPos[i]) {
      wordPos[i].x = 120;
      wordPos[i].y = startY + i*(boxH+gapY);
    }
    if (imgPos[i]) {
      imgPos[i].x = width-300;
      imgPos[i].y = startY + i*(boxH+gapY);
    }
  }
}

