(function (YW) {
  YW.media = YW.media || {};

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function readFilesAsDataURLs(files) {
    const photoUrls = [];
    for (const file of files) {
      photoUrls.push(await readFileAsDataURL(file));
    }
    return photoUrls;
  }

  Object.assign(YW.media, {
    readFileAsDataURL,
    readFilesAsDataURLs,
  });
})(window.YW);
