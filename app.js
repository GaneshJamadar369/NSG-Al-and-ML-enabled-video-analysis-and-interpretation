// // app.js — Multi-Cam NSG demo
// // NOTE: Browser can access only one physical webcam at once. For Drone/Hidden use uploaded video or IP streams.

// const SUSPICIOUS = new Set(['knife','scissors','gun','punch','angry person']); // coco classes
// const cams = ['cctv','drone','hidden'];
// const modelState = { model: null };

// const alertSound = document.getElementById('alertSound');
// const modelStatus = document.getElementById('modelStatus');
// const fpsEl = document.getElementById('fps');
// const alertsList = document.getElementById('alertsList');
// const logBody = document.getElementById('logBody');

// let frameCount = 0, lastTS = performance.now();
// async function loadModel(){
//   try{
//     modelState.model = await cocoSsd.load();
//     modelStatus.textContent = 'Ready';
//     modelStatus.style.color = '#8ef';
//     startDetectionLoop();
//   }catch(e){
//     modelStatus.textContent = 'Error';
//     console.error(e);
//   }
// }
// loadModel();

// // per-camera state
// const state = {};
// cams.forEach(id=>{
//   state[id] = {
//     video: document.querySelector(`.cam-video[data-cam="${id}"]`),
//     overlay: document.querySelector(`.overlay[data-cam="${id}"]`),
//     radar: document.querySelector(`.radar-small[data-cam="${id}"]`),
//     statusBadge: document.getElementById(`status-${id}`),
//     meta: document.getElementById(`meta-${id}`),
//     tamperEl: document.getElementById(`tamper-${id}`),
//     mediaStream: null,
//     mediaRecorder: null,
//     recordedBlobs: [],
//     lastFrameData: null,
//     tamperCounter: 0,
//     running: false
//   };
// });

// // helpers
// function addAlert(text){
//   const li = document.createElement('li'); li.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
//   alertsList.prepend(li);
//   setTimeout(()=>li.remove(),30000);
// }
// function log(cam,label,score){
//   const tr = document.createElement('tr');
//   tr.innerHTML = `<td>${new Date().toLocaleTimeString()}</td><td>${cam}</td><td>${label}</td><td>${(score*100).toFixed(1)}%</td>`;
//   logBody.prepend(tr);
//   while(logBody.children.length>300) logBody.removeChild(logBody.lastChild);
// }

// // start/stop per-cam
// document.querySelectorAll('.cam-card .start').forEach(btn=>{
//   btn.addEventListener('click', ()=>startCam(btn.dataset.cam));
// });
// document.querySelectorAll('.cam-card .stop').forEach(btn=>{
//   btn.addEventListener('click', ()=>stopCam(btn.dataset.cam));
// });
// document.querySelectorAll('.cam-card .upload').forEach(input=>{
//   input.addEventListener('change', (e)=>loadFileToCam(e.target.files[0], input.dataset.cam));
// });
// document.getElementById('startAll').addEventListener('click', ()=>cams.forEach(c=>startCam(c)));
// document.getElementById('stopAll').addEventListener('click', ()=>cams.forEach(c=>stopCam(c)));
// document.getElementById('snapshotAll').addEventListener('click', ()=>cams.forEach(c=>snapshotCam(c)));

// function setBadge(cam,txt,cls){
//   const el = state[cam].statusBadge;
//   el.textContent = txt;
//   // color classes (simple)
//   el.style.background = cls==='on' ? 'rgba(0,200,100,0.08)' : 'rgba(255,0,0,0.04)';
// }

// // startCam: for CCTV try getUserMedia; for others expect file upload or URL
// async function startCam(cam){
//   const s = state[cam];
//   if (s.running) return;
//   try{
//     if (cam==='cctv'){
//       // try getUserMedia (may conflict if another cam already using the same device)
//       const stream = await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}, audio:false});
//       s.mediaStream = stream;
//       s.video.srcObject = stream;
//       await s.video.play();
//     } else {
//       // for drone/hidden: if video already has src (from upload), play; otherwise show placeholder
//       if (!s.video.srcObject && !s.video.src) {
//         // no source — use a sample fallback (small embedded silent mp4 data or blank)
//         s.video.src = '';
//       }
//       await s.video.play().catch(()=>{});
//     }
//     s.running = true; setBadge(cam,'ON','on');
//     s.meta.textContent = 'Running';
//     startRecordingIfRequested(cam);
//   }catch(e){
//     console.error('startCam error',e);
//     addAlert(`Failed to start ${cam}: ${e.message||e}`);
//     s.meta.textContent = 'Error';
//     setBadge(cam,'ERR','off');
//   }
// }

