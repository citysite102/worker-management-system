#!/bin/sh
#
# Claude Code PostToolUse hook：每次 Edit/Write 之後自動格式化並做型別檢查。
#
# 由 .claude/settings.json 掛在 Edit|Write 上，以 asyncRewake 模式執行 ——
# 背景跑，不卡住編輯；只有在型別檢查失敗（exit 2）時才把錯誤回饋給 Claude。
#
# stdin 收到 hook 的 JSON payload，取出被編輯的檔案路徑。
# 非 .ts/.tsx 檔直接跳過（tsc 全專案檢查對它們沒意義）。

set -u

cd "$(dirname "$0")/.." || exit 0

PAYLOAD=$(cat)
FILE=$(printf '%s' "$PAYLOAD" | jq -r '.tool_response.filePath // .tool_input.file_path // empty')

case "$FILE" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

[ -f "$FILE" ] || exit 0

# 1) 格式化被改動的那個檔案（失敗不擋，格式不是正確性問題）。
#
#    但只格式化「本來就符合 prettier 的檔案」。本 repo 有上百個歷史遺留檔案
#    從未被格式化過，對它們跑 prettier --write 會把整份重排 ——
#    一個 15 行的邏輯修改會變成 573 行的 diff，根本沒辦法審閱。
#
#    判斷方式：看這個檔案在 HEAD 的版本是否已符合格式。
#      - 新檔案（HEAD 沒有）→ 格式化，新程式碼從一開始就該是乾淨的
#      - HEAD 版本已符合格式 → 格式化，維持乾淨
#      - HEAD 版本本來就不符合 → 跳過，不製造格式雜訊
#    想清掉歷史債務請單獨跑 pnpm format 並獨立成一個 commit。
#    注意：Claude Code 傳進來的是絕對路徑，但 `git show HEAD:<path>` 只吃
#    repo 相對路徑，所以要先用 --full-name 轉換。
should_format() {
  REL=$(git ls-files --full-name --error-unmatch "$FILE" 2>/dev/null) || return 0
  [ -n "$REL" ] || return 0

  HEAD_SRC=$(git show "HEAD:$REL" 2>/dev/null) || return 1
  [ -n "$HEAD_SRC" ] || return 1

  printf '%s\n' "$HEAD_SRC" \
    | pnpm exec prettier --stdin-filepath "$FILE" --check >/dev/null 2>&1
}

if should_format; then
  pnpm exec prettier --write "$FILE" >/dev/null 2>&1 || true
fi

# 2) 全專案型別檢查。有錯就把錯誤訊息送回給 Claude 修。
if ! TSC_OUTPUT=$(pnpm exec tsc --noEmit 2>&1); then
  echo "型別檢查失敗（編輯 $FILE 之後）：" >&2
  # 只回傳前 40 行，避免洗版
  printf '%s\n' "$TSC_OUTPUT" | head -40 >&2
  exit 2
fi

exit 0
