(function (YW) {
  const STORAGE_KEY = "yw_gallery_next_data";
  const DB_NAME = "yw_gallery_next_v1";
  const DB_STORE = "app_data";
  const DB_KEY = "state";
  const SCHEMA_VERSION = 1;
  const isFileProtocol = window.location.protocol === "file:";
  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  YW.config = {
    STORAGE_KEY,
    DB_NAME,
    DB_STORE,
    DB_KEY,
    SCHEMA_VERSION,
    isFileProtocol,
    isFinePointer,
  };
})(window.YW);
