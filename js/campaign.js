// =============================================================================
// CAMPAIGN.JS — Thin DESKTOP adapter around CampaignCore (campaign-core.js)
// =============================================================================
//
// CampaignCore (js/campaign-core.js) owns ALL campaign decision logic and is
// pure / DOM-free / shell-agnostic. This file is the DESKTOP shell adapter:
//   - It builds the desktop `host` object (settings, side-effects, storage,
//     popup/screen/gating render callbacks) and constructs the global
//     `campaignEngine = new CampaignCore(desktopHost)`.
//   - It contains all the DOM-rendering code that used to live in the engine:
//     the dock-gating writer, the intro/complete/failed/select popups, the
//     game-over popup, character portrait HTML, guide-link rows, and the
//     campaign info button.
//   - It re-exposes a few render methods (showLevelIntroPopup,
//     showLevelSelectPopup, updateCampaignInfoBtn) ON the campaignEngine
//     instance so existing call sites in main.js / ui.js keep working unchanged.
//
// Desktop behavior is FUNCTIONALLY IDENTICAL to before the split — the DOM
// render code below was moved (not rewritten) from the old CampaignEngine.
//
// Character framing:
//   The selected fictional character is shown as the subject of the simulated
//   scenario. Tips and results are neutral system observations, not dialogue
//   from a separate guide character.
//
// Dependencies (global): CampaignCore + helpers (campaign-core.js),
//   CAMPAIGN_LEVELS, GUIDE_LEVEL_LINKS (levels.js / ui.js), game (Simulator),
//   appSettings, isPaused, lastFrameTime, t() (i18n.js), createPopup, showPopup,
//   playSound, flyIconToGraph, showActivityActive, resetGame, startGame,
//   runSyncedTirAnimation, guideTitleForSection/guideIconForSection (ui.js)
// Exports (global): campaignEngine (the CampaignCore instance)
// =============================================================================


// =============================================================================
// DESKTOP DOM HELPERS — character portrait + guide-link row (HTML builders)
// =============================================================================
// These build HTML strings and therefore live in the shell, not the core.
// =============================================================================

function getCampaignCharacterFigureHtml(character, scene = 'intro', extraClass = '', showPlayingLabel = false) {
    const selected = character && character.id && typeof getCharacter === 'function'
        ? getCharacter(character.id)
        : (typeof getActiveCharacter === 'function' ? getActiveCharacter() : { id: 'erik', name: 'Erik' });
    const fullBodySrc = selected.fullBody && selected.fullBody[scene];
    const src = fullBodySrc || `assets/icons/app/character-${selected.id}.png`;
    const formatClass = fullBodySrc ? ' is-full-body' : ' is-portrait-fallback';
    const extra = extraClass ? ` ${extraClass}` : '';
    const playingLabel = showPlayingLabel
        ? `<span class="campaign-character-caption">${t('campaign.playingCharacter', { characterName: selected.name })}</span>`
        : '';
    return `
        <div class="campaign-character-figure${formatClass}${extra}" aria-label="${selected.name}">
            <img class="campaign-character-img" src="${src}" alt="${selected.name}" title="${selected.name}">
            ${playingLabel}
        </div>`;
}

function renderGuideLinkRow(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length === 0) return '';
    if (typeof guideTitleForSection !== 'function') return '';

    const linksHtml = sectionIds
        .filter(Boolean)
        .map(sectionId => {
            const label = guideTitleForSection(sectionId);
            const icon = (typeof guideIconForSection === 'function')
                ? guideIconForSection(sectionId)
                : '';
            if (!icon) return '';
            return `<button type="button" class="guide-link-btn" data-guide-section="${sectionId}"><span class="guide-info-icon"><img src="${icon}" alt=""></span><span class="guide-link-label">${label}</span></button>`;
        })
        .filter(Boolean)
        .join('');

    return linksHtml ? `<div class="guide-link-row">${linksHtml}</div>` : '';
}


