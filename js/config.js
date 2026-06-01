(function (YW) {
  const today = new Date();
  YW.config = {
    DEFAULT_ITEM_DATE: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    DATE_MIN_YEAR: 1950,
    DATE_PICKER_SCROLL_DEBOUNCE_MS: 150,
    DB_NAME: 'yw_gallery_v1',
    DB_VERSION: 1,
    DB_STORE: 'app_data',
    DB_KEY: 'state',
    STORAGE_KEY: 'yw_data',
    SAVE_FAILURE_MESSAGE: '保存失败，数据未写入，请导出备份或稍后重试',
    CROP_JPEG_QUALITY: 0.92,
    CROP_OUTPUT_BASE: 1200,
    CROP_INITIAL_RECT_RATIO: 0.8,
    CROP_MIN_SIZE: 20,
    CROP_ASPECT_RATIO_TOLERANCE: 0.01,
    RAIL_SCROLL_THRESHOLD: 8,
    RAIL_MAX_SCROLL_THRESHOLD: 2,
    RAIL_FADE_WIDTH_PX: 32,
    NAV_HEIGHT_WITH_ATHLETES: '120px',
    NAV_HEIGHT_NO_ATHLETES: '66px',
    isMacDevice: matchMedia('(hover: hover) and (pointer: fine)').matches,
  };
})(window.YW);
