// Decides whether a Bash command (as Claude Code passes it to a PreToolUse
// hook) pushes commits, for pre-push-verify.sh.
// Tests: node --test .claude/hooks/is-git-push.test.mjs
import { pathToFileURL } from "node:url";

// `git [global options] push [args]`, after start of line or `;`, `&&`, `|`, `(`, a path (`/usr/bin/git`).
const pushPattern = /(?:^|[\s;&|(/])git(?:[ \t]+(?:-C[ \t]+\S+|-c[ \t]+\S+|--?[\w-]+(?:=\S+)?))*[ \t]+push\b([^;&|\n)]*)/g;

const stripNonCommandText = (command) =>
  command
    // Heredoc bodies are data, not commands; keep the opening line.
    .replace(/(<<-?\s*(['"]?)(\w+)\2[^\n]*)\n[\s\S]*?\n\s*\3(?=\n|$)/g, "$1")
    // So is quoted text, e.g. a commit message that mentions "git push".
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');

// A push only deletes remote branches when it uses --delete/-d or every
// refspec is `:branch`; `git push origin :old new` still pushes `new`.
const onlyDeletes = (args) => {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.includes("--delete") || tokens.includes("-d")) {
    return true;
  }
  const refspecs = tokens.filter((token) => !token.startsWith("-")).slice(1);
  return refspecs.length > 0 && refspecs.every((refspec) => refspec.startsWith(":"));
};

export const isGitPush = (command) =>
  [...stripNonCommandText(command).matchAll(pushPattern)].some((match) => !onlyDeletes(match[1]));

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let command = "";
    try {
      command = JSON.parse(raw)?.tool_input?.command ?? "";
    } catch {}
    process.stdout.write(isGitPush(command) ? "yes" : "no");
  });
}