// =============================================================================
// DESKTOP DOCK GATING WRITER — consumes core.getGatingState(), writes the DOM
// =============================================================================
// Moved verbatim from the old CampaignEngine.updateDockState; the data-
// derivation half now lives in core.getGatingState() and the boolean snapshot
// is passed in here. Every DOM id and side effect is preserved exactly.
//
// @param {object} gating — core.getGatingState() snapshot:
//   { actions:{food,fastInsulin,basalInsulin,exercise,kit},
//     enabledFoodRows:string[]|null, lockedIntensity:string|null,
//     maxBolusDose:number }
// =============================================================================
function desktopApplyDockGating(gating) {
    if (!gating) return;
    const actions = gating.actions || {};
    const fastAllowed = actions.fastInsulin !== false;
    const basalAllowed = actions.basalInsulin !== false;

    const actionMap = {
        'dock-panel-food':    'food',
        'dock-panel-insulin': null,      // Handled specially (fast/basal separate)
        'dock-panel-motion':  'exercise',
        'dock-panel-kit':     'kit',
    };

    document.querySelectorAll('.dock-item[data-panel]').forEach(item => {
        const panelId = item.dataset.panel;
        const actionType = actionMap[panelId];

        if (panelId === 'dock-panel-insulin') {
            // The insulin panel is active if either fast OR basal is allowed
            item.classList.toggle('campaign-disabled', !fastAllowed && !basalAllowed);
        } else if (actionType !== undefined && actionType !== null) {
            item.classList.toggle('campaign-disabled', actions[actionType] === false);
        }
    });

    // Within the insulin panel: disable fast/basal sections individually.
    // Sections use the classes .dp-insulin-fast and .dp-insulin-basal.
    const insulinPanel = document.getElementById('dock-panel-insulin');
    if (insulinPanel) {
        const fastSection = insulinPanel.querySelector('.dp-insulin-fast');
        const basalSection = insulinPanel.querySelector('.dp-insulin-basal');
        const fastHint = insulinPanel.querySelector('.dp-fast-hint');
        const basalLabel = insulinPanel.querySelectorAll('.dp-section-label')[0]; // Basal label (first)
        const fastLabel = insulinPanel.querySelectorAll('.dp-section-label')[1];  // Fast label (second)
        const divider = insulinPanel.querySelector('.dp-divider');
        if (fastSection) fastSection.classList.toggle('campaign-disabled', !fastAllowed);
        if (basalSection) basalSection.classList.toggle('campaign-disabled', !basalAllowed);
        if (fastHint) fastHint.classList.toggle('campaign-disabled', !fastAllowed);
        if (fastLabel) fastLabel.classList.toggle('campaign-disabled', !fastAllowed);
        if (basalLabel) basalLabel.classList.toggle('campaign-disabled', !fastAllowed);
        if (divider) divider.classList.toggle('campaign-disabled', !fastAllowed);

        // Bolus dose limit: hide preset chips above maxBolusDose
        // and constrain the slider maximum. Reset to defaults when no limit is set.
        const maxDose = gating.maxBolusDose;
        const DEFAULT_SLIDER_MAX = 10; // Default slider max (no campaign restriction)
        if (fastAllowed) {
            // Preset chip IDs and their doses
            const presetDoses = [
                { id: 'fastPreset05', dose: 0.5 },
                { id: 'fastPreset1',  dose: 1 },
                { id: 'fastPreset2',  dose: 2 },
                { id: 'fastPreset4',  dose: 4 },
                { id: 'fastPreset8',  dose: 8 },
            ];
            for (const p of presetDoses) {
                const chip = document.getElementById(p.id);
                if (chip) chip.classList.toggle('campaign-disabled', p.dose > maxDose);
            }
            // Constrain or reset the custom slider
            const slider = document.getElementById('fastInsulinSlider');
            if (slider) {
                const effectiveMax = maxDose < Infinity ? maxDose : DEFAULT_SLIDER_MAX;
                slider.max = effectiveMax;
                if (parseFloat(slider.value) > effectiveMax) {
                    slider.value = effectiveMax;
                    const display = document.getElementById('fastInsulinValue');
                    if (display) display.textContent = parseFloat(effectiveMax).toFixed(1);
                }
            }
        }
    }

    // Within the food panel: disable rows not listed in enabledFoodRows.
    // If the list is null → all rows are active (default). Used e.g. in level 1
    // where only "adjustments" (sugar/fruit for hypo correction) is relevant.
    const allowedRows = gating.enabledFoodRows;
    const foodPanel = document.getElementById('dock-panel-food');
    if (foodPanel) {
        foodPanel.querySelectorAll('[data-row-id]').forEach(el => {
            const rowId = el.dataset.rowId;
            const disabled = allowedRows ? !allowedRows.includes(rowId) : false;
            el.classList.toggle('campaign-disabled', disabled);
        });
    }

    // Lock intensity (e.g. level 7: only low-intensity activity is available)
    const lockedIntensity = gating.lockedIntensity;
    const motionPanel = document.getElementById('dock-panel-motion');
    if (motionPanel) {
        motionPanel.querySelectorAll('.intensity-chip').forEach(chip => {
            const isLocked = !!lockedIntensity && chip.dataset.intensity !== lockedIntensity;
            chip.classList.toggle('campaign-disabled', isLocked);
            // If this chip is the locked one — mark it selected
            if (lockedIntensity && chip.dataset.intensity === lockedIntensity) {
                motionPanel.querySelectorAll('.intensity-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                const sel = document.getElementById('motionIntensity');
                if (sel) sel.value = lockedIntensity;
            }
        });
    }
}


// =============================================================================
// DESKTOP EVENT POPUP — consumes the core's event descriptor (emitPopup)
// =============================================================================
// Returns true if a popup was shown (the core falls back to a graph tip when
// false). Builds the autoFood food card + guide-link row HTML here.
// =============================================================================
function desktopShowEventPopup(descriptor) {
    if (!descriptor || !descriptor.titleKey || !descriptor.messageKey) return false;
    if (typeof showPopup !== 'function' || typeof t !== 'function') return false;
    if (typeof document !== 'undefined' && document.querySelector('.popup-overlay')) return false;

    let message = t(descriptor.messageKey, descriptor.textVars || {});

    // autoFood events: append a food card with icon, name, weight, kcal, and macro bar
    const fc = descriptor.foodCard;
    if (fc) {
        const name = fc.nameKey ? t(fc.nameKey) : '';
        message += `<div class="popup-food-card">`
            + `<span class="popup-food-icon">${fc.icon}</span>`
            + (name ? `<span class="popup-food-name">${name}</span>` : '')
            + `<div class="popup-food-info">`
            + `<span class="popup-food-detail">${fc.weight}g</span>`
            + `<span class="popup-food-detail">${fc.kcal} kcal</span>`
            + `</div>`
            + `<div class="popup-food-macro-bar">`
            + `<span class="pc-mb-carb" style="flex:${fc.carbs}"></span>`
            + `<span class="pc-mb-protein" style="flex:${fc.protein}"></span>`
            + `<span class="pc-mb-fat" style="flex:${fc.fat}"></span>`
            + `</div>`
            + `<div class="popup-food-macro-labels">`
            + `<span class="ml-carb" style="flex:${fc.carbs}">${fc.carbs}g</span>`
            + `<span class="ml-protein" style="flex:${fc.protein}">${fc.protein}g</span>`
            + `<span class="ml-fat" style="flex:${fc.fat}">${fc.fat}g</span>`
            + `</div>`
            + `</div>`;
    }

    if (descriptor.guideSections && descriptor.guideSections.length) {
        message += renderGuideLinkRow(descriptor.guideSections);
    }

    showPopup(
        t(descriptor.titleKey),
        message,
        false,
        true,
        false,
        descriptor.shouldPause !== false
    );
    return true;
}


// =============================================================================
// DESKTOP SCREEN RENDERERS — consume the core's build*Descriptor data
// =============================================================================

// --- Level intro popup ---
// descriptor: { kind:'intro', isReopen, character, level:{number,titleKey,
//   descriptionKey}, objectives:[{id,descriptionKey,completed}],
//   guideSections:string[], textVars:{icr, characterName} }
function desktopShowLevelIntroPopup(descriptor) {
    if (!descriptor) return;
    const isReopen = !!descriptor.isReopen;

    // Pause the game while intro is shown
    isPaused = true;

    const { overlay, content } = createPopup({ contentClass: 'campaign-intro-popup' });

    const characterHtml = getCampaignCharacterFigureHtml(descriptor.character, 'intro', '', true);

    // Objective list
    const objectivesHtml = descriptor.objectives.map(obj =>
        `<li>○ ${t(obj.descriptionKey, descriptor.textVars || {})}</li>`
    ).join('');

    const guideLinksHtml = renderGuideLinkRow(descriptor.guideSections || []);
    const moreInfoLabel = (appSettings.language === 'en') ? 'Additional info' : 'Mere info';

    content.innerHTML = `
        <div class="campaign-intro-header">
            ${characterHtml}
            <h2 class="campaign-day-number">${t('campaign.levelLabel', {n: descriptor.level.number})}</h2>
        </div>
        <h3 class="campaign-day-title">${t(descriptor.level.titleKey)}</h3>
        <div class="campaign-day-desc">${t(descriptor.level.descriptionKey, descriptor.textVars || {})}</div>
        <div class="campaign-section">
            <h4>${t('campaign.objectives')}</h4>
            <ul class="campaign-obj-list">${objectivesHtml}</ul>
        </div>
        ${guideLinksHtml ? `
            <div class="campaign-section campaign-more-info-section">
                <h4>${moreInfoLabel}</h4>
                ${guideLinksHtml}
            </div>
        ` : ''}
        <div class="popup-button-container">
            <button id="campaignStartBtn" class="popup-btn-primary">${t(isReopen ? 'campaign.returnToLevel' : 'campaign.startLevel')}</button>
        </div>
    `;

    content.querySelector('#campaignStartBtn').addEventListener('click', () => {
        // CLOSE: animate popup back to the info button in the top-right.
        // Illustrates that the user can reopen the intro from the same place.
        // Slow + deliberate easing so the movement is visible (1.2s).
        const infoBtn = document.getElementById('campaignInfoBtn');
        const finishStart = () => {
            overlay.remove();
            isPaused = false;
            lastFrameTime = performance.now();
        };
        if (infoBtn && infoBtn.offsetParent !== null) {
            const popupRect = content.getBoundingClientRect();
            const btnRect = infoBtn.getBoundingClientRect();
            const dx = (btnRect.left + btnRect.width / 2) - (popupRect.left + popupRect.width / 2);
            const dy = (btnRect.top + btnRect.height / 2) - (popupRect.top + popupRect.height / 2);
            const targetScale = Math.max(0.04, btnRect.width / popupRect.width);

            // Cancel any opening transition, start fly-to-icon
            content.style.animation = 'none';
            content.style.transformOrigin = 'center center';
            content.style.willChange = 'transform, opacity';
            // Opacity duration is longer than transform so the popup stays visible
            // almost the entire way down to the icon and fades out very gradually.
            content.style.transition = 'transform 1.2s cubic-bezier(0.55, 0, 0.85, 0.25), opacity 1.6s ease-in';
            overlay.style.transition = 'background-color 1.4s ease-in';

            // Force reflow so the transition starts from the current state
            void content.offsetWidth;

            content.style.transform = `translate(${dx}px, ${dy}px) scale(${targetScale})`;
            content.style.opacity = '0';
            overlay.style.backgroundColor = 'transparent';

            let done = false;
            const cleanup = () => { if (done) return; done = true; finishStart(); };
            content.addEventListener('transitionend', cleanup, { once: true });
            setTimeout(cleanup, 1800);  // Failsafe (slightly longer than the longest transition at 1.6s)
        } else {
            finishStart();
        }
    });


    // OPEN: animate popup FROM the info button out to centre.
    // Maintains the illusion that the popup "lives" at the info button.
    // Happens AFTER append so we can measure the popup's layout rect.
    campaignEngine.updateCampaignInfoBtn();   // force info button visible so we can measure it
    const introInfoBtn = document.getElementById('campaignInfoBtn');
    if (introInfoBtn && introInfoBtn.offsetParent !== null) {
        const popupRect = content.getBoundingClientRect();
        const btnRect = introInfoBtn.getBoundingClientRect();
        const dx = (btnRect.left + btnRect.width / 2) - (popupRect.left + popupRect.width / 2);
        const dy = (btnRect.top + btnRect.height / 2) - (popupRect.top + popupRect.height / 2);
        const startScale = Math.max(0.04, btnRect.width / popupRect.width);

        // Disable default popup-pop, set start state at the info button
        content.style.animation = 'none';
        content.style.transformOrigin = 'center center';
        content.style.willChange = 'transform, opacity';
        content.style.transition = 'none';
        content.style.transform = `translate(${dx}px, ${dy}px) scale(${startScale})`;
        content.style.opacity = '0';
        overlay.style.backgroundColor = 'transparent';

        // Force reflow so the start state is "locked" before the transition
        void content.offsetWidth;

        // Animate out to centre. Spring-like easing (slight overshoot) so
        // the movement feels "unfolded" rather than just scaled up.
        content.style.transition = 'transform 1.2s cubic-bezier(0.34, 1.4, 0.5, 1), opacity 1.1s ease-out';
        overlay.style.transition = 'background-color 1.0s ease-out';
        requestAnimationFrame(() => {
            content.style.transform = 'translate(0, 0) scale(1)';
            content.style.opacity = '1';
            overlay.style.backgroundColor = '';   // reset to CSS default rgba(0,0,0,0.7)
        });
    }
}

// --- Level complete popup ---
// descriptor: { kind:'complete', character, level:{number,titleKey}, stars,
//   tir, points, starBonus, total, hasNext }
function desktopShowLevelCompletePopup(descriptor) {
    isPaused = true;

    const { overlay, content } = createPopup({ contentClass: 'campaign-complete-popup' });
    const stars = descriptor.stars;
    const points = descriptor.points;
    const starBonus = descriptor.starBonus;
    const tir = descriptor.tir;
    const total = descriptor.total;
    const hasNext = descriptor.hasNext;

    // Mark 0-star cases for optional CSS styling (muted colour palette)
    if (stars === 0) content.classList.add('campaign-poor-pass');

    const characterHtml = getCampaignCharacterFigureHtml(
        descriptor.character,
        descriptor.stars > 0 ? 'celebrate' : 'concern',
        '',
        true
    );

    // Stars — all start as .campaign-star, animation adds .revealed
    const starsHtml = [1, 2, 3].map(i => {
        const earned = i <= stars;
        return `<span class="campaign-star ${earned ? 'earned' : ''}" data-idx="${i-1}">${earned ? '⭐' : '☆'}</span>`;
    }).join('');

    content.innerHTML = `
        <div class="campaign-intro-header">
            ${characterHtml}
            <h2 class="campaign-day-number">${t('campaign.levelLabel', {n: descriptor.level.number})}</h2>
        </div>
        <h3 class="campaign-day-title campaign-day-title-centered">${t(descriptor.level.titleKey)}</h3>
        <div class="campaign-tir-stars">
            <span class="campaign-tir-label">TIR</span>
            <span class="campaign-tir-value" data-target="${tir.toFixed(0)}">0%</span>
            <span class="campaign-stars-inline">${starsHtml}</span>
        </div>
        <div class="campaign-points-breakdown">
            <div class="campaign-pts-row" data-row="base">
                <span class="campaign-pts-label">${t('campaign.basePoints')}</span>
                <span class="campaign-pts-value">${points.toFixed(1)}</span>
            </div>
            <div class="campaign-pts-row" data-row="stars">
                <span class="campaign-pts-label">⭐ × ${stars}</span>
                <span class="campaign-pts-value campaign-pts-bonus">+${starBonus.toFixed(1)}</span>
            </div>
            <div class="campaign-pts-row campaign-pts-total" data-row="total">
                <span class="campaign-pts-label">${t('campaign.total')}</span>
                <span class="campaign-pts-value" data-target="${total.toFixed(1)}">0.0</span>
            </div>
        </div>
        <p class="campaign-replay-prompt">${t('campaign.replayPrompt')}</p>
        ${descriptor.scoreBlocked
            ? `<p class="go-save-result">${t('ui.physiology.scoreNotSaved')}</p>`
            : `<div class="go-save-form campaign-save-form">
                <label class="go-save-label" for="campaignSignatureInput">${t('game.over.saveLabel')}</label>
                <div class="go-save-row">
                    <input type="text" id="campaignSignatureInput" maxlength="20" placeholder="${t('profile.name.placeholder')}" value="${escapeHtml(typeof getPlayerSignature === 'function' ? getPlayerSignature() : '')}">
                    <button id="campaignSaveBtn" class="go-save-btn">${t('game.over.saveBtn')}</button>
                </div>
            </div>`}
        <div class="popup-button-row">
            <button id="campaignReplayBtn">${t('campaign.replay')}</button>
            ${hasNext ? `<button id="campaignNextBtn" class="popup-btn-primary">${t('campaign.nextLevel')}</button>` : ''}
        </div>
        <div class="popup-button-container">
            <button id="campaignMenuBtn2" class="popup-btn-link">${t('campaign.quit')}</button>
        </div>
    `;

    // Signature field (A4d): let the player sign the campaign score. saveLevelResult
    // already stored the existing signature; this lets them type/confirm it here
    // (e.g. a campaign-only player who never set one) so the grid shows their name.
    const campaignSaveBtn = content.querySelector('#campaignSaveBtn');
    if (campaignSaveBtn) {
        const sigInput = content.querySelector('#campaignSignatureInput');
        const doSave = () => {
            const typed = (sigInput.value || '').trim();
            if (typeof setPlayerSignature === 'function') setPlayerSignature(typed);
            campaignEngine.updateBestNameForCurrentLevel(typed);
            sigInput.disabled = true;
            campaignSaveBtn.disabled = true;
            campaignSaveBtn.textContent = t('game.over.savedBtn');
        };
        campaignSaveBtn.addEventListener('click', doSave);
        sigInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    }

    // Event handlers
    content.querySelector('#campaignReplayBtn').addEventListener('click', () => {
        overlay.remove();
        campaignEngine.retryCurrentLevel();
    });
    if (hasNext) {
        content.querySelector('#campaignNextBtn').addEventListener('click', () => {
            overlay.remove();
            campaignEngine.startLevel(campaignEngine.currentLevelIndex + 1);
        });
    }
    content.querySelector('#campaignMenuBtn2').addEventListener('click', () => {
        overlay.remove();
        if (typeof resetGame === 'function') resetGame();
    });


    // Start reveal animation: TIR counts up → stars pop one at a time
    // → breakdown fades in → total counts up + fanfare.
    // ESC skips the animation and shows the final state immediately.
    // Delegate to the shared top-level helper in ui.js.
    if (typeof runSyncedTirAnimation === 'function') {
        runSyncedTirAnimation(content, overlay, { tir, total, stars });
    }
}

// --- Level failed popup ---
// descriptor: { kind:'failed', character, level:{number,titleKey},
//   failedObjectiveId, missingObjectives:[{id,descriptionKey,progress,target}],
//   guideSections:string[] }
function desktopShowLevelFailedPopup(descriptor) {
    isPaused = true;

    const { overlay, content } = createPopup({ contentClass: 'campaign-failed-popup campaign-poor-pass' });

    const characterHtml = getCampaignCharacterFigureHtml(descriptor.character, 'concern', '', true);

    const missingObjectivesHtml = descriptor.missingObjectives.map(obj => {
        const hasProgress = obj.progress !== null && obj.target !== null;
        const progressText = hasProgress
            ? ` <span class="campaign-obj-progress">(${obj.progress} / ${obj.target})</span>`
            : '';
        return `<li>○ ${t(obj.descriptionKey, descriptor.textVars || {})}${progressText}</li>`;
    }).join('');
    const guideLinksHtml = renderGuideLinkRow(descriptor.guideSections || []);

    content.innerHTML = `
        <div class="campaign-intro-header">
            ${characterHtml}
            <h2 class="campaign-day-number">${t('campaign.levelLabel', {n: descriptor.level.number})}</h2>
        </div>
        <h3 class="campaign-day-title campaign-day-title-centered">${t(descriptor.level.titleKey)}</h3>
        <div class="campaign-failed-summary">
            <p class="campaign-failed-highlight">${t('campaign.failed.body')}</p>
            ${missingObjectivesHtml ? `
                <ul class="campaign-obj-list">${missingObjectivesHtml}</ul>
            ` : ''}
            ${guideLinksHtml}
        </div>
        <div class="popup-button-row">
            <button id="campaignRetryBtn2" class="popup-btn-primary">${t('campaign.retry')}</button>
        </div>
        <div class="popup-button-container">
            <button id="campaignMenuBtn3" class="popup-btn-link">${t('campaign.quit')}</button>
        </div>
    `;

    content.querySelector('#campaignRetryBtn2').addEventListener('click', () => {
        overlay.remove();
        campaignEngine.retryCurrentLevel();
    });
    content.querySelector('#campaignMenuBtn3').addEventListener('click', () => {
        overlay.remove();
        if (typeof resetGame === 'function') resetGame();
    });


    // No TIR/star animation on failure — the level was not passed,
    // so scoring is irrelevant.
}

// --- Game-over popup ---
// descriptor: { kind:'gameover', character, level:{number}, title, cause,
//   explanation, tips:string[], guideSections:string[] }
function desktopShowGameOverPopup(descriptor) {
    // Build an encouraging game-over popup around the fictional character.
    const { overlay, content } = createPopup({ contentClass: 'campaign-gameover-popup' });

    const characterHtml = getCampaignCharacterFigureHtml(descriptor.character, 'concern', '', true);

    // Tips from game-over details
    const tipsHtml = (descriptor.tips || [])
        .map(tip => `<li>${tip}</li>`)
        .join('');
    const guideLinksHtml = renderGuideLinkRow(descriptor.guideSections || []);

    // Use the same layout as the intro popup: character left, LEVEL X centred,
    // title + text below left-aligned.
    const levelNum = descriptor.level ? descriptor.level.number : '';
    content.innerHTML = `
        <div class="campaign-intro-header">
            ${characterHtml}
            ${levelNum ? `<h2 class="campaign-day-number">${t('campaign.levelLabel', {n: levelNum})}</h2>` : ''}
        </div>
        <h3 class="campaign-day-title" style="color:#ef4444;">${descriptor.title}</h3>
        <p class="campaign-encouragement">${t('campaign.encouragement')}</p>
        <p>${descriptor.cause || ''}</p>
        <p style="font-size:0.9em; color:#a0aec0;">${descriptor.explanation || ''}</p>
        ${tipsHtml ? `<ul class="campaign-tips-list">${tipsHtml}</ul>` : ''}
        ${guideLinksHtml}
        <div class="popup-button-row">
            <button id="campaignRetryBtn" class="popup-btn-primary">${t('campaign.retry')}</button>
        </div>
        <div class="popup-button-container">
            <button id="campaignMenuBtn" class="popup-btn-link">${t('campaign.quit')}</button>
        </div>
    `;

    // Event handlers
    content.querySelector('#campaignRetryBtn').addEventListener('click', () => {
        overlay.remove();
        campaignEngine.retryCurrentLevel();
    });
    content.querySelector('#campaignMenuBtn').addEventListener('click', () => {
        overlay.remove();
        if (typeof resetGame === 'function') resetGame();
    });
}

// --- Level select popup (5x2 grid with titles, stars, and best points) ---
// descriptor: { kind:'levelSelect', slots:[{index,exists,number,titleKey,
//   unlocked,completed,stars,bestPoints,bestName}], onSelect(index) }
function desktopShowLevelSelectPopup(descriptor) {
    const onSelect = descriptor.onSelect;
    const { overlay, content } = createPopup({ contentClass: 'campaign-select-popup' });

    content.innerHTML = `
        <h3 class="mode-title">${t('campaign.selectLevel')}</h3>
        <div class="level-cards">${buildLevelCardsHtml(descriptor.slots, true)}</div>
        <div class="popup-button-container">
            <button id="levelSelectCloseBtn">${t('popup.close')}</button>
        </div>
    `;

    // Click handlers for playable levels
    content.querySelectorAll('.level-card:not([disabled])').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.levelIndex);
            overlay.remove();
            if (typeof onSelect === 'function') onSelect(index);
        });
    });

    content.querySelector('#levelSelectCloseBtn').addEventListener('click', () => {
        overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });


    // After render: measure the widest button and give all 5 columns the same width,
    // so buttons are equal width (matching the longest title — no wider).
    requestAnimationFrame(() => {
        const cards = content.querySelectorAll('.level-card');
        let maxWidth = 0;
        cards.forEach(card => {
            if (card.offsetWidth > maxWidth) maxWidth = card.offsetWidth;
        });
        if (maxWidth > 0) {
            const grid = content.querySelector('.level-cards');
            if (grid) grid.style.gridTemplateColumns = `repeat(5, ${maxWidth}px)`;
        }
    });
}


