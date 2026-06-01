(function (YW) {
  YW.drag = YW.drag || {};

  function createDragHandler({ dragOverClass, onDrop }) {
    return function attachDrag(element, id) {
      if (!YW.config.isMacDevice) return;
      element.draggable = true;
      element.addEventListener('dragstart', (event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
        element.classList.add('dragging');
      });
      element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        document.querySelectorAll('.' + dragOverClass + '.drag-over').forEach((node) => node.classList.remove('drag-over'));
      });
      element.addEventListener('dragenter', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (!element.classList.contains('dragging')) element.classList.add('drag-over');
      });
      element.addEventListener('dragover', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (element.classList.contains('dragging')) return;
        event.dataTransfer.dropEffect = 'move';
        element.classList.add('drag-over');
      });
      element.addEventListener('dragleave', () => { element.classList.remove('drag-over'); });
      element.addEventListener('drop', (event) => {
        event.stopPropagation();
        event.preventDefault();
        element.classList.remove('drag-over');
        const draggedId = event.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === id) return;
        onDrop(draggedId, id, element, event);
      });
    };
  }

  function reorderRailCardsByItemList(itemsInOrder) {
    if (!itemsInOrder.length) return;
    const firstCard = document.querySelector('.rail-card[data-item-id="' + itemsInOrder[0].id + '"]');
    if (!firstCard || !firstCard.parentElement) return;
    const rail = firstCard.parentElement;
    const itemOrderMap = new Map(itemsInOrder.map(function (item, i) { return [item.id, i]; }));
    const cards = Array.from(rail.querySelectorAll('.rail-card'));
    cards.sort(function (a, b) {
      const aOrder = itemOrderMap.get(a.dataset.itemId);
      const bOrder = itemOrderMap.get(b.dataset.itemId);
      return (aOrder != null ? aOrder : 999) - (bOrder != null ? bOrder : 999);
    });
    for (let i = 0; i < cards.length; i++) {
      rail.appendChild(cards[i]);
    }
  }

  const attachItemDrag = createDragHandler({
    dragOverClass: 'rail-card',
    onDrop: (draggedId, targetId) => {
      const itemsInOrder = YW.data.reorderItemsByDrag(draggedId, targetId);
      if (itemsInOrder) reorderRailCardsByItemList(itemsInOrder);
    },
  });

  const attachOverviewGroupDrag = createDragHandler({
    dragOverClass: 'overview-group-card',
    onDrop: (draggedId, targetId, targetEl) => {
      const personId = targetEl.dataset.personId || YW.state.viewState.overviewPersonId;
      if (personId && YW.data.reorderGroupsForPerson(personId, draggedId, targetId)) YW.render.renderAll();
    },
  });

  const attachOverviewCategoryDrag = createDragHandler({
    dragOverClass: 'overview-category-row',
    onDrop: (draggedId, targetId, targetEl) => {
      const personId = targetEl.dataset.personId || YW.state.viewState.overviewPersonId;
      const groupId = targetEl.dataset.groupId;
      if (personId && groupId && YW.data.reorderCategoriesForPersonGroup(personId, groupId, draggedId, targetId)) YW.render.renderAll();
    },
  });

  const attachGalleryDrag = createDragHandler({
    dragOverClass: 'gallery-card',
    onDrop: (draggedIndex, targetIndex, targetEl) => {
      const rail = targetEl.closest('.gallery-rail');
      const personId = rail ? rail.dataset.galleryPersonId : null;
      const person = personId ? YW.data.reorderGalleryPhotos(personId, draggedIndex, targetIndex) : null;
      if (!person) return;
      YW.render.renderGallery(person);
      YW.railMask.setupRailMasks();
    },
  });

  Object.assign(YW.drag, { createDragHandler, attachItemDrag, attachOverviewGroupDrag, attachOverviewCategoryDrag, attachGalleryDrag });
})(window.YW);