// // stop cam and stop tracks
// function stopCam(cam){
//   const s = state[cam];
//   if (!s.running) return;
//   if (s.mediaStream){
//     s.mediaStream.getTracks().forEach(t=>t.stop());
//     s.mediaStream = null;
//   }
//   try{s.video.pause(); s.video.srcObject = null; }catch(e){}
//   s.running = false; setBadge(cam,'OFF','off'); s.meta.textContent='Stopped';
//   // stop recording
//   if (s.mediaRecorder && s.mediaRecorder.state!=='inactive') s.mediaRecorder.stop();
// }

// // load uploaded file to cam
// function loadFileToCam(file, cam){
//   if (!file) return;
//   const url = URL.createObjectURL(file);
//   const s = state[cam];
//   stopCam(cam);
//   s.video.srcObject = null;
//   s.video.src = url;
//   s.video.onloadedmetadata = ()=>{ s.video.play(); s.running=true; setBadge(cam,'ON','on'); s.meta.textContent='File playback'; };
// }

// // snapshot per cam
// function snapshotCam(cam){
//   const s = state[cam];
//   const overlay = s.overlay;
//   const v = s.video;
//   if (!v || v.readyState<2) return;
//   const c = document.createElement('canvas'); c.width = overlay.width; c.height=overlay.height;
//   const ctx = c.getContext('2d');
//   ctx.drawImage(v,0,0,c.width,c.height);
//   ctx.drawImage(overlay,0,0);
//   const a = document.createElement('a'); a.href=c.toDataURL('image/png'); a.download=`snap_${cam}_${Date.now()}.png`; a.click();
// }

// // recording
// function startRecordingIfRequested(cam){
//   const s = state[cam];
//   // simple toggle via button: start on first click, stop on next
//   const recBtn = document.querySelector(`.cam-card .record[data-cam="${cam}"]`);
//   recBtn.onclick = ()=>{
//     if (!s.mediaRecorder || s.mediaRecorder.state==='inactive'){
//       // create MediaRecorder from stream if available or from canvas capture
//       let targetStream = s.mediaStream;
//       if (!targetStream){
//         // fallback: capture canvas combined (video + overlay)
//         const cap = s.video.captureStream ? s.video.captureStream() : null;
//         targetStream = cap || null;
//       }
//       if (!targetStream){ addAlert(`Cannot record ${cam} — no stream`); return; }
//       s.recordedBlobs = [];
//       try{
//         s.mediaRecorder = new MediaRecorder(targetStream, {mimeType:'video/webm;codecs=vp9'});
//       }catch(e){
//         s.mediaRecorder = new MediaRecorder(targetStream);
//       }
//       s.mediaRecorder.ondataavailable = e=>{ if (e.data && e.data.size) s.recordedBlobs.push(e.data); };
//       s.mediaRecorder.onstop = ()=>{
//         const blob = new Blob(s.recordedBlobs, {type:'video/webm'});
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement('a'); a.href=url; a.download=`record_${cam}_${Date.now()}.webm`; a.click();
//       };
//       s.mediaRecorder.start();
//       recBtn.textContent='Stop Rec';
//       addAlert(`${cam} recording started`);
//     } else {
//       s.mediaRecorder.stop();
//       recBtn.textContent='Record';
//       addAlert(`${cam} recording stopped`);
//     }
//   };
// }

// // simple tamper detection via frame-diff: if little change for N frames => tamper
// function analyzeTamperAndDraw(cam, predictions){
//   const s = state[cam];
//   const v = s.video;
//   const overlay = s.overlay;
//   const ctx = overlay.getContext('2d');
//   overlay.width = v.videoWidth || v.clientWidth;
//   overlay.height = v.videoHeight || v.clientHeight;
//   ctx.clearRect(0,0,overlay.width,overlay.height);
//   ctx.lineWidth = 2;

