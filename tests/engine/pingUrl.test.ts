import { describe, it, expect } from 'vitest';
import { appendParams, buildPlaybackPingUrl, buildWatchtimePingUrl, watchtimeSegments } from '../../src/engine/pingUrl';

const PB_BASE = 'https://www.youtube.com/api/stats/playback?ns=yt&el=detailpage&docid=ID&ei=XYZ';
const WT_BASE = 'https://www.youtube.com/api/stats/watchtime?ns=yt&el=detailpage&docid=ID&ei=XYZ';

describe('appendParams', () => {
  it('preserves existing params and adds new ones', () => {
    const out = new URL(appendParams(PB_BASE, { ver: 2, cpn: 'CPN16CHAR' }));
    expect(out.searchParams.get('docid')).toBe('ID');
    expect(out.searchParams.get('ver')).toBe('2');
    expect(out.searchParams.get('cpn')).toBe('CPN16CHAR');
  });
});

describe('buildPlaybackPingUrl', () => {
  it('adds ver, cpn, and cmt=0 (session init)', () => {
    const out = new URL(buildPlaybackPingUrl(PB_BASE, 'CPN16CHAR'));
    expect(out.searchParams.get('ver')).toBe('2');
    expect(out.searchParams.get('cpn')).toBe('CPN16CHAR');
    expect(out.searchParams.get('cmt')).toBe('0');
  });
});

describe('watchtimeSegments', () => {
  it('covers 0..duration contiguously, ending exactly at duration', () => {
    const segs = watchtimeSegments(19, 4);
    expect(segs[0]![0]).toBe(0);
    expect(segs[segs.length - 1]![1]).toBe(19);
    for (let i = 1; i < segs.length; i++) expect(segs[i]![0]).toBe(segs[i - 1]![1]);
  });
  it('handles very short durations', () => {
    const segs = watchtimeSegments(2, 4);
    expect(segs[0]![0]).toBe(0);
    expect(segs[segs.length - 1]![1]).toBe(2);
  });
});

describe('buildWatchtimePingUrl', () => {
  it('reports a playing segment via st/et/cmt', () => {
    const out = new URL(buildWatchtimePingUrl(WT_BASE, 'CPN16CHAR', 5, 10));
    expect(out.searchParams.get('cpn')).toBe('CPN16CHAR');
    expect(out.searchParams.get('st')).toBe('5');
    expect(out.searchParams.get('et')).toBe('10');
    expect(out.searchParams.get('cmt')).toBe('10');
    expect(out.searchParams.get('state')).toBe('playing');
    expect(out.searchParams.get('final')).toBeNull();
  });
  it('marks the final commit ping with state=paused and final=1', () => {
    const out = new URL(buildWatchtimePingUrl(WT_BASE, 'CPN16CHAR', 15, 19, { final: true }));
    expect(out.searchParams.get('state')).toBe('paused');
    expect(out.searchParams.get('final')).toBe('1');
  });
});
