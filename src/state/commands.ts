// The terminal commands shown for setting up or removing the access rule by hand.
import type { AccessRuleInfo } from '../backend/types';

export const RULE_DIR = '/etc/udev/rules.d';
/** The same name as `RULE_FILE_NAME` in `tune-core` and the file in `packaging/linux/`. */
export const RULE_FILE_NAME = '70-tune-rival3-gen2.rules';
const RELOAD = 'sudo udevadm control --reload-rules';
/** A reload alone reaches only devices plugged in afterwards; this applies the rules to the mouse already plugged in. */
const TRIGGER = 'sudo udevadm trigger --subsystem-match=hidraw';

/** Leaves plain paths as they are and single-quotes anything else for a POSIX shell. */
export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:+@%-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

export function installCommands(rule: AccessRuleInfo): string[] {
  const source = rule.source ?? rule.fileName;
  return [`sudo install -m 0644 ${shellQuote(source)} ${RULE_DIR}/${rule.fileName}`, RELOAD, TRIGGER];
}

/** For a rule that is installed but has not reached the mouse yet; plugging the mouse in again does the same. */
export function applyCommands(): string[] {
  return [TRIGGER];
}

/** A rule in the system's own rules folder came with Tune's package, which removes it on uninstall. */
export function ruleFromPackage(installedPath: string | null): boolean {
  return installedPath !== null && /^\/(usr\/)?lib\/udev\/rules\.d\//.test(installedPath);
}

/** Removing the rule does not take the permission from a mouse that is plugged in; that waits for a replug. */
export function removeCommands(installedPath: string | null, fileName: string): string[] {
  return [`sudo rm ${shellQuote(installedPath ?? `${RULE_DIR}/${fileName}`)}`, RELOAD];
}