//   // draw predictions & logs
//   let found = [];
//  predictions.forEach(p=>{
//     const [x,y,w,h] = p.bbox;
//     ctx.strokeStyle = SUSPICIOUS.has(p.class) ? 'rgba(255,59,59,0.95)' : 'rgba(140,200,255,0.9)';
//     ctx.strokeRect(x,y,w,h);

//     const text = `${p.class} ${(p.score*100).toFixed(0)}%`;
//     ctx.fillStyle = ctx.strokeStyle;
//     ctx.fillRect(x,y-20, ctx.measureText ? ctx.measureText(text).width+8 : 80, 18);
//     ctx.fillStyle = '#111';
//     ctx.fillText(text, x+4, y-6);

//     // alert & log if suspicious
//     if (SUSPICIOUS.has(p.class) && p.score>0.45){
//         addAlert(`${cam.toUpperCase()}: Suspicious ${p.class} ${(p.score*100).toFixed(1)}%`);
//         log(cam,p.class,p.score);
//         try{ alertSound.play().catch(()=>{}); }catch(e){}
//     }
// });

//   // motion/tamper detection: sample current frame and compare to lastFrameData
//   try{
//     const tmp = document.createElement('canvas'); tmp.width=overlay.width; tmp.height=overlay.height;
//     const tctx = tmp.getContext('2d'); tctx.drawImage(v,0,0,tmp.width,tmp.height);
//     const img = tctx.getImageData(0,0,tmp.width,tmp.height);
//     if (s.lastFrameData){
//       // compute small diff on subsampled pixels
//       let diff=0, count=0;
//       for (let i=0;i<img.data.length;i+=4*20){ // step to reduce cost
//         const d = Math.abs(img.data[i]-s.lastFrameData.data[i]) + Math.abs(img.data[i+1]-s.lastFrameData.data[i+1]) + Math.abs(img.data[i+2]-s.lastFrameData.data[i+2]);
//         if (d>30) diff++;
//         count++;
//       }
//       const motionRatio = diff/count;
//       s.meta.textContent = `motion:${(motionRatio*100).toFixed(1)}%`;
//       if (motionRatio < 0.02){
//         s.tamperCounter++;
//       } else {
//         s.tamperCounter = 0;
//       }
//       if (s.tamperCounter>30){
//         s.tamperEl.textContent='TAMPERED';
//         s.tamperEl.style.color='#ff9b9b';
//         addAlert(`${cam.toUpperCase()} possible tamper / freeze`);
//       } else {
//         s.tamperEl.textContent='OK';
//         s.tamperEl.style.color='#9af';
//       }
//     }
//     s.lastFrameData = img;
//   }catch(e){
//     // ignore
//   }
// }

// // detection loop — runs for all cams
// function startDetectionLoop(){
//   async function step(){
//     if (!modelState.model){ requestAnimationFrame(step); return; }
//     for (const cam of cams){
//       const s = state[cam];
//       if (!s.running) continue;
//       // ensure sizes
//       const v = s.video;
//       if (v.readyState < 2) continue;
//       try{
//         const preds = await modelState.model.detect(v, 8);
//         analyzeTamperAndDraw(cam, preds);
//       }catch(e){ console.error('detect',cam,e); }
//     }
//     // FPS calc
//     frameCount++;
//     const now = performance.now();
//     if (now - lastTS >= 1000){
//       fpsEl.textContent = frameCount;
//       frameCount = 0; lastTS = now;
//     }
//     requestAnimationFrame(step);
//   }
//   requestAnimationFrame(step);
// }

// // per-cam snapshot buttons
// document.querySelectorAll('.cam-card .snap').forEach(b=>{
//   b.addEventListener('click', ()=>snapshotCam(b.dataset.cam));
// });

// // battery / altitude / sliders update meta display
// document.querySelectorAll('.alt').forEach(el=>{
//   el.addEventListener('input', e=>{ const cam = e.target.dataset.cam; document.getElementById(`meta-${cam}`).textContent = `alt:${e.target.value}m`; });
// });
// document.querySelectorAll('.battery').forEach(el=>{
//   el.addEventListener('input', e=>{ const cam = e.target.dataset.cam; document.getElementById(`meta-${cam}`).textContent = `bat:${e.target.value}%`; 
//     if (Number(e.target.value) < 15) addAlert(`${cam.toUpperCase()} low battery (${e.target.value}%)`);
//   });
// });

// // file inputs: attach to proper cam
// // (already wired above via loadFileToCam when change triggers)

