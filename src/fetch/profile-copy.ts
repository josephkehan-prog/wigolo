import { cp, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createLogger } from '../logger.js';

const logger = createLogger('fetch');

/**
 * Prefix for temp Chrome-profile copies. Doubles as the deletion guard in
 * `removeTempProfile` so cleanup can never touch a user-configured directory.
 */
export const TEMP_PROFILE_PREFIX = 'wigolo-chrome-';

/**
 * How old a stranded temp copy must be before `sweepStaleTempProfiles` removes
 * it. Well above any single fetch budget, so the sweep can never race a copy
 * that another wigolo process is still fetching with.
 */
export const STALE_PROFILE_AGE_MS = 60 * 60 * 1000;

/**
 * Copies this process made and has not yet removed. The sweep skips them
 * regardless of age, so a long-running fetch in THIS process can never have its
 * profile deleted out from under it.
 */
const activeCopies = new Set<string>();

/** One sweep per process, triggered lazily by the first copy (see below). */
let lazySweep: Promise<void> | null = null;

/**
 * True only for a path this module could itself have created: the
 * `wigolo-chrome-` basename prefix AND a direct child of the temp dir. The
 * prefix alone would still admit e.g. `~/wigolo-chrome-profile`, and this
 * guards an `rm -rf`, so both halves are checked.
 */
function isTempProfilePath(candidate: string): boolean {
  const abs = resolve(candidate);
  return basename(abs).startsWith(TEMP_PROFILE_PREFIX) && dirname(abs) === resolve(tmpdir());
}

/**
 * Copy the user's Chrome profile into a fresh temp directory so the browser
 * tier can open it without touching (or locking) the live profile. The copy is
 * SINGLE-USE and caller-owned: whoever triggers the copy MUST remove it with
 * `removeTempProfile` once the fetch settles (success, failure, or abort) —
 * a surviving copy is a full-profile privacy leak in tmp.
 */
export async function copyProfileToTemp(profilePath: string): Promise<string> {
  // A crash (or SIGKILL) between copy and cleanup strands a full profile in
  // tmp, which the caller-owned contract above cannot cover. The server sweeps
  // at startup; sweeping once here as well covers the one-shot CLI entry points,
  // which never call initSubsystems().
  lazySweep ??= sweepStaleTempProfiles().then(() => undefined).catch(() => undefined);
  await lazySweep;

  const tempDir = await mkdtemp(join(tmpdir(), TEMP_PROFILE_PREFIX));
  activeCopies.add(resolve(tempDir));
  await cp(profilePath, tempDir, { recursive: true });
  logger.debug('copied Chrome profile to temp directory', { from: profilePath, to: tempDir });
  return tempDir;
}

/**
 * Remove a temp Chrome-profile copy created by `copyProfileToTemp`. Guarded to
 * wigolo-owned temp copies only (`isTempProfilePath`) and best-effort: a
 * cleanup failure is logged, never thrown, so it cannot mask the fetch's own
 * outcome. No-op when no copy was made (`userDataDir` undefined).
 */
export async function removeTempProfile(userDataDir: string | undefined): Promise<void> {
  if (!userDataDir) return;
  if (!isTempProfilePath(userDataDir)) {
    logger.warn('refusing to remove a directory that is not a wigolo temp profile copy', { userDataDir });
    return;
  }
  try {
    await rm(userDataDir, { recursive: true, force: true });
    logger.debug('removed temp Chrome profile copy', { userDataDir });
  } catch (err) {
    logger.warn('failed to remove temp Chrome profile copy', {
      userDataDir,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    activeCopies.delete(resolve(userDataDir));
  }
}

/**
 * Remove temp profile copies stranded by an earlier run that died between the
 * copy and its cleanup — the one leak the caller-owned `removeTempProfile`
 * contract cannot close. Only directories this module could have created are
 * considered (`isTempProfilePath`), only those older than `maxAgeMs`, and never
 * one this process is still fetching with. Best-effort throughout: every
 * failure is logged and swallowed so a sweep can never fail a fetch. Returns
 * the number of copies removed.
 */
export async function sweepStaleTempProfiles(maxAgeMs = STALE_PROFILE_AGE_MS): Promise<number> {
  const root = resolve(tmpdir());
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (err) {
    logger.debug('could not scan temp dir for stale Chrome profile copies', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }

  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  for (const entry of entries) {
    if (!entry.startsWith(TEMP_PROFILE_PREFIX)) continue;
    const candidate = join(root, entry);
    if (activeCopies.has(candidate)) continue;
    try {
      const info = await stat(candidate);
      if (!info.isDirectory() || info.mtimeMs > cutoff) continue;
      await rm(candidate, { recursive: true, force: true });
      removed++;
      logger.debug('swept stale Chrome profile copy', { userDataDir: candidate });
    } catch (err) {
      // A concurrent wigolo sweeping the same entry (ENOENT) is the common
      // case; a permission error on someone else's copy is the other. Neither
      // should stop the sweep or reach the caller.
      logger.debug('could not sweep stale Chrome profile copy', {
        userDataDir: candidate,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (removed > 0) {
    logger.info('swept stale Chrome profile copies left by an earlier run', { count: removed });
  }
  return removed;
}