// =============================================================================
// buildLevelCardsHtml — Shared grid builder for level-select and highscore
// =============================================================================
// Consumes the slot data from core.buildLevelSelectDescriptor().slots.
// @param {Array} slots — per-slot pure-data descriptors
// @param {boolean} interactive — true = clickable buttons (level-select),
//                                false = static cards (highscore)
// =============================================================================
function buildLevelCardsHtml(slots, interactive) {
    let html = '';

    for (const slot of slots) {
        const i = slot.index;
        const tag = interactive ? 'button' : 'div';
        const cardClass = interactive ? 'level-card' : 'hs-level-card';

        if (slot.exists) {
            const unlocked = slot.unlocked;
            const stars = slot.stars || 0;
            const stateClass = slot.completed ? 'completed' : (unlocked ? 'unlocked' : 'locked');
            const disabledAttr = (interactive && !unlocked) ? ' disabled' : '';
            const indexAttr = interactive ? ` data-level-index="${i}"` : '';

            const starsHtml = [1, 2, 3].map(s =>
                `<span class="lc-star ${s <= stars ? 'earned' : ''}">${s <= stars ? '⭐' : '☆'}</span>`
            ).join('');

            const title = unlocked ? t(slot.titleKey) : '';

            if (unlocked) {
                html += `<${tag} class="${cardClass} ${stateClass}"${indexAttr}${disabledAttr}>
                    <span class="lc-number">${slot.number}</span>
                    <span class="lc-title">${title}</span>
                    <div class="lc-stars">${starsHtml}</div>
                    ${slot.bestPoints > 0 ? `<span class="lc-score">${slot.bestPoints.toFixed(1)} pts</span>` : ''}
                    ${slot.bestName ? `<span class="hs-lc-name">${slot.bestName}</span>` : ''}
                </${tag}>`;
            } else {
                html += `<${tag} class="${cardClass} locked"${disabledAttr}>
                    <span class="lc-number">${slot.number}</span>
                    <span class="lc-lock"><img class="lc-state-icon" src="assets/icons/app/level-locked.png" alt=""></span>
                </${tag}>`;
            }
        } else {
            // Placeholder — under construction (show number + title if i18n key exists)
            const placeholderTitle = t(slot.titleKey);
            const titleHtml = (placeholderTitle && placeholderTitle !== slot.titleKey)
                ? `<span class="lc-title">${placeholderTitle}</span>`
                : '';
            html += `<${tag} class="${cardClass} construction"${interactive ? ' disabled' : ''}>
                <span class="lc-number">${slot.number}</span>
                ${titleHtml}
                <span class="lc-construction"><img class="lc-state-icon" src="assets/icons/app/level-construction.png" alt=""></span>
            </${tag}>`;
        }
    }
    return html;
}


