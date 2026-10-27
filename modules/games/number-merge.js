export const id = 'number-merge';
export const title = '极简 2048';
export const status = 'wip';

/*
 * Reserved module entry.
 * The router intentionally does not import or mount WIP modules.
 * Implement the real game here later and keep the same id/title exports.
 */
export function mount() {
  return () => {};
}
