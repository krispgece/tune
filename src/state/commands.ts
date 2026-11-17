// The terminal commands shown for setting up or removing the access rule by hand.
import type { AccessRuleInfo } from '../backend/types';

export const RULE_DIR = '/etc/udev/rules.d';
/** The same name as `RULE_FILE_NAME` in `tune-core` and the file in `packaging/linux/`. */
export const RULE_FILE_NAME = '70-tune-rival3-gen2.rules';
const RELOAD = 'sudo udevadm control --reload-rules';

/** Leaves plain paths as they are and single-quotes anything else for a POSIX shell. */
export function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:+@%-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

export function installCommands(rule: AccessRuleInfo): string[] {
  const source = rule.source ?? rule.fileName;
  return [`sudo install -m 0644 ${shellQuote(source)} ${RULE_DIR}/${rule.fileName}`, RELOAD];
}

export function removeCommands(installedPath: string | null, fileName: string): string[] {
  return [`sudo rm ${shellQuote(installedPath ?? `${RULE_DIR}/${fileName}`)}`, RELOAD];
}