// =============================================================================
// DESKTOP HOST — the adapter object injected into CampaignCore
// =============================================================================
// Wires settings + side-effects + storage to the desktop globals, and routes
// the core's emit* calls to the DOM render functions above.
// =============================================================================
const desktopHost = {
    getSettings: () => ({
        ...appSettings,
        vfxEnabled: typeof vfxEnabled === 'undefined' ? true : vfxEnabled,
    }),
    getGame: () => game,
    playSound: (type) => { if (typeof playSound === 'function') playSound(type); },
    flyIconToGraph: (icon, panelId, sub) => { if (typeof flyIconToGraph === 'function') flyIconToGraph(icon, panelId, sub); },
    showActivityActive: (type, intensity, dur) => { if (typeof showActivityActive === 'function') showActivityActive(type, intensity, dur); },
    isPopupOpen: () => !!document.querySelector('.popup-overlay'),
    // Tutorial-tip 'panelOpen' trigger: is the named dock panel visible?
    isPanelOpen: (panelId) => {
        const panel = document.getElementById(panelId);
        return !!(panel && panel.classList.contains('visible'));
    },
    storage: {
        get: (k) => localStorage.getItem(k),
        set: (k, v) => localStorage.setItem(k, v),
    },
    // Physiology viewing this run = practice mode: the core then skips recording the
    // level's stars/best score (same rule as the sandbox highscore block, ui.js).
    isScoreBlocked: () => typeof trainingModeUsedThisSession !== 'undefined' && trainingModeUsedThisSession,
    // Boot a campaign run: reset, then load the (already-selected) level and
    // start the game. Mirrors the old startLevel(): resetGame, then on a short
    // delay loadLevel(currentLevelIndex) + startGame('campaign').
    requestStart: (mode) => {
        if (typeof resetGame === 'function') resetGame();
        setTimeout(() => {
            campaignEngine.loadLevel(campaignEngine.currentLevelIndex);
            if (typeof startGame === 'function') startGame(mode);
        }, 100);
    },
    // Optional UI highlight for tutorial tips (pulsing glow on a selector).
    highlightElement: (selector) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.classList.add('tutorial-highlight');
        const removeHighlight = () => {
            el.classList.remove('tutorial-highlight');
            el.removeEventListener('click', removeHighlight);
        };
        el.addEventListener('click', removeHighlight);
        setTimeout(removeHighlight, 30000);
    },
    // Dock gating: write the core's pure gating snapshot to the DOM.
    emitGating: (gating) => desktopApplyDockGating(gating),
    // Event popups: returns true if a popup was shown.
    emitPopup: (descriptor) => desktopShowEventPopup(descriptor),
    // Screens: intro | complete | failed | gameover | levelSelect.
    emitScreen: (descriptor) => {
        switch (descriptor.kind) {
            case 'intro':       desktopShowLevelIntroPopup(descriptor); break;
            case 'complete':    desktopShowLevelCompletePopup(descriptor); break;
            case 'failed':      desktopShowLevelFailedPopup(descriptor); break;
            case 'gameover':    desktopShowGameOverPopup(descriptor); break;
            case 'levelSelect': desktopShowLevelSelectPopup(descriptor); break;
        }
    },
};


