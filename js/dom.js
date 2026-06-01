(function (YW) {
  YW.dom = YW.dom || {};

  const elements = {};

  function cacheElements() {
    Object.assign(elements, {
      homeButton: document.querySelector('#homeButton'),
      addButton: document.querySelector('#addButton'),
      settingsButton: document.querySelector('#settingsButton'),
      emptySettingsButton: document.querySelector('#emptySettingsButton'),

      homeView: document.querySelector('#homeView'),
      athleteView: document.querySelector('#athleteView'),
      addView: document.querySelector('#addView'),
      settingsView: document.querySelector('#settingsView'),
      appMain: document.querySelector('.app-main'),

      athleteSwitcher: document.querySelector('#athleteSwitcher'),
      switcherScrollArea: document.querySelector('.switcher-scroll-area'),
      homeEmptyState: document.querySelector('#homeEmptyState'),
      athleteSelectorGrid: document.querySelector('#athleteSelectorGrid'),
      athleteDetailHero: document.querySelector('#athleteDetailHero'),
      athleteGallery: document.querySelector('#athleteGallery'),
      athleteGroupedContent: document.querySelector('#athleteGroupedContent'),

      settingsPersonSelect: document.querySelector('#settingsPersonSelect'),
      gallerySettingsBlock: document.querySelector('#gallerySettingsBlock'),
      galleryToggleBtn: document.querySelector('#galleryToggleBtn'),
      galleryManageBtn: document.querySelector('#galleryManageBtn'),
      galleryPhotoCount: document.querySelector('#galleryPhotoCount'),
      overviewPersonSelect: document.querySelector('#overviewPersonSelect'),
      settingsPersonHomePhotoInput: document.querySelector('#settingsPersonHomePhotoInput'),
      settingsPersonDetailPhotoInput: document.querySelector('#settingsPersonDetailPhotoInput'),
      settingsDeletePersonBtn: document.querySelector('#settingsDeletePersonBtn'),
      categoryOverviewList: document.querySelector('#categoryOverviewList'),

      personForm: document.querySelector('#personForm'),
      groupForm: document.querySelector('#groupForm'),
      categoryForm: document.querySelector('#categoryForm'),
      itemForm: document.querySelector('#itemForm'),

      categoryGroupSelect: document.querySelector('#categoryGroupSelect'),
      itemPersonSelect: document.querySelector('#itemPersonSelect'),
      itemGroupSelect: document.querySelector('#itemGroupSelect'),
      itemCategorySelect: document.querySelector('#itemCategorySelect'),
      itemOwnedNowInput: document.querySelector('#itemOwnedNowInput'),
      itemGiftInput: document.querySelector('#itemGiftInput'),
      itemPhotosInput: document.querySelector('#itemPhotosInput'),
      clearItemFilesButton: document.querySelector('#clearItemFilesButton'),
      itemPhotosSummary: document.querySelector('#itemPhotosSummary'),
      personHomePhotoInput: document.querySelector('#personHomePhotoInput'),
      personDetailPhotoInput: document.querySelector('#personDetailPhotoInput'),
      personHomePhotoSummary: document.querySelector('#personHomePhotoSummary'),
      personDetailPhotoSummary: document.querySelector('#personDetailPhotoSummary'),

      exportDataBtn: document.querySelector('#exportDataBtn'),
      importDataInput: document.querySelector('#importDataInput'),

      itemActionsModal: document.querySelector('#itemActionsModal'),
      itemActionManageBtn: document.querySelector('#itemActionManageBtn'),
      itemActionDeleteBtn: document.querySelector('#itemActionDeleteBtn'),
      itemStatusToggles: document.querySelectorAll('.toggle-switch[data-status-toggle]'),
      cropModal: document.querySelector('#cropModal'),
      cropPreviewContainer: document.querySelector('#cropPreviewContainer'),
      cropImage: document.querySelector('#cropImage'),
      cropConfirmBtn: document.querySelector('#cropConfirmBtn'),
      cropSkipBtn: document.querySelector('#cropSkipBtn'),
      cropRect: document.querySelector('#cropRect'),
      cropHandles: document.querySelectorAll('.crop-handle'),

      customModal: document.querySelector('#customModal'),
      modalMessage: document.querySelector('#modalMessage'),
      modalConfirmBtn: document.querySelector('#modalConfirmBtn'),
      photoManageModal: document.querySelector('#photoManageModal'),
      photoThumbGrid: document.querySelector('#photoThumbGrid'),
      modalPhotoInput: document.querySelector('#modalPhotoInput'),
      modalPhotoAddBtn: document.querySelector('#modalPhotoAddBtn'),
      modalPhotoDeleteBtn: document.querySelector('#modalPhotoDeleteBtn'),

      itemDateHidden: document.querySelector('#itemDateHidden'),
      itemDateDisplay: document.querySelector('#itemDateDisplay'),
      datePickerModal: document.querySelector('#datePickerModal'),
      datePickerCancelBtn: document.querySelector('#datePickerCancelBtn'),
      datePickerConfirmBtn: document.querySelector('#datePickerConfirmBtn'),
      dateYearScroll: document.querySelector('[data-col="year"]'),
      dateMonthScroll: document.querySelector('[data-col="month"]'),
      dateDayScroll: document.querySelector('[data-col="day"]'),
    });

    // Templates
    elements.templates = {
      switcherChip: document.querySelector('#switcherChipTemplate'),
      selectorCard: document.querySelector('#selectorCardTemplate'),
      detailHero: document.querySelector('#detailHeroTemplate'),
      categorySection: document.querySelector('#categorySectionTemplate'),
      subcategory: document.querySelector('#subcategoryTemplate'),
      ywCard: document.querySelector('#ywCardTemplate'),
      galleryCard: document.querySelector('#galleryCardTemplate'),
      textItem: document.querySelector('#textItemTemplate'),
      overviewGroup: document.querySelector('#overviewGroupTemplate'),
      overviewCategory: document.querySelector('#overviewCategoryTemplate'),
      photoThumb: document.querySelector('#photoThumbTemplate'),
    };
  }

  Object.assign(YW.dom, { elements, cacheElements });
})(window.YW);
