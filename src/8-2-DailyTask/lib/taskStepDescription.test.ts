import { describe, expect, it } from 'vitest';
import {
  finalizeDescriptionForSave,
  linkifyPlainTextToHtml,
  prepareTaskStepDescriptionHtmlForView,
  splitTextWithUrls,
} from '@/8-2-DailyTask/lib/taskStepDescription';

describe('finalizeDescriptionForSave', () => {
  it('keeps existing notes so they can be edited', () => {
    expect(finalizeDescriptionForSave('<p>Existing note</p><p>New line</p>')).toContain('Existing note');
  });

  it('clears a description that has no text and no image', () => {
    expect(finalizeDescriptionForSave('<p><br></p>')).toBeNull();
  });
});

const WRAPPED_ADS_URL = [
  'https://adsmanager.facebook.com/adsmanager/manage/adsets?',
  'act=1171167351065758&business_id=160049689970103&date=2026-10-01_2026-10-',
  '08%2Cthis_month&selected_campaign_ids=120246964105870741&treenav=',
  'true',
].join('\n');

describe('task step description links', () => {
  it('joins a URL that was wrapped across lines', () => {
    const note = `campaign ini (${WRAPPED_ADS_URL}) Interest tersebut`;
    const segments = splitTextWithUrls(note);
    const url = segments.find((segment) => segment.type === 'url')?.value;
    expect(url).toBe(WRAPPED_ADS_URL.replace(/\n/g, ''));
    expect(note.endsWith('Interest tersebut') || segments.some((segment) => segment.value.includes('Interest'))).toBe(true);
    expect(segments.some((segment) => segment.type === 'text' && segment.value.includes(')'))).toBe(true);
  });

  it('makes a line-broken Ads Manager URL one clickable link', () => {
    const href = WRAPPED_ADS_URL.replace(/\n/g, '');
    const html = `<p>peluang pada campaign ini (${WRAPPED_ADS_URL.replace(/\n/g, '<br>')}) Interest tersebut</p>`;
    const view = prepareTaskStepDescriptionHtmlForView(html);
    const viewDoc = new DOMParser().parseFromString(view, 'text/html');
    const viewLink = viewDoc.querySelector('a');
    expect(viewLink?.getAttribute('href')).toBe(href);
    expect(viewLink?.getAttribute('target')).toBe('_blank');
    expect(viewDoc.body.textContent).toContain('Interest tersebut');
    expect(viewDoc.body.textContent).not.toContain('\n');

    const pasted = linkifyPlainTextToHtml(`(${WRAPPED_ADS_URL})`);
    const pastedDoc = new DOMParser().parseFromString(pasted, 'text/html');
    expect(pastedDoc.querySelector('a')?.getAttribute('href')).toBe(href);
  });
});
