type CaretTarget = { element: HTMLElement; atEnd: boolean };

export type DescriptionListKeyEvent = {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
};

function isListElement(element: HTMLElement | null): element is HTMLElement {
  return element?.tagName === 'UL' || element?.tagName === 'OL';
}

function listParent(item: HTMLElement): HTMLElement | null {
  const parent = item.parentElement;
  return isListElement(parent) ? parent : null;
}

function directListItems(list: HTMLElement): HTMLLIElement[] {
  return Array.from(list.children).filter((el): el is HTMLLIElement => el.tagName === 'LI');
}

function elementFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
}

function closestListItem(node: Node, root: HTMLElement): HTMLLIElement | null {
  const li = elementFromNode(node)?.closest('li');
  if (!li || !root.contains(li) || li === root) return null;
  return li as HTMLLIElement;
}

/** A bullet line, including headings Chrome left inside or outside the list. */
function bulletBlock(node: Node, root: HTMLElement): HTMLElement | null {
  const el = elementFromNode(node);
  if (!el || !root.contains(el)) return null;
  const li = closestListItem(node, root);
  if (li) return li;
  const block = el.closest('h1,h2,h3,p,div');
  if (!block || block === root || !root.contains(block)) return null;
  if (isListElement(block.parentElement)) return block as HTMLElement;
  return null;
}

function isListItemEmpty(li: HTMLElement): boolean {
  if (li.querySelector('img')) return false;
  const text = (li.textContent ?? '').replace(/[\u200B\uFEFF]/g, '').replace(/\u00a0/g, ' ').trim();
  return text.length === 0;
}

function isCaretAtStartOf(block: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!block.contains(range.startContainer)) return false;
  const before = range.cloneRange();
  try {
    before.selectNodeContents(block);
    before.setEnd(range.startContainer, range.startOffset);
  } catch {
    return false;
  }
  const fragment = before.cloneContents();
  if (fragment.querySelector('img')) return false;
  const text = (fragment.textContent ?? '').replace(/[\u200B\uFEFF]/g, '').replace(/\u00a0/g, ' ').trim();
  return text.length === 0;
}

function collapsedBulletBlock(root: HTMLElement): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null;
  const node = selection.anchorNode;
  if (!node || !root.contains(node)) return null;
  return bulletBlock(node, root);
}

function selectedListItems(root: HTMLElement): HTMLLIElement[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !root.contains(selection.anchorNode)) {
    return [];
  }
  if (selection.isCollapsed) {
    const item = closestListItem(selection.anchorNode, root);
    return item ? [item] : [];
  }
  const range = selection.getRangeAt(0);
  return Array.from(root.querySelectorAll('li')).filter((li) => {
    try {
      return range.intersectsNode(li);
    } catch {
      return false;
    }
  });
}

function firstTextNode(root: Node): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text | null;
}

function lastTextNode(root: Node): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let current: Node | null;
  while ((current = walker.nextNode())) last = current as Text;
  return last;
}

