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

  // The sweep scans os.tmpdir(), which every other test worker shares — and a
  // worker's own lazy sweep would happily eat a stranded fixture out from under
  // these assertions. os.tmpdir() re-reads the environment on every call, so
  // pointing it at a private root per test makes the scan hermetic.
  describe('sweepStaleTempProfiles', () => {
    const TMP_ENV_KEYS = ['TMPDIR', 'TEMP', 'TMP'] as const;
    let sweepRoot: string;
    let savedTmpEnv: Record<string, string | undefined>;

    /** Age a directory past the staleness cutoff. */
    function makeStale(dir: string): void {
      const old = new Date(Date.now() - STALE_PROFILE_AGE_MS - 60_000);
      utimesSync(dir, old, old);
    }

    beforeEach(() => {
      sweepRoot = mkdtempSync(join(tmpdir(), 'wigolo-sweep-root-'));
      savedTmpEnv = Object.fromEntries(TMP_ENV_KEYS.map(k => [k, process.env[k]]));
      for (const k of TMP_ENV_KEYS) process.env[k] = sweepRoot;
      expect(tmpdir()).toBe(sweepRoot);
    });

    afterEach(() => {
      for (const k of TMP_ENV_KEYS) {
        if (savedTmpEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedTmpEnv[k];
      }
      rmSync(sweepRoot, { recursive: true, force: true });
    });

    it('removes a copy stranded by an earlier run', async () => {
      // The crash case: a copy whose owning process died before its
      // removeTempProfile ran, now aged past the cutoff.
      const stranded = mkdtempSync(join(sweepRoot, TEMP_PROFILE_PREFIX));
      writeFileSync(join(stranded, 'Cookies'), 'cookie-bytes');
      makeStale(stranded);

      await expect(sweepStaleTempProfiles()).resolves.toBe(1);
      expect(existsSync(stranded)).toBe(false);
    });

    it('leaves a FRESH copy alone', async () => {
      const fresh = mkdtempSync(join(sweepRoot, TEMP_PROFILE_PREFIX));
      writeFileSync(join(fresh, 'Cookies'), 'cookie-bytes');

      await expect(sweepStaleTempProfiles()).resolves.toBe(0);
      expect(existsSync(fresh)).toBe(true);
    });

    it('never removes a copy this process is still using', async () => {
      // An in-flight fetch can outlive the cutoff (a long crawl, a stalled
      // navigation). The live copy is tracked in-process and must be skipped
      // even once its mtime reads stale.
      const live = await copyProfileToTemp(sourceDir);
      makeStale(live);

      await expect(sweepStaleTempProfiles()).resolves.toBe(0);
      expect(existsSync(live)).toBe(true);
      expect(existsSync(join(live, 'Cookies'))).toBe(true);

      // ...and once the fetch settles and releases it, it becomes sweepable.
      await removeTempProfile(live);
      expect(existsSync(live)).toBe(false);
    });

    it('ignores unrelated temp directories', async () => {
      const unrelated = mkdtempSync(join(sweepRoot, 'wigolo-profile-src-'));
      makeStale(unrelated);

      await expect(sweepStaleTempProfiles()).resolves.toBe(0);
      expect(existsSync(unrelated)).toBe(true);
    });
  });
});
