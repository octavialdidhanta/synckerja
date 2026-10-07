import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleDescriptionListKeyDown,
  normalizeDescriptionLists,
  removeUnorderedListAtSelection,
  type DescriptionListKeyEvent,
} from '@/8-2-DailyTask/lib/taskStepDescriptionLists';

function mount(html: string) {
  const root = document.createElement('div');
  root.contentEditable = 'true';
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function caretAt(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function press(key: string): DescriptionListKeyEvent {
  return {
    key,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('step description bullets', () => {
  it('removes the bullet when backspace is pressed at the start of the line', () => {
    const root = mount('<ul><li><div>Prospecting</div></li></ul>');
    const text = root.querySelector('div')?.firstChild;
    expect(text).toBeTruthy();
    caretAt(text as Node, 0);

    const event = press('Backspace');
    expect(handleDescriptionListKeyDown(event, root)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(root.querySelector('ul')).toBeNull();
    expect(root.querySelector('p')?.textContent).toBe('Prospecting');
  });

  it('keeps the text when the bullet item is a paragraph', () => {
    const root = mount('<ul><li><p>Prospecting</p></li></ul>');
    caretAt(root.querySelector('p')?.firstChild as Node, 0);

    expect(handleDescriptionListKeyDown(press('Backspace'), root)).toBe(true);
    expect(root.querySelector('ul')).toBeNull();
    expect(root.querySelector('p')?.textContent).toBe('Prospecting');
  });

  it('deletes an empty bullet and keeps the next line', () => {
    const root = mount('<ul><li><br></li><li>Prospecting</li></ul>');
    caretAt(root.querySelector('li') as Node, 0);

    expect(handleDescriptionListKeyDown(press('Backspace'), root)).toBe(true);
    expect(root.querySelectorAll('li')).toHaveLength(1);
    expect(root.querySelector('li')?.textContent).toBe('Prospecting');
  });

  it('does not remove a bullet when the cursor is in the middle of the text', () => {
    const root = mount('<ul><li>Prospecting</li></ul>');
    caretAt(root.querySelector('li')?.firstChild as Node, 4);
    const before = root.innerHTML;

    expect(handleDescriptionListKeyDown(press('Backspace'), root)).toBe(false);
    expect(root.innerHTML).toBe(before);
  });

  it('turns only the current bullet into a paragraph and keeps the surrounding list', () => {
    const root = mount('<ul><li>A</li><li>B</li><li>C</li></ul>');
    const middle = root.querySelectorAll('li')[1]?.firstChild;
    caretAt(middle as Node, 0);

    expect(handleDescriptionListKeyDown(press('Backspace'), root)).toBe(true);
    expect(Array.from(root.children).map((el) => el.tagName)).toEqual(['UL', 'P', 'UL']);
    expect(root.querySelector('p')?.textContent).toBe('B');
    expect(root.querySelectorAll('li')[0]?.textContent).toBe('A');
    expect(root.querySelectorAll('li')[1]?.textContent).toBe('C');
  });

  it('leaves the list when enter is pressed on an empty bullet', () => {
    const root = mount('<ul><li>A</li><li><br></li></ul>');
    caretAt(root.querySelectorAll('li')[1] as Node, 0);

    expect(handleDescriptionListKeyDown(press('Enter'), root)).toBe(true);
    expect(root.querySelectorAll('li')).toHaveLength(1);
    expect(root.querySelector('p')).toBeTruthy();
  });

  it('removes a bullet that sits on a heading', () => {
    const root = mount('<ul><li><h2>Optimasi</h2></li></ul>');
    caretAt(root.querySelector('h2')?.firstChild as Node, 0);

    expect(handleDescriptionListKeyDown(press('Backspace'), root)).toBe(true);
    expect(root.querySelector('ul, li')).toBeNull();
    expect(root.querySelector('h2')?.textContent).toBe('Optimasi');
  });

  it('removes a bullet left inside the heading', () => {
    const root = mount('<h2><li>Optimasi</li></h2>');
    caretAt(root.querySelector('li')?.firstChild as Node, 0);

    expect(handleDescriptionListKeyDown(press('Backspace'), root)).toBe(true);
    expect(root.querySelector('li')).toBeNull();
    expect(root.querySelector('h2')?.textContent).toBe('Optimasi');
  });

  it('removes a heading left directly inside the list', () => {
    const root = mount('<ul><h2>Optimasi</h2></ul>');
    caretAt(root.querySelector('h2')?.firstChild as Node, 0);

    expect(handleDescriptionListKeyDown(press('Backspace'), root)).toBe(true);
    expect(root.querySelector('ul')).toBeNull();
    expect(root.querySelector('h2')?.textContent).toBe('Optimasi');
  });

  it('pulls a heading out of a broken list so the bullet is not left under the word', () => {
    const root = mount('<ul><h2>Optimasi</h2><li>Buat Campaign</li></ul>');
    expect(normalizeDescriptionLists(root)).toBe(true);
    expect(root.querySelector('h2')?.parentElement).toBe(root);
    expect(root.querySelector('h2')?.textContent).toBe('Optimasi');
    expect(root.querySelector('ul li')?.textContent).toBe('Buat Campaign');
  });

  it('removes a bullet that was left around the words', () => {
    const root = mount('<h2><li>Optimasi</li></h2><ul><li>Buat Campaign</li></ul>');
    expect(normalizeDescriptionLists(root)).toBe(true);
    expect(root.querySelector('h2 li')).toBeNull();
    expect(root.querySelector('h2')?.textContent).toBe('Optimasi');
    expect(root.querySelector('ul li')?.textContent).toBe('Buat Campaign');
  });

  it('removes the bullet when the list button is used on an existing bullet', () => {
    const root = mount('<ul><li><div>Prospecting</div></li></ul>');
    caretAt(root.querySelector('div')?.firstChild as Node, 0);

    expect(removeUnorderedListAtSelection(root)).toBe(true);
    expect(root.querySelector('ul')).toBeNull();
    expect(root.textContent).toBe('Prospecting');
  });
});