// // export logs
// // alert & log if suspicious
// if (SUSPICIOUS.has(p.class) && p.score > 0.45) {
//   const timestamp = new Date().toLocaleTimeString();
  
//   // 1️⃣  Alert + log
//   addAlert(`${cam.toUpperCase()} — ${p.class.toUpperCase()} detected @ ${timestamp}`);
//   log(cam, p.class, p.score);

//   // 2️⃣  Play siren sound
//   try {
//     alertSound.currentTime = 0;
//     alertSound.play().catch(() => {});
//   } catch (e) { console.warn("Sound error", e); }

//   // 3️⃣  Auto snapshot of that camera
//   try {
//     const snapCanvas = document.createElement('canvas');
//     snapCanvas.width = v.videoWidth;
//     snapCanvas.height = v.videoHeight;
//     const snapCtx = snapCanvas.getContext('2d');
//     snapCtx.drawImage(v, 0, 0, snapCanvas.width, snapCanvas.height);
//     snapCtx.drawImage(overlay, 0, 0); // include overlay boxes
//     const imageData = snapCanvas.toDataURL('image/png');

//     const link = document.createElement('a');
//     link.href = imageData;
//     link.download = `${cam}_${p.class}_${Date.now()}.png`;
//     link.click();
//   } catch (e) {
//     console.error("Snapshot error", e);
//   }

//   // 4️⃣  Get location (if user allows)
//   if (navigator.geolocation) {
//     navigator.geolocation.getCurrentPosition(
//       pos => {
//         const { latitude, longitude } = pos.coords;
//         addAlert(`${cam.toUpperCase()} — Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
//       },
//       err => {
//         console.warn("Location access denied", err);
//       }
//     );
//   } else {
//     addAlert(`${cam.toUpperCase()} — Location not supported`);
//   }
// }
// app.js — Multi-Cam NSG demo
// NOTE: Browser can access only one physical webcam at once. For Drone/Hidden use uploaded video or IP streams.

const SUSPICIOUS = new Set(['knife','scissors','gun','punch','angry person']); // coco classes
const cams = ['cctv','drone','hidden'];
const modelState = { model: null };

const alertSound = document.getElementById('alertSound');
const modelStatus = document.getElementById('modelStatus');
const fpsEl = document.getElementById('fps');
const alertsList = document.getElementById('alertsList');
const logBody = document.getElementById('logBody');

let frameCount = 0, lastTS = performance.now();

async function loadModel(){
  try{
    modelState.model = await cocoSsd.load();
    modelStatus.textContent = 'Ready';
    modelStatus.style.color = '#8ef';
    startDetectionLoop();
  }catch(e){
    modelStatus.textContent = 'Error';
    console.error(e);
  }
}
loadModel();

// per-camera state
const state = {};
cams.forEach(id=>{
  state[id] = {
    video: document.querySelector(`.cam-video[data-cam="${id}"]`),
    overlay: document.querySelector(`.overlay[data-cam="${id}"]`),
    radar: document.querySelector(`.radar-small[data-cam="${id}"]`),
    statusBadge: document.getElementById(`status-${id}`),
    meta: document.getElementById(`meta-${id}`),
    tamperEl: document.getElementById(`tamper-${id}`),
    mediaStream: null,
    mediaRecorder: null,
    recordedBlobs: [],
    lastFrameData: null,
    tamperCounter: 0,
    running: false
  };
});

// helpers
function addAlert(text){
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  alertsList.prepend(li);
  setTimeout(()=>li.remove(),30000);
}

