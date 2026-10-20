import assert from "node:assert/strict";
import { test } from "node:test";
import { isGitPush } from "./is-git-push.mjs";

const pushes = [
  "git push",
  "git push -u origin claude/branch",
  "cd x && git -C . push -u origin b",
  'git -C "/a b" push',
  'git commit -m "x" && git push -u origin b',
  "/usr/bin/git push origin main",
  "git push origin --delete old && git push -u origin new",
  "git push origin :old new",
  "cat > a <<'EOF' && git push\nbody\nEOF",
  "cat > a <<EOF\nbody\nEOF\ngit push",
];

const notPushes = [
  "ls -la",
  "git log --grep push",
  "git status",
  "git push origin --delete foo",
  "git push -d origin foo",
  "git push origin :foo",
  "git push origin :foo :bar",
  'git commit -m "fix before git push"',
  "git commit -m 'a git push b' && git status",
  "git commit -F - <<EOF\nmention git push\nEOF",
  "cat > notes.md <<'EOF'\nthen run git push -u origin x\nEOF",
  "digit push",
];

for (const command of pushes) {
  test(`push: ${JSON.stringify(command)}`, () => assert.equal(isGitPush(command), true));
}
for (const command of notPushes) {
  test(`not a push: ${JSON.stringify(command)}`, () => assert.equal(isGitPush(command), false));
}
