(function (window) {
  const YW = window.YW = window.YW || {};
  YW.config = {
    DEFAULT_ITEM_DATE: '1998-03-25',
    DATE_MIN_YEAR: 1950,
    DB_NAME: 'yw_gallery_v1',
    DB_VERSION: 1,
    DB_STORE: 'app_data',
    DB_KEY: 'state',
    STORAGE_KEY: 'yw_data',
    CROP_JPEG_QUALITY: 0.92,
    CROP_OUTPUT_BASE: 1200,
    isMacDevice: matchMedia('(hover: hover) and (pointer: fine)').matches,
  };
})(window);
