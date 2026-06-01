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

  Object.assign(YW.drag, { createDragHandler });
})(window.YW);