function placeCaret(element: HTMLElement, atEnd: boolean) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  const leaf = atEnd ? lastTextNode(element) : firstTextNode(element);
  if (leaf) {
    range.setStart(leaf, atEnd ? leaf.length : 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(element);
    range.collapse(!atEnd);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function blockFromListItem(item: HTMLElement): HTMLElement {
  if (item.tagName !== 'LI') return item;
  const only = item.childNodes.length === 1 ? item.firstElementChild : null;
  if (only && item.childNodes.length === 1) {
    if (only.tagName === 'DIV') {
      const paragraph = document.createElement('p');
      while (only.firstChild) paragraph.appendChild(only.firstChild);
      if (!paragraph.childNodes.length) paragraph.appendChild(document.createElement('br'));
      return paragraph;
    }
    if (only.tagName === 'P' || only.tagName === 'H1' || only.tagName === 'H2' || only.tagName === 'H3') {
      return only;
    }
  }
  const paragraph = document.createElement('p');
  while (item.firstChild) paragraph.appendChild(item.firstChild);
  if (!paragraph.childNodes.length) paragraph.appendChild(document.createElement('br'));
  return paragraph;
}

function splitOutOfList(item: HTMLElement, list: HTMLElement): CaretTarget | null {
  const parent = list.parentNode;
  if (!parent) return null;
  const children = Array.from(list.children);
  const index = children.indexOf(item);
  if (index < 0) return null;
  const after = children.slice(index + 1);
  const block = blockFromListItem(item);
  if (block.parentNode) block.remove();
  if (item.isConnected) item.remove();
  after.forEach((child) => child.remove());

  if (!list.children.length) {
    parent.insertBefore(block, list);
    list.remove();
  } else {
    parent.insertBefore(block, list.nextSibling);
  }
  if (after.length > 0) {
    const nextList = document.createElement(list.tagName.toLowerCase());
    after.forEach((child) => nextList.appendChild(child));
    parent.insertBefore(nextList, block.nextSibling);
  }
  return { element: block, atEnd: false };
}

function unwrapOrphanListItem(item: HTMLLIElement): CaretTarget | null {
  const parent = item.parentElement;
  if (!parent) return null;
  if (parent.tagName === 'H1' || parent.tagName === 'H2' || parent.tagName === 'H3' || parent.tagName === 'P') {
    while (item.firstChild) parent.insertBefore(item.firstChild, item);
    item.remove();
    if (!parent.childNodes.length) parent.appendChild(document.createElement('br'));
    return { element: parent, atEnd: false };
  }
  const block = blockFromListItem(item);
  if (block.parentNode) block.remove();
  item.replaceWith(block);
  return { element: block, atEnd: false };
}

function liftListItem(item: HTMLElement): CaretTarget | null {
  const list = listParent(item);
  if (list) return splitOutOfList(item, list);
  if (item.tagName === 'LI') return unwrapOrphanListItem(item);
  return null;
}

function removeEmptyListItem(item: HTMLElement): CaretTarget | null {
  const list = listParent(item);
  if (!list) {
    if (item.tagName !== 'LI') return null;
    return unwrapOrphanListItem(item);
  }
  const li = item;
  const items = directListItems(list);
  const index = items.indexOf(li);
  if (index < 0) return null;
  const previousItem = index > 0 ? items[index - 1] : null;
  const nextItem = items[index + 1] ?? null;
  li.remove();
  if (previousItem) return { element: previousItem, atEnd: true };
  if (nextItem?.isConnected) return { element: nextItem, atEnd: false };

  const previousSibling = list.previousElementSibling as HTMLElement | null;
  if (previousSibling) {
    list.remove();
    const lastItem =
      previousSibling.tagName === 'UL' || previousSibling.tagName === 'OL'
        ? directListItems(previousSibling).at(-1) ?? null
        : null;
    return { element: lastItem ?? previousSibling, atEnd: true };
  }

  const paragraph = document.createElement('p');
  paragraph.appendChild(document.createElement('br'));
  list.replaceWith(paragraph);
  return { element: paragraph, atEnd: false };
}

function exitEmptyListItem(item: HTMLElement): CaretTarget | null {
  if (!isListItemEmpty(item)) return null;
  const list = listParent(item);
  const parent = list?.parentNode;
  if (!list || !parent) {
    if (item.tagName !== 'LI') return null;
    return unwrapOrphanListItem(item);
  }
  const li = item;
  const items = directListItems(list);
  const index = items.indexOf(li);
  if (index < 0) return null;
  const after = items.slice(index + 1);
  li.remove();
  after.forEach((item) => item.remove());
  const paragraph = document.createElement('p');
  paragraph.appendChild(document.createElement('br'));
  if (!list.querySelector('li')) {
    list.replaceWith(paragraph);
  } else {
    parent.insertBefore(paragraph, list.nextSibling);
  }
  if (after.length > 0) {
    const nextList = document.createElement(list.tagName.toLowerCase());
    after.forEach((item) => nextList.appendChild(item));
    parent.insertBefore(nextList, paragraph.nextSibling);
  }
  return { element: paragraph, atEnd: false };
}

/** Turn the current bullet lines back into paragraphs. Returns false when the caret is not in a bullet list. */
export function removeUnorderedListAtSelection(root: HTMLElement): boolean {
  const items = selectedListItems(root).filter(
    (li) => li.parentElement?.tagName === 'UL' || !isListElement(li.parentElement),
  );
  if (items.length === 0) return false;
  let focus: CaretTarget | null = null;
  for (const item of [...items].reverse()) {
    if (!item.isConnected) continue;
    focus = isListItemEmpty(item) ? removeEmptyListItem(item) : liftListItem(item);
  }
  if (focus) placeCaret(focus.element, focus.atEnd);
  return focus !== null;
}

function isIgnorableText(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim();
}

function isListItemElement(node: Node): node is HTMLLIElement {
  return node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI';
}

/** Pull headings and paragraphs back out of a list so their text does not cover the bullet. */
function separateForeignListChildren(list: HTMLElement): boolean {
  const parent = list.parentNode;
  if (!parent) return false;
  const meaningful = Array.from(list.childNodes).filter((node) => !isIgnorableText(node));
  if (meaningful.length === 0) return false;
  const hasForeign = meaningful.some((node) => !isListItemElement(node));
  if (!hasForeign) return false;

  const groups: Node[][] = [];
  let current: Node[] = [];
  const flush = () => {
    if (current.length === 0) return;
    groups.push(current);
    current = [];
  };
  for (const node of Array.from(list.childNodes)) {
    if (isListItemElement(node) || (current.length > 0 && isIgnorableText(node) && current.some(isListItemElement))) {
      current.push(node);
      continue;
    }
    if (isIgnorableText(node)) continue;
    flush();
    groups.push([node]);
  }
  flush();

  const fragment = document.createDocumentFragment();
  for (const group of groups) {
    if (group.some(isListItemElement)) {
      const nextList = document.createElement(list.tagName.toLowerCase());
      group.forEach((node) => nextList.appendChild(node));
      fragment.appendChild(nextList);
    } else {
      group.forEach((node) => fragment.appendChild(node));
    }
  }
  list.replaceWith(fragment);
  return true;
}

function firstOrphanListItem(root: HTMLElement): HTMLLIElement | null {
  const items = root.querySelectorAll('li');
  for (const item of items) {
    const parent = item.parentElement;
    if (parent && parent.tagName !== 'UL' && parent.tagName !== 'OL') return item;
  }
  return null;
}

/**
 * Chrome leaves the bullet behind after Backspace and slides the words on top of it.
 * Pull that text out of the broken list so the marker is gone.
 */
export function normalizeDescriptionLists(root: HTMLElement): boolean {
  let changed = false;
  for (const list of Array.from(root.querySelectorAll('ul, ol'))) {
    if (!list.isConnected) continue;
    if (separateForeignListChildren(list)) changed = true;
  }
  let orphan = firstOrphanListItem(root);
  while (orphan) {
    unwrapOrphanListItem(orphan);
    changed = true;
    orphan = firstOrphanListItem(root);
  }
  return changed;
}

/**
 * Backspace at the start of a bullet removes that bullet.
 * Backspace on an empty bullet deletes the line.
 * Enter on an empty bullet leaves the list.
 */
export function handleDescriptionListKeyDown(event: DescriptionListKeyEvent, root: HTMLElement): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.key !== 'Backspace' && event.key !== 'Enter') return false;
  const item = collapsedBulletBlock(root);
  if (!item) return false;

  if (event.key === 'Enter') {
    if (event.shiftKey || !isListItemEmpty(item)) return false;
    const focus = exitEmptyListItem(item);
    if (!focus) return false;
    event.preventDefault();
    placeCaret(focus.element, focus.atEnd);
    return true;
  }

  if (!isListItemEmpty(item) && !isCaretAtStartOf(item)) return false;
  const focus = isListItemEmpty(item) ? removeEmptyListItem(item) : liftListItem(item);
  if (!focus) return false;
  event.preventDefault();
  placeCaret(focus.element, focus.atEnd);
  return true;
}