function log(cam,label,score){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${new Date().toLocaleTimeString()}</td><td>${cam}</td><td>${label}</td><td>${(score*100).toFixed(1)}%</td>`;
  logBody.prepend(tr);
  while(logBody.children.length>300) logBody.removeChild(logBody.lastChild);
}

// start/stop per-cam
document.querySelectorAll('.cam-card .start').forEach(btn=>{
  btn.addEventListener('click', ()=>startCam(btn.dataset.cam));
});
document.querySelectorAll('.cam-card .stop').forEach(btn=>{
  btn.addEventListener('click', ()=>stopCam(btn.dataset.cam));
});
document.querySelectorAll('.cam-card .upload').forEach(input=>{
  input.addEventListener('change', (e)=>loadFileToCam(e.target.files[0], input.dataset.cam));
});
document.getElementById('startAll').addEventListener('click', ()=>cams.forEach(c=>startCam(c)));
document.getElementById('stopAll').addEventListener('click', ()=>cams.forEach(c=>stopCam(c)));
document.getElementById('snapshotAll').addEventListener('click', ()=>cams.forEach(c=>snapshotCam(c)));

function setBadge(cam,txt,cls){
  const el = state[cam].statusBadge;
  el.textContent = txt;
  el.style.background = cls==='on' ? 'rgba(0,200,100,0.08)' : 'rgba(255,0,0,0.04)';
}

// startCam
async function startCam(cam){
  const s = state[cam];
  if (s.running) return;
  try{
    if (cam==='cctv'){
      const stream = await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}, audio:false});
      s.mediaStream = stream;
      s.video.srcObject = stream;
      await s.video.play();
    } else {
      if (!s.video.srcObject && !s.video.src) s.video.src = '';
      await s.video.play().catch(()=>{});
    }
    s.running = true; setBadge(cam,'ON','on');
    s.meta.textContent = 'Running';
    startRecordingIfRequested(cam);
  }catch(e){
    console.error('startCam error',e);
    addAlert(`Failed to start ${cam}: ${e.message||e}`);
    s.meta.textContent = 'Error';
    setBadge(cam,'ERR','off');
  }
}

// stopCam
function stopCam(cam){
  const s = state[cam];
  if (!s.running) return;

  // stop media stream
  if (s.mediaStream){
    s.mediaStream.getTracks().forEach(t=>t.stop());
    s.mediaStream = null;
  }

  // stop video
  try {
    s.video.pause(); 
    s.video.srcObject = null;
    s.video.src = ''; // agar koi file play ho rahi ho
  } catch(e){}

  // clear overlay immediately
  if (s.overlay){
    const ctx = s.overlay.getContext('2d');
    ctx.clearRect(0, 0, s.overlay.width, s.overlay.height);
  }

  // stop recording if active
  if (s.mediaRecorder && s.mediaRecorder.state !== 'inactive') s.mediaRecorder.stop();

  s.running = false;
  setBadge(cam,'OFF','off');
  s.meta.textContent='Stopped';
}


// file upload
function loadFileToCam(file, cam){
  if (!file) return;
  const url = URL.createObjectURL(file);
  const s = state[cam];
  stopCam(cam);
  s.video.srcObject = null;
  s.video.src = url;
  s.video.onloadedmetadata = ()=>{ 
    s.video.play(); 
    s.running=true; 
    setBadge(cam,'ON','on'); 
    s.meta.textContent='File playback'; 
  };
}
const themeBtn = document.getElementById('themeToggle');
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');

  // Optional: Change button color based on theme
  if (document.body.classList.contains('light-theme')) {
    themeBtn.style.backgroundColor = '#000';
    themeBtn.style.color = '#fff';
  } else {
    themeBtn.style.backgroundColor = '#fff';
    themeBtn.style.color = '#000';
  }
});

// snapshot per cam
function snapshotCam(cam){
  const s = state[cam];
  const overlay = s.overlay;
  const v = s.video;
  if (!v || v.readyState<2) return;
  const c = document.createElement('canvas'); 
  c.width = overlay.width; 
  c.height=overlay.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(v,0,0,c.width,c.height);
  ctx.drawImage(overlay,0,0);
  const a = document.createElement('a'); 
  a.href=c.toDataURL('image/png'); 
  a.download=`snap_${cam}_${Date.now()}.png`; 
  a.click();
}

// recording
function startRecordingIfRequested(cam){
  const s = state[cam];
  const recBtn = document.querySelector(`.cam-card .record[data-cam="${cam}"]`);
  recBtn.onclick = ()=>{
    if (!s.mediaRecorder || s.mediaRecorder.state==='inactive'){
      let targetStream = s.mediaStream;
      if (!targetStream){
        const cap = s.video.captureStream ? s.video.captureStream() : null;
        targetStream = cap || null;
      }
      if (!targetStream){ addAlert(`Cannot record ${cam} — no stream`); return; }
      s.recordedBlobs = [];
      try{
        s.mediaRecorder = new MediaRecorder(targetStream, {mimeType:'video/webm;codecs=vp9'});
      }catch(e){
        s.mediaRecorder = new MediaRecorder(targetStream);
      }
      s.mediaRecorder.ondataavailable = e=>{ if (e.data && e.data.size) s.recordedBlobs.push(e.data); };
      s.mediaRecorder.onstop = ()=>{
        const blob = new Blob(s.recordedBlobs, {type:'video/webm'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href=url; 
        a.download=`record_${cam}_${Date.now()}.webm`; 
        a.click();
      };
      s.mediaRecorder.start();
      recBtn.textContent='Stop Rec';
      addAlert(`${cam} recording started`);
    } else {
      s.mediaRecorder.stop();
      recBtn.textContent='Record';
      addAlert(`${cam} recording stopped`);
    }
  };
}

// 🔴 analyze + auto snapshot + location
function analyzeTamperAndDraw(cam, predictions){
  const s = state[cam];
  const v = s.video;
  const overlay = s.overlay;
  const ctx = overlay.getContext('2d');
  overlay.width = v.videoWidth || v.clientWidth;
  overlay.height = v.videoHeight || v.clientHeight;
  ctx.clearRect(0,0,overlay.width,overlay.height);
  ctx.lineWidth = 2;

  predictions.forEach(p=>{
    const [x,y,w,h] = p.bbox;
    ctx.strokeStyle = SUSPICIOUS.has(p.class) ? 'rgba(255,59,59,0.95)' : 'rgba(140,200,255,0.9)';
    ctx.strokeRect(x,y,w,h);

    const text = `${p.class} ${(p.score*100).toFixed(0)}%`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillRect(x,y-20, ctx.measureText ? ctx.measureText(text).width+8 : 80, 18);
    ctx.fillStyle = '#111';
    ctx.fillText(text, x+4, y-6);

    // 🚨 suspicious detection
    if (SUSPICIOUS.has(p.class) && p.score>0.45){
      const timestamp = new Date().toLocaleTimeString();
      addAlert(`${cam.toUpperCase()} — ${p.class.toUpperCase()} detected @ ${timestamp}`);
      log(cam,p.class,p.score);

      // play alert sound
      try{ alertSound.currentTime=0; alertSound.play().catch(()=>{}); }catch(e){}

      // auto snapshot
      try {
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = v.videoWidth;
        snapCanvas.height = v.videoHeight;
        const snapCtx = snapCanvas.getContext('2d');
        snapCtx.drawImage(v,0,0,snapCanvas.width,snapCanvas.height);
        snapCtx.drawImage(overlay,0,0);
        const link = document.createElement('a');
        link.href = snapCanvas.toDataURL('image/png');
        link.download = `${cam}_${p.class}_${Date.now()}.png`;
        link.click();
      } catch(e){ console.error('Snapshot error', e); }

      // location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos=>{
          const {latitude,longitude} = pos.coords;
          addAlert(`${cam.toUpperCase()} — Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        });
      }
    }
  });
}

