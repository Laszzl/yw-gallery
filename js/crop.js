(function (YW) {
  YW.crop = YW.crop || {};

  const elements = YW.dom.elements;
  const { CROP_JPEG_QUALITY, CROP_OUTPUT_BASE } = YW.config;

  let cropResolve = null;
  let cropState = { file: null, aspectRatio: 1, imgNaturalW: 0, imgNaturalH: 0, imgX: 0, imgY: 0, imgW: 0, imgH: 0, cx: 0, cy: 0, cw: 0, ch: 0, containerW: 0, containerH: 0 };
  let cropDrag = { active: false, mode: null, handle: null, startX: 0, startY: 0, snapCX: 0, snapCY: 0, snapCW: 0, snapCH: 0 };

  function failCropRead() {
    closeCropModal(createCropResult('error'));
    YW.modals.showModal('图片无法读取，请更换图片');
  }

  function showCropModal(file, aspectRatio) {
    return new Promise((resolve) => {
      cropResolve = resolve;
      cropState.file = file;
      cropState.aspectRatio = aspectRatio;
      const container = elements.cropPreviewContainer;
      container.className = 'crop-preview-container';
      if (aspectRatio === 1) container.classList.add('square');
      else if (Math.abs(aspectRatio - YW.config.CROP_INITIAL_RECT_RATIO) < YW.config.CROP_ASPECT_RATIO_TOLERANCE) container.classList.add('portrait-45');
      else container.classList.add('portrait-34');
      const reader = new FileReader();
      reader.onerror = failCropRead;
      reader.onload = function (e) {
        elements.cropImage.onerror = failCropRead;
        elements.cropImage.onload = function () {
          requestAnimationFrame(function () { initCropLayout(); renderCropOverlay(); });
        };
        elements.cropImage.src = e.target.result;
      };
      reader.readAsDataURL(file);
      bindCropDocListeners();
      elements.cropModal.hidden = false;
    });
  }

  function createCropResult(type, file) { return { type, file: file ?? null }; }
  function resolveCroppedFile(originalFile, cropResult) {
    if (!cropResult || cropResult.type === 'cancel') return null;
    if (cropResult.type === 'original') return originalFile;
    if (cropResult.type === 'crop' && cropResult.file) {
      return new File([cropResult.file], originalFile.name, { type: 'image/jpeg' });
    }
    return null;
  }

  function initCropLayout() {
    const container = elements.cropPreviewContainer;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    cropState.containerW = cw;
    cropState.containerH = ch;
    const iw = elements.cropImage.naturalWidth;
    const ih = elements.cropImage.naturalHeight;
    cropState.imgNaturalW = iw;
    cropState.imgNaturalH = ih;
    const fitScale = Math.min(cw / iw, ch / ih);
    cropState.imgW = Math.round(iw * fitScale);
    cropState.imgH = Math.round(ih * fitScale);
    cropState.imgX = Math.round((cw - cropState.imgW) / 2);
    cropState.imgY = Math.round((ch - cropState.imgH) / 2);
    const ratio = cropState.aspectRatio;
    const maxW = cropState.imgW;
    const maxH = cropState.imgH;
    const R = YW.config.CROP_INITIAL_RECT_RATIO;
    let rectW = Math.round(maxW * R);
    let rectH = Math.round(rectW / ratio);
    if (rectH > maxH * R) { rectH = Math.round(maxH * R); rectW = Math.round(rectH * ratio); }
    cropState.cx = Math.round(cropState.imgX + (maxW - rectW) / 2);
    cropState.cy = Math.round(cropState.imgY + (maxH - rectH) / 2);
    cropState.cw = rectW;
    cropState.ch = rectH;
  }

  function viewScale() {
    if (!cropState.imgNaturalW) return 1;
    return cropState.imgW / cropState.imgNaturalW;
  }

  function renderCropOverlay() {
    const img = elements.cropImage;
    img.style.width = cropState.imgW + 'px';
    img.style.height = cropState.imgH + 'px';
    img.style.left = cropState.imgX + 'px';
    img.style.top = cropState.imgY + 'px';
    const rect = elements.cropRect;
    rect.style.left = cropState.cx + 'px';
    rect.style.top = cropState.cy + 'px';
    rect.style.width = cropState.cw + 'px';
    rect.style.height = cropState.ch + 'px';
  }

  function clampCropRect() {
    const c = cropState;
    const minSize = YW.config.CROP_MIN_SIZE;
    if (c.cw < minSize) c.cw = minSize;
    if (c.ch < minSize) c.ch = minSize;
    if (c.cw > c.imgW) c.cw = c.imgW;
    if (c.ch > c.imgH) c.ch = c.imgH;
    if (c.cx < c.imgX) c.cx = c.imgX;
    if (c.cy < c.imgY) c.cy = c.imgY;
    if (c.cx + c.cw > c.imgX + c.imgW) c.cx = c.imgX + c.imgW - c.cw;
    if (c.cy + c.ch > c.imgY + c.imgH) c.cy = c.imgY + c.imgH - c.ch;
    if (c.cx < c.imgX) c.cx = c.imgX;
    if (c.cy < c.imgY) c.cy = c.imgY;
  }

  async function performCrop() {
    const img = elements.cropImage;
    const c = cropState;
    const vs = viewScale();
    const sx = Math.max(0, (c.cx - c.imgX) / vs);
    const sy = Math.max(0, (c.cy - c.imgY) / vs);
    const sw = Math.min(c.cw / vs, c.imgNaturalW - sx);
    const sh = Math.min(c.ch / vs, c.imgNaturalH - sy);
    let outputBase = CROP_OUTPUT_BASE;
    let canvasW, canvasH;
    const ratio = c.aspectRatio;
    if (ratio >= 1) { canvasW = outputBase; canvasH = Math.round(outputBase / ratio); }
    else { canvasH = outputBase; canvasW = Math.round(outputBase * ratio); }
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx || sw <= 0 || sh <= 0) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, canvasW, canvasH);
    return new Promise((resolve) => { canvas.toBlob(resolve, 'image/jpeg', CROP_JPEG_QUALITY); });
  }

  function unbindCropDocListeners() {
    document.removeEventListener('mousemove', moveCropDrag);
    document.removeEventListener('touchmove', moveCropDrag);
    document.removeEventListener('mouseup', endCropDrag);
    document.removeEventListener('touchend', endCropDrag);
  }

  function bindCropDocListeners() {
    unbindCropDocListeners(); // ensure no duplicates
    document.addEventListener('mousemove', moveCropDrag);
    document.addEventListener('touchmove', moveCropDrag, { passive: false });
    document.addEventListener('mouseup', endCropDrag);
    document.addEventListener('touchend', endCropDrag);
  }

  function prepareCropModalClose() {
    elements.cropModal.hidden = true;
    endCropDrag();
    unbindCropDocListeners();
    elements.cropImage.onload = null;
    elements.cropImage.onerror = null;
    elements.cropImage.src = '';
  }

  function closeCropModal(result) {
    prepareCropModalClose();
    if (cropResolve) { cropResolve(result); cropResolve = null; }
  }

  function eventCoords(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  }

  function startCropDrag(e, mode, handle) {
    const coords = eventCoords(e);
    cropDrag.active = true; cropDrag.mode = mode; cropDrag.handle = handle;
    cropDrag.startX = coords.x; cropDrag.startY = coords.y;
    cropDrag.snapCX = cropState.cx; cropDrag.snapCY = cropState.cy;
    cropDrag.snapCW = cropState.cw; cropDrag.snapCH = cropState.ch;
  }

  function moveCropDrag(e) {
    if (!cropDrag.active || elements.cropModal.hidden) return;
    const coords = eventCoords(e);
    if (cropDrag.mode === 'rect') {
      const newCX = cropDrag.snapCX + (coords.x - cropDrag.startX);
      const newCY = cropDrag.snapCY + (coords.y - cropDrag.startY);
      cropState.cx = newCX;
      cropState.cy = newCY;
      clampCropRect();
      if (cropState.cx !== newCX || cropState.cy !== newCY) {
        cropDrag.snapCX = cropState.cx;
        cropDrag.snapCY = cropState.cy;
        cropDrag.startX = coords.x;
        cropDrag.startY = coords.y;
      }
    } else {
      handleCornerDrag(coords.x, coords.y);
      clampCropRect();
    }
    renderCropOverlay();
  }

  function bindCropModalEvents() {
    const handles = elements.cropHandles;
    for (let i = 0; i < handles.length; i++) {
      const handleName = handles[i].dataset.handle;
      handles[i].addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); startCropDrag(e, 'handle', handleName); });
      handles[i].addEventListener('touchstart', (e) => { if (e.touches.length !== 1) return; e.preventDefault(); e.stopPropagation(); startCropDrag(e, 'handle', handleName); });
    }

    const cropRect = elements.cropRect;
    cropRect.addEventListener('mousedown', (e) => { if (e.target !== cropRect) return; e.preventDefault(); startCropDrag(e, 'rect', null); });
    cropRect.addEventListener('touchstart', (e) => { if (e.target !== cropRect || e.touches.length !== 1) return; e.preventDefault(); startCropDrag(e, 'rect', null); });

    elements.cropConfirmBtn.addEventListener('click', async () => {
      let blob;
      try {
        blob = await performCrop();
      } catch (err) {
        console.error(err);
        failCropRead();
        return;
      }
      if (!blob) {
        failCropRead();
        return;
      }
      closeCropModal(createCropResult('crop', blob));
    });
    elements.cropSkipBtn.addEventListener('click', () => { closeCropModal(createCropResult('original')); });
    elements.cropModal.addEventListener('click', (event) => {
      if (event.target === elements.cropModal) closeCropModal(createCropResult('cancel'));
    });
  }

  function endCropDrag() { cropDrag.active = false; cropDrag.mode = null; }

  function handleCornerDrag(clientX, clientY) {
    const dx = clientX - cropDrag.startX;
    const dy = clientY - cropDrag.startY;
    const snap = { cx: cropDrag.snapCX, cy: cropDrag.snapCY, cw: cropDrag.snapCW, ch: cropDrag.snapCH };
    const ratio = cropState.aspectRatio;
    const h = cropDrag.handle;
    const img = { x: cropState.imgX, y: cropState.imgY, w: cropState.imgW, h: cropState.imgH };
    let anchorX, anchorY, newW, newH;

    if (h === 'tl') {
      anchorX = snap.cx + snap.cw; anchorY = snap.cy + snap.ch;
      newW = anchorX - (snap.cx + dx); newH = anchorY - (snap.cy + dy);
    } else if (h === 'tr') {
      anchorX = snap.cx; anchorY = snap.cy + snap.ch;
      newW = (snap.cx + snap.cw + dx) - anchorX; newH = anchorY - (snap.cy + dy);
    } else if (h === 'bl') {
      anchorX = snap.cx + snap.cw; anchorY = snap.cy;
      newW = anchorX - (snap.cx + dx); newH = (snap.cy + snap.ch + dy) - anchorY;
    } else {
      anchorX = snap.cx; anchorY = snap.cy;
      newW = (snap.cx + snap.cw + dx) - anchorX; newH = (snap.cy + snap.ch + dy) - anchorY;
    }

    if (!isFinite(newW) || !isFinite(newH) || newW <= 0 || newH <= 0) {
      newW = YW.config.CROP_MIN_SIZE; newH = YW.config.CROP_MIN_SIZE / ratio;
    }

    // Apply crop aspect ratio before boundary clamping
    if (isFinite(newW / newH) && newW / newH > ratio) newW = newH * ratio;
    else if (isFinite(newW / newH)) newH = newW / ratio;

    // Per-handle boundary clamping: anchor stays fixed, scale down to fit within image
    let maxW, maxH;
    if (h === 'tl' || h === 'bl') {
      maxW = anchorX - img.x;
    } else {
      maxW = (img.x + img.w) - anchorX;
    }
    if (h === 'tl' || h === 'tr') {
      maxH = anchorY - img.y;
    } else {
      maxH = (img.y + img.h) - anchorY;
    }
    if (newW > maxW || newH > maxH) {
      const scale = Math.min(maxW / newW, maxH / newH);
      newW *= scale; newH *= scale;
    }

    // Overall max size guard
    const maxSize = Math.max(img.w, img.h);
    if (newW > maxSize || newH > maxSize) {
      const scale = Math.min(maxSize / newW, maxSize / newH);
      newW *= scale; newH *= scale;
    }

    // Min size guard (aspect-ratio aware)
    if (newW < YW.config.CROP_MIN_SIZE) { newW = YW.config.CROP_MIN_SIZE; newH = YW.config.CROP_MIN_SIZE / ratio; }
    if (newH < YW.config.CROP_MIN_SIZE) { newH = YW.config.CROP_MIN_SIZE; newW = YW.config.CROP_MIN_SIZE * ratio; }

    if (h === 'tl' || h === 'bl') cropState.cx = anchorX - newW;
    else cropState.cx = anchorX;
    if (h === 'tl' || h === 'tr') cropState.cy = anchorY - newH;
    else cropState.cy = anchorY;
    cropState.cw = newW;
    cropState.ch = newH;
  }

  async function cropFile(file, aspectRatio) {
    const cropResult = await showCropModal(file, aspectRatio);
    return resolveCroppedFile(file, cropResult);
  }

  async function cropInputFiles(input, { aspectRatio, multiple = false }) {
    const files = [...(input.files ?? [])].filter((file) => file.size > 0);
    if (!files.length) { YW.forms.syncFileSummaries(); return; }

    const cropped = [];
    for (const file of multiple ? files : files.slice(0, 1)) {
      const finalFile = await cropFile(file, aspectRatio);
      if (!finalFile) {
        if (cropped.length) YW.forms.setInputFiles(input, cropped);
        else input.value = '';
        YW.forms.syncFileSummaries();
        return;
      }
      cropped.push(finalFile);
    }

    YW.forms.setInputFiles(input, cropped);
    YW.forms.syncFileSummaries();
  }
  // ═══════════════════════════════════════════════

  Object.assign(YW.crop, {
    showCropModal,
    createCropResult,
    resolveCroppedFile,
    closeCropModal,
    bindCropModalEvents,
    cropFile,
    cropInputFiles,
  });
})(window.YW);
