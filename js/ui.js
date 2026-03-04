// --- UI Update Functions ---
function updateUI() {
    if (!game) return;
    dayDisplay.textContent = game.day;
    const hours = String(Math.floor(game.timeInMinutes / 60)).padStart(2, '0');
    const minutes = String(Math.floor(game.timeInMinutes % 60)).padStart(2, '0');
    timeDisplay.textContent = `${hours}:${minutes}`;
    cgmValueDisplayGraph.textContent = game.cgmBG.toFixed(1);
    iobDisplay.textContent = game.iob.toFixed(1);
    cobDisplay.textContent = game.cob.toFixed(0);
    normoPointsDisplay.textContent = game.normoPoints.toFixed(1);
}

function updatePlayerFixedDataUI() {
    const tempSim = game || { ICR: 10, ISF: 3.0, gramsPerMmolRise: 3.3 };
    icrDisplay.textContent = tempSim.ICR;
    isfDisplay.textContent = tempSim.ISF.toFixed(1);
    carbEffectDisplay.textContent = tempSim.gramsPerMmolRise.toFixed(1);
    restingKcalDisplay.textContent = RESTING_KCAL_PER_DAY;
}

// --- Graph Drawing Function ---
let yAxisMax = 12.0;
function drawGraph() {
    if (!bgGraphCanvas) return; // Guard against premature calls
    const rect = bgGraphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    bgGraphCanvas.width = rect.width * dpr;
    bgGraphCanvas.height = rect.height * dpr;
    graphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let currentMaxCGMOnGraph = 0;
    const visibleCGMPoints = cgmDataPoints.slice(-MAX_GRAPH_POINTS_PER_DAY);
    visibleCGMPoints.forEach(p => { if (p.value > currentMaxCGMOnGraph) currentMaxCGMOnGraph = p.value; });
    if (currentMaxCGMOnGraph > 11.5 && yAxisMax < Math.min(25, currentMaxCGMOnGraph + 2)) yAxisMax = Math.ceil((currentMaxCGMOnGraph + 2) / 2) * 2;
    else if (currentMaxCGMOnGraph < 10.0 && yAxisMax > 12.0) yAxisMax = 12.0;
    const range = yAxisMax - 0; if (range <= 0) return;

    const padding = {top: 20, right: 20, bottom: 40, left: 50};
    graphCtx.clearRect(0, 0, bgGraphCanvas.width, bgGraphCanvas.height);
    const graphWidth = rect.width - padding.left - padding.right;
    const graphHeight = rect.height - padding.top - padding.bottom;
    if (graphWidth <= 0 || graphHeight <= 0) return;

    const totalMinutesInView = 24 * 60;
    const xNightStart = padding.left + ((22 * 60) / totalMinutesInView) * graphWidth;
    const xNightEnd = padding.left + ((7 * 60) / totalMinutesInView) * graphWidth;
    graphCtx.fillStyle = 'rgba(60, 60, 80, 0.1)';
    graphCtx.fillRect(xNightStart, padding.top, graphWidth - (xNightStart - padding.left), graphHeight);
    graphCtx.fillRect(padding.left, padding.top, xNightEnd - padding.left, graphHeight);

    const zones = [
        { min: 4.0, max: 10.0, color: 'rgba(72, 187, 120, 0.15)' },
        { min: 0, max: 3.99, color: 'rgba(229, 62, 62, 0.1)' },
        { min: 10.01, max: yAxisMax, color: 'rgba(229, 62, 62, 0.1)' },
    ];
    zones.forEach(zone => {
        const y_max_px = padding.top + graphHeight - ((zone.min) / range) * graphHeight;
        const y_min_px = padding.top + graphHeight - ((zone.max) / range) * graphHeight;
        graphCtx.fillStyle = zone.color;
        graphCtx.fillRect(padding.left, y_min_px, graphWidth, y_max_px - y_min_px);
    });

    [1.5, 4, 5.5, 8, 10].forEach(val => {
        const y = padding.top + graphHeight - ((val) / range) * graphHeight;
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, y);
        graphCtx.lineTo(padding.left + graphWidth, y);
        if (val === 1.5) {
            graphCtx.strokeStyle = 'rgba(229, 62, 62, 0.8)'; // Red line for 1.5
            graphCtx.lineWidth = 2;
            graphCtx.setLineDash([2, 2]);
        } else {
            graphCtx.strokeStyle = (val === 5.5) ? 'rgba(76, 175, 80, 0.7)' : 'rgba(0, 0, 0, 0.1)';
            graphCtx.lineWidth = (val === 4 || val === 10) ? 1.5 : 1;
            graphCtx.setLineDash((val === 5.5) ? [4, 4] : []);
        }
        graphCtx.stroke();
    });
    graphCtx.setLineDash([]);

    graphCtx.strokeStyle = '#a0aec0'; graphCtx.lineWidth = 1;
    graphCtx.strokeRect(padding.left, padding.top, graphWidth, graphHeight);

    graphCtx.fillStyle = '#4a5568'; graphCtx.font = "bold 12px Segoe UI";
    for (let i = 0; i <= 24; i += 2) {
        const x = padding.left + ( (i*60 / totalMinutesInView ) * graphWidth );
        graphCtx.fillText(`${String(i).padStart(2,'0')}:00`, x - 15, padding.top + graphHeight + 20);
    }

    const yStep = range > 15 ? 2 : 1;
    for (let i = Math.ceil(0); i <= yAxisMax; i += yStep) {
        if (i === 0 && yAxisMax > 2) continue; // Skip 0 if axis is large
        const y = padding.top + graphHeight - ((i) / range) * graphHeight;
        graphCtx.fillText(i.toFixed(0), padding.left - 30, y + 4);
    }
    graphCtx.save(); graphCtx.translate(padding.left - 40, padding.top + graphHeight/2); graphCtx.rotate(-Math.PI/2);
    graphCtx.textAlign = "center"; graphCtx.font = "bold 13px Segoe UI"; graphCtx.fillText("Blodsukker (mmol/L)", 0, 0); graphCtx.restore();

    if (!game) return;
    const currentDayStartMinutes = (game.day - 1) * totalMinutesInView;

    if(debugTrueBgCheckbox.checked) {
        const points = trueBgPoints.filter(p => p.time >= currentDayStartMinutes && p.time < currentDayStartMinutes + totalMinutesInView);
        graphCtx.beginPath();
        points.forEach((p, i) => {
            const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            const y = padding.top + graphHeight - ((p.value) / range) * graphHeight;
            if (i === 0) graphCtx.moveTo(x, y); else graphCtx.lineTo(x, y);
        });
        graphCtx.strokeStyle = 'rgba(100, 100, 255, 0.7)'; graphCtx.lineWidth = 2; graphCtx.stroke();
    }

    const pointsToDraw = cgmDataPoints.filter(p => p.time >= currentDayStartMinutes && p.time < currentDayStartMinutes + totalMinutesInView);
    pointsToDraw.forEach(p => {
        const x = padding.left + ((p.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
        const y = padding.top + graphHeight - ((p.value) / range) * graphHeight;
        if (y < padding.top || y > padding.top + graphHeight) return;

        if (p.type === 'fingerprick') {
            graphCtx.font = '16px Arial';
            graphCtx.textAlign = 'center';
            graphCtx.textBaseline = 'middle';
            graphCtx.fillStyle = '#e53e3e';
            graphCtx.fillText('🩸', x, y);
        } else {
            graphCtx.beginPath();
            graphCtx.arc(x, y, 3, 0, 2 * Math.PI);
            if (p.value < 4.0 || p.value > 10.0) graphCtx.fillStyle = '#e53e3e';
            else graphCtx.fillStyle = '#38a169';
            graphCtx.fill();
        }
    });

    game.logHistory.forEach(event => {
        if (event.time >= currentDayStartMinutes && event.time < currentDayStartMinutes + totalMinutesInView) {
            const x = padding.left + ((event.time - currentDayStartMinutes) / totalMinutesInView) * graphWidth;
            let yPos = padding.top + graphHeight - 10;
            graphCtx.textAlign = "center";
            graphCtx.font = "14px Arial";
            if(event.type === 'food') {
                const icon = event.details.icon || '🍴';
                graphCtx.fillText(icon, x, yPos);
                if (icon === '🍴') {
                    const ke = (event.details.carbs + event.details.protein * 0.25).toFixed(0);
                    graphCtx.font = "bold 9px Segoe UI";
                    graphCtx.fillStyle = '#333';
                    graphCtx.fillText(`KE:${ke}g`, x, yPos - 12);
                }
            } else if (event.type === 'motion') {
                graphCtx.fillText(event.icon, x, yPos);
            } else if(event.type.includes('insulin')) {
                graphCtx.fillStyle = event.type === 'insulin-basal' ? '#2b6cb0' : '#c53030';
                graphCtx.fillText(event.icon, x, yPos);
                graphCtx.font = "bold 10px Segoe UI";
                const doseText = event.details.dose.toFixed(event.type === 'insulin-fast' ? 1 : 0);
                graphCtx.fillText(doseText, x, yPos - 12);
            }
        }
    });

     game.graphMessages.forEach(msg => {
        const xCenter = padding.left + graphWidth / 2;
        const yPos = padding.top + 25;
        graphCtx.fillStyle = "rgba(255, 240, 150, 0.9)";
        graphCtx.strokeStyle = "#FFC107";
        graphCtx.lineWidth = 2;
        graphCtx.textAlign = "center";
        graphCtx.font = "bold 13px Segoe UI";
        const textWidth = graphCtx.measureText(msg.text).width;
        if (msg.text.startsWith("zZzz")) {
            graphCtx.globalAlpha = 0.6;
            graphCtx.font = "italic bold 16px Segoe UI";
            graphCtx.fillStyle = "#63b3ed";
            const xOffset = Math.sin(game.totalSimMinutes / 20) * 5;
            graphCtx.fillText(msg.text, padding.left + 50 + xOffset, padding.top + 20);
            graphCtx.globalAlpha = 1.0;
        } else {
            graphCtx.fillRect(xCenter - textWidth/2 - 10, yPos - 20, textWidth + 20, 30);
            graphCtx.strokeRect(xCenter - textWidth/2 - 10, yPos - 20, textWidth + 20, 30);
            graphCtx.fillStyle = "#333";
            graphCtx.fillText(msg.text, xCenter, yPos);
        }
    });
}

// --- Popup and Logging Functions ---
function showHelpPopup() {
    if(document.querySelector('.popup-overlay')) return;
    if (game && !isPaused) togglePause();
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    const content = document.createElement('div');
    content.className = 'popup-content';
    content.innerHTML = `
        <h2 class="info-title">Hjælp & Information</h2>
        <p>Jeg fik konstateret Type 1 Diabetes i februar 2025 og har lavet denne simulator for at blive klogere på sygdommen. Simulatoren er lavet med hjælp fra AI, inspiration fra litteraturen og lidt personlige erfaringer fra de første måneder med T1D.<br>- Kristian R Harreby</p>
        <p style="color: red;"><strong>Disclaimer:</strong> Simulationen er IKKE en guide til kliniske beslutninger vedrørende diabetesbehandling. Konsulter altid sundhedspersonale for konkret medicinsk rådgivning om din egen situation.</p>
        <h3>Spilmekanikker</h3>
        <ul>
            <li><strong>Mål:</strong> Opnå så mange 'Normoglykæmi-points' som muligt ved at holde dit blodsukker stabilt i målområdet (ideelt 4-8 mmol/L).</li>
            <li><strong>Usikkerheder:</strong> Vær opmærksom på usikkerheder! Madoptagelse varierer, insulins virkning er ikke altid ens, og CGM-målingerne er ikke 100% præcise.</li>
            <li><strong>Mad:</strong> Kulhydrater virker hurtigt. Protein og fedt forsinker og forlænger blodsukkerstigningen.</li>
            <li><strong>Insulin:</strong> Hurtig insulin virker 2-6 timer. Basal dækker grundbehov over 24+ timer.</li>
            <li><strong>Motion:</strong> Sænker BG direkte og øger insulinfølsomheden i op til 30 timer efter.</li>
            <li><strong>Dawn Effect:</strong> Leveren frigiver mere glukose om morgenen (ca. 03:00-08:00).</li>
        </ul>
        <h3>Game Over Scenarier</h3>
        <ul>
            <li><strong>Hypoglykæmi:</strong> Sandt blodsukker < 1.5 mmol/L.</li>
            <li><strong>Ketoacidose (DKA):</strong> Vedvarende højt BG med insulinmangel. Du advares først.</li>
            <li><strong>Vægtændring:</strong> Samlet vægtændring overstiger +/- 5 kg.</li>
            <li><strong>Komplikationer:</strong> 14-dages gennemsnitligt BG er > 15 mmol/L.</li>
        </ul>
        <div class="popup-button-container">
            <button id="help-ok-button">OK</button>
        </div>`;
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    document.getElementById('help-ok-button').addEventListener('click', () => {
        document.body.removeChild(overlay);
        if (game && isPaused && !game.isGameOver) togglePause();
    });
}

function showPopup(title, message, isGameOverPopup, isEventPopup = false, isInfoPopup = false, shouldPause = true) {
    // Prevent multiple popups
    const existingPopup = document.querySelector('.popup-overlay');
    if (existingPopup) return;

    if (shouldPause && game && !isPaused) togglePause();
    const overlay = document.createElement('div'); overlay.className = 'popup-overlay';
    const content = document.createElement('div'); content.className = 'popup-content';

    const h2 = document.createElement('h2'); h2.textContent = title;
    if (isEventPopup) h2.classList.add('event-title');
    if (isGameOverPopup) h2.style.color = '#e53e3e';
    const p = document.createElement('p'); p.innerHTML = message;
    content.appendChild(h2); content.appendChild(p);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'popup-button-container';
    const button = document.createElement('button');
    button.textContent = isGameOverPopup ? "Reset Spil" : "OK";
    button.onclick = () => {
        document.body.removeChild(overlay);
        if (isGameOverPopup) resetGame();
        else if (shouldPause && game && !game.isGameOver && isPaused) togglePause();
    };
    buttonContainer.appendChild(button);
    content.appendChild(buttonContainer);
    overlay.appendChild(content);
    document.body.appendChild(overlay); // Tilføj overlayret til siden så det faktisk vises
    if (!isGameOverPopup && !isInfoPopup) playSound('intervention', 'C5');
}

function logEvent(message, type = 'info', details = {}) {
    if (!game) return;
    let icon = '';
    switch(type) {
        case 'food': icon = details.icon || '🍴'; break;
        case 'motion': icon = '🏃'; break;
        case 'insulin-fast': icon = '💉'; break;
        case 'insulin-basal': icon = '🖊️'; break;
    }
    game.logHistory.push({ time: game.totalSimMinutes, message, type, icon, details });
}

function updateFoodDisplay() {
    foodKcalDisplay.textContent = ((parseInt(carbsSlider.value) * 4) + (parseInt(proteinSlider.value) * 4) + (parseInt(fatSlider.value) * 9)).toFixed(0);
    const ke = (parseInt(carbsSlider.value) + parseInt(proteinSlider.value) * 0.25).toFixed(0);
    foodKeDisplay.textContent = ke + " g";
}

function updateMotionKcal() {
    let kcalPerMinute = motionIntensitySelect.value === "Lav" ? 4 : (motionIntensitySelect.value === "Medium" ? 7 : 10);
    motionKcalDisplay.textContent = (kcalPerMinute * parseInt(motionDurationSelect.value)).toFixed(0);
}
