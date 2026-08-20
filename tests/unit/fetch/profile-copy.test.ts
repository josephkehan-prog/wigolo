import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  copyProfileToTemp,
  removeTempProfile,
  sweepStaleTempProfiles,
  STALE_PROFILE_AGE_MS,
  TEMP_PROFILE_PREFIX,
} from '../../../src/fetch/profile-copy.js';

describe('profile-copy', () => {
  let sourceDir: string;
  const madeCopies: string[] = [];

  beforeEach(() => {
    sourceDir = mkdtempSync(join(tmpdir(), 'wigolo-profile-src-'));
    writeFileSync(join(sourceDir, 'Cookies'), 'cookie-bytes');
    mkdirSync(join(sourceDir, 'Default'));
    writeFileSync(join(sourceDir, 'Default', 'Preferences'), '{}');
  });

  afterEach(() => {
    rmSync(sourceDir, { recursive: true, force: true });
    for (const dir of madeCopies.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('copyProfileToTemp copies the profile recursively into a prefixed temp dir', async () => {
    const copy = await copyProfileToTemp(sourceDir);
    madeCopies.push(copy);

    expect(copy).not.toBe(sourceDir);
    expect(copy).toContain(TEMP_PROFILE_PREFIX);
    expect(readFileSync(join(copy, 'Cookies'), 'utf8')).toBe('cookie-bytes');
    expect(existsSync(join(copy, 'Default', 'Preferences'))).toBe(true);
  });

  it('removeTempProfile deletes a wigolo temp copy', async () => {
    const copy = await copyProfileToTemp(sourceDir);
    madeCopies.push(copy);
    expect(existsSync(copy)).toBe(true);

    await removeTempProfile(copy);
    expect(existsSync(copy)).toBe(false);
  });

  it('removeTempProfile is a no-op for undefined', async () => {
    await expect(removeTempProfile(undefined)).resolves.toBeUndefined();
  });

  it('removeTempProfile refuses to delete a directory without the wigolo prefix', async () => {
    // A user-configured directory (e.g. the LIVE profile path) must never be
    // deleted, even if it is mistakenly passed in.
    await removeTempProfile(sourceDir);
    expect(existsSync(sourceDir)).toBe(true);
    expect(existsSync(join(sourceDir, 'Cookies'))).toBe(true);
  });

  it('removeTempProfile tolerates an already-removed directory', async () => {
    const copy = await copyProfileToTemp(sourceDir);
    rmSync(copy, { recursive: true, force: true });
    await expect(removeTempProfile(copy)).resolves.toBeUndefined();
  });

  it('removeTempProfile refuses a prefixed directory that is NOT inside the temp dir', async () => {
    // The basename prefix alone is not enough: this guards an rm -rf, so a
    // user directory that merely happens to be named `wigolo-chrome-…` (say,
    // a checked-in profile under $HOME) must survive.
    const outsideRoot = mkdtempSync(join(tmpdir(), 'wigolo-outside-'));
    const decoy = join(outsideRoot, `${TEMP_PROFILE_PREFIX}not-a-temp-copy`);
    mkdirSync(decoy);
    writeFileSync(join(decoy, 'Cookies'), 'cookie-bytes');

    try {
      await removeTempProfile(decoy);
      expect(existsSync(decoy)).toBe(true);
      expect(existsSync(join(decoy, 'Cookies'))).toBe(true);
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('sweepStaleTempProfiles removes a copy stranded by an earlier run', async () => {
    // Simulates the crash case: a copy made by a process that died before its
    // removeTempProfile ran, aged past the staleness cutoff.
    const stranded = mkdtempSync(join(tmpdir(), TEMP_PROFILE_PREFIX));
    madeCopies.push(stranded);
    writeFileSync(join(stranded, 'Cookies'), 'cookie-bytes');
    const old = new Date(Date.now() - STALE_PROFILE_AGE_MS - 60_000);
    utimesSync(stranded, old, old);

    const removed = await sweepStaleTempProfiles();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(existsSync(stranded)).toBe(false);
  });

  it('sweepStaleTempProfiles leaves a FRESH copy alone', async () => {
    const fresh = mkdtempSync(join(tmpdir(), TEMP_PROFILE_PREFIX));
    madeCopies.push(fresh);
    writeFileSync(join(fresh, 'Cookies'), 'cookie-bytes');

    await sweepStaleTempProfiles();

    expect(existsSync(fresh)).toBe(true);
  });

  it('sweepStaleTempProfiles never removes a copy this process is still using', async () => {
    // An in-flight fetch can outlive the age cutoff (a long crawl, a stalled
    // navigation). The live copy is tracked in-process and must be skipped
    // even when its mtime says stale.
    const live = await copyProfileToTemp(sourceDir);
    madeCopies.push(live);
    const old = new Date(Date.now() - STALE_PROFILE_AGE_MS - 60_000);
    utimesSync(live, old, old);

    await sweepStaleTempProfiles();

    expect(existsSync(live)).toBe(true);
    expect(existsSync(join(live, 'Cookies'))).toBe(true);

    // ...and once the fetch settles and the copy is released, it is sweepable.
    await removeTempProfile(live);
    expect(existsSync(live)).toBe(false);
  });

  it('sweepStaleTempProfiles ignores unrelated temp directories', async () => {
    const unrelated = mkdtempSync(join(tmpdir(), 'wigolo-profile-src-'));
    const old = new Date(Date.now() - STALE_PROFILE_AGE_MS - 60_000);
    utimesSync(unrelated, old, old);

    try {
      await sweepStaleTempProfiles();
      expect(existsSync(unrelated)).toBe(true);
    } finally {
      rmSync(unrelated, { recursive: true, force: true });
    }
  });
});