// detection loop
function startDetectionLoop(){
  async function step(){
    if (!modelState.model){ requestAnimationFrame(step); return; }
    for (const cam of cams){
      const s = state[cam];
      if (!s.running) continue;
      const v = s.video;
      if (v.readyState < 2) continue;
      try{
        const preds = await modelState.model.detect(v, 8);
        analyzeTamperAndDraw(cam, preds);
      }catch(e){ console.error('detect',cam,e); }
    }
    frameCount++;
    const now = performance.now();
    if (now - lastTS >= 1000){
      fpsEl.textContent = frameCount;
      frameCount = 0; lastTS = now;
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// snapshot buttons
document.querySelectorAll('.cam-card .snap').forEach(b=>{
  b.addEventListener('click', ()=>snapshotCam(b.dataset.cam));
});

// battery + altitude meta
document.querySelectorAll('.alt').forEach(el=>{
  el.addEventListener('input', e=>{
    const cam = e.target.dataset.cam;
    document.getElementById(`meta-${cam}`).textContent = `alt:${e.target.value}m`;
  });
});
document.querySelectorAll('.battery').forEach(el=>{
  el.addEventListener('input', e=>{
    const cam = e.target.dataset.cam;
    document.getElementById(`meta-${cam}`).textContent = `bat:${e.target.value}%`;
    if (Number(e.target.value) < 15) addAlert(`${cam.toUpperCase()} low battery (${e.target.value}%)`);
  });
});

