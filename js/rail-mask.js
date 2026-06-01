(function (YW) {
  function updateRailMask(rail) {
    const scrollLeft = rail.scrollLeft;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    const isPhone = matchMedia('(max-width: 768px)').matches;
    const T = YW.config.RAIL_SCROLL_THRESHOLD;
    const MAX_T = YW.config.RAIL_MAX_SCROLL_THRESHOLD;
    const fadeWidth = YW.config.RAIL_FADE_WIDTH_PX + 'px';

    if (isPhone) {
      const atStart = scrollLeft <= T;
      const atEnd = maxScroll <= MAX_T || scrollLeft >= maxScroll - T;
      rail.style.setProperty('--rail-fade-l', atStart ? '0' : '1');
      rail.style.setProperty('--rail-fade-r', atEnd ? '0' : '1');
      return;
    }

    if (maxScroll <= MAX_T) {
      rail.style.setProperty('--rail-mask-image', 'none');
      return;
    }

    const atStart = scrollLeft <= T;
    const atEnd = scrollLeft >= maxScroll - T;

    let maskImage;
    if (atStart && atEnd) {
      maskImage = 'none';
    } else if (atStart) {
      maskImage = 'linear-gradient(to right, black 0%, black calc(100% - ' + fadeWidth + '), transparent 100%)';
    } else if (atEnd) {
      maskImage = 'linear-gradient(to right, transparent 0%, black ' + fadeWidth + ', black 100%)';
    } else {
      maskImage = 'linear-gradient(to right, transparent 0%, black ' + fadeWidth + ', black calc(100% - ' + fadeWidth + '), transparent 100%)';
    }

    rail.style.setProperty('--rail-mask-image', maskImage);
  }

  let _railMaskResizeObserver = null;
  const _railMaskPending = new WeakMap();
  const _railMaskObserved = new Set();

  function scheduleRailMask(rail) {
    if (_railMaskPending.get(rail)) return;
    _railMaskPending.set(rail, true);
    requestAnimationFrame(function () {
      _railMaskPending.set(rail, false);
      updateRailMask(rail);
    });
  }

  function setupRailMasks() {
    if (!_railMaskResizeObserver) {
      _railMaskResizeObserver = new ResizeObserver(function (entries) {
        for (let i = 0; i < entries.length; i++) {
          scheduleRailMask(entries[i].target);
        }
      });
    }

    const rails = document.querySelectorAll('.rail-list');
    const currentRails = new Set(rails);
    for (const rail of Array.from(_railMaskObserved)) {
      if (!currentRails.has(rail) || !document.contains(rail)) {
        _railMaskResizeObserver.unobserve(rail);
        _railMaskObserved.delete(rail);
      }
    }
    for (let i = 0; i < rails.length; i++) {
      const rail = rails[i];
      if (rail.dataset.railMaskSetup) {
        updateRailMask(rail);
        continue;
      }
      rail.dataset.railMaskSetup = '1';
      rail.addEventListener('scroll', function () {
        scheduleRailMask(this);
      }, { passive: true });
      _railMaskResizeObserver.observe(rail);
      _railMaskObserved.add(rail);
      updateRailMask(rail);
    }
  }

  YW.railMask = { updateRailMask, scheduleRailMask, setupRailMasks };
})(window.YW);
