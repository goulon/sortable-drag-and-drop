var db = new Dexie("DescriptionDatabase");
db.version(1).stores({
  descriptions: '++id',
  sortedIds: '&id',
});

const inputAreaItemId = 'inputAreaItemId';
let clearButton = document.querySelector('.clear');
let listInput = document.querySelector('#item-input');
let itemList = document.querySelector('#sortableList');
document.onclick = () => saveSortableList();

let sortableList = Sortable.create(itemList, {
  multiDrag: true,
  selectedClass: 'selected',
  animation: 500,
  onUpdate: async () => saveSortableList(),
});

db.open().then(async function () {
  loadList(itemList);
  clearButton.onclick = () => {
    db.descriptions.clear().then(() => {
      db.sortedIds.clear().then(() => loadList(itemList, true));
    });
  }

  listInput.onkeyup = (event) => {
    if (event.keyCode === 13) {
      // to represent unique entries, id stores milliseconds since the UNIX epoch
      let newItemObject = { id: Date.now(), text: listInput.value };
      createItem(newItemObject);
      removeItem(null, itemList, inputAreaItemId);
    } else {
      let newItemObject = { id: inputAreaItemId, text: listInput.value };
      editItem(event, newItemObject);
    }
  }
}).catch(error => {
  console.log('ERROR: ', error);
})

/**
 * Loads the item list to the DOM.
 *
 * @param {array} itemList The item list to delete the item from.
 * @param {boolean} clear To clear the list content from the DOM.
 * @return {undefined} No return.
 */
function loadList(itemList, clear = false) {
  if (clear) {
    itemList.innerHTML = '';
  }
  // Loads saved items to the item list
  db.sortedIds.get('sortedList').then(data => {
    let list = JSON.parse(data.sortedList);
    list.forEach(itemId => {
      db.descriptions.get(itemId).then(item => {
        addItemToList(itemList, item);
      })
    })
  });
  // Loads unsaved item to the input area
  db.descriptions.get(inputAreaItemId).then(item => {
    if (item) listInput.value = item.text;
  });
}

/**
 * Returns the ordered list of item ids.
 *
 * @return {array} array of item ids in the order they appear.
 */
function getOrderedList() {
  let list = [...document.querySelector('#sortableList').childNodes]
    .filter(x => x.className === 'list-group-item')
    .map(x => parseInt(x.dataset.id));
  console.log(list);
  return list;
}

/**
 * Writes sorted list of ids to indexedDB's sortedIds table.
 *
 * @return {undefined} no return.
 */
function saveSortableList() {
  let orderedList = getOrderedList();
  db.sortedIds.put({ id: 'sortedList', sortedList: JSON.stringify(orderedList) }, 'sortedList');
}

/**
 * Creates an HTML input element containing the item text.
 *
 * @param {object} itemObject The item object populate DOM item.
 * @return {HTMLElement} HTML input element created from the item object.
 */
function createItemTextInput(itemObject) {
  let itemTextInput = document.createElement('input');
  itemTextInput.classList.add('list-group-item-text')
  itemTextInput.type = "text";
  itemTextInput.maxLength = 25;
  itemTextInput.value = itemObject.text;
  return itemTextInput;
}

/**
 * Creates an HTML button element to delete the item.
 *
 * @param {object} itemList The item list used from which to remove items.
 * @return {HTMLElement} HTML button element used to delete the item.
 */
function createItemDeleteButton(itemList) {
  let itemDeleteButton = document.createElement('button');
  itemDeleteButton.innerText = 'x';
  itemDeleteButton.classList.add('btn-delete');
  itemDeleteButton.onclick = (event => removeItem(event, itemList));
  return itemDeleteButton;
}

/**
 * Verifies user input length.
 *
 * @return {undefined} Only throws an error if input length is over 25 char.
 */
// Check input length
function checkTextLength(text) {
  if (text.length > 25) throw new Error('Input text is too long. Only 25 characters are allowed.')
}


/**
 * Creates a new item in indexedDB.
 *
 * @param {object} newItemObject The item to write in the DB.
 * @return {undefined} No return.
 */
function createItem(newItemObject) {
  checkTextLength(newItemObject.text);
  db.descriptions.add(newItemObject).then((newObjectId) => {
    db.descriptions.get(newObjectId).then(newObject => {
      addItemToList(itemList, newObject);
      saveSortableList();
    })
  }).then(() => listInput.value = '')
    .catch(error => console.log('Error creating new item: ', error));
}

/**
 * Reads a new item from indexedDB.
 *
 * @param {array} itemList The item list to delete the item from.
 * @param {object} itemObject The item object to read text from.
 * @return {undefined} No return.
 */
function addItemToList(itemList, itemObject) {
  let newItem = document.createElement('div');

  newItem.dataset.id = itemObject.id;
  newItem.classList.add('list-group-item');

  newItem.appendChild(createItemTextInput(itemObject));
  newItem.appendChild(createItemDeleteButton(itemList));

  newItem.onkeyup = (event => editItem(event, newItem));
  itemList.appendChild(newItem);
}

/**
 * Updates an item in indexedDB.
 *
 * @param {Event} event The event that triggered the item editing.
 * @param {object} item The item object to edit. Optional.
 * @return {undefined} No return.
 */
function editItem(event, item = null) {
  const updatedText = event.target.value;
  let itemId = item ? item.id : parseInt(event.target.parentNode.dataset.id);

  checkTextLength(updatedText);
  db.descriptions.update(itemId, { text: updatedText }).then((updated) => {
    if (!updated) {
      itemId = itemId === inputAreaItemId ? itemId : Date.now();
      let newItemObject = { id: itemId, text: updatedText };
      db.descriptions.put(newItemObject)
    }
  }).catch(error => {
    console.log('Error while updating object: ', error);
  });
}

/**
 * Deletes an item from indexedDB.
 *
 * @param {Event} event The event that triggered the item removal.
 * @param {Array} itemList The item list to remove from.
 * @param {number} itemId The item id to delete from the DB. Optional.
 * @return {undefined} No return.
 */
// Delete operation
function removeItem(event, itemList, itemId = null) {
  let itemKey;
  if (event) {
    const nodeToRemove = event.target.parentNode;
    itemKey = parseInt(nodeToRemove.dataset.id);
    itemList.removeChild(nodeToRemove);
  } else {
    itemKey = itemId;
  }
  db.descriptions.delete(itemKey).then(() => {
    saveSortableList();
  }).catch(error => {
    console.log('Error while rmeoving item: ', error);
  })
}