// =============================================================================
// Global campaign instance — created at load time with the desktop host
// =============================================================================
const campaignEngine = new CampaignCore(desktopHost);


// =============================================================================
// RE-EXPOSED ADAPTER METHODS — keep existing call sites working unchanged
// =============================================================================
// Some external callers (main.js, ui.js) invoke render methods directly on the
// campaignEngine instance. Those render methods now live in the shell, so we
// delegate from the instance to the desktop render functions / descriptors.
// =============================================================================

// Reopen the level-intro popup mid-level (main.js info-button handler).
campaignEngine.showLevelIntroPopup = function (isReopen = false) {
    desktopShowLevelIntroPopup(this.buildIntroDescriptor(isReopen));
};

// Show the level-select popup (ui.js mode menu). onSelect(index) is the callback.
campaignEngine.showLevelSelectPopup = function (onSelect) {
    this.showLevelSelectScreen(onSelect);
};

// renderLevelSelect — referenced by the "unlock all levels" debug toggle in
// main.js. Rebuilds the level grid if the select popup is currently open;
// otherwise a no-op (there is nothing on screen to refresh).
campaignEngine.renderLevelSelect = function () {
    const existingGrid = document.querySelector('.campaign-select-popup .level-cards');
    if (!existingGrid) return;
    existingGrid.innerHTML = buildLevelCardsHtml(this.buildLevelSelectDescriptor().slots, true);
    existingGrid.querySelectorAll('.level-card:not([disabled])').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.levelIndex);
            const overlay = existingGrid.closest('.popup-overlay');
            if (overlay) overlay.remove();
            this.loadLevel(index);
        });
    });
};

// Show/hide the campaign info button in the top bar based on level-active state.
// (Lives in the shell — it is direct DOM access.)
campaignEngine.updateCampaignInfoBtn = function () {
    const btn = document.getElementById('campaignInfoBtn');
    if (!btn) return;
    btn.style.display = (this.levelActive && this.levelConfig) ? '' : 'none';
};
