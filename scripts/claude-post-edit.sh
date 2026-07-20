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

# 1) 格式化被改動的那個檔案（失敗不擋，格式不是正確性問題）
pnpm exec prettier --write "$FILE" >/dev/null 2>&1 || true

# 2) 全專案型別檢查。有錯就把錯誤訊息送回給 Claude 修。
if ! TSC_OUTPUT=$(pnpm exec tsc --noEmit 2>&1); then
  echo "型別檢查失敗（編輯 $FILE 之後）：" >&2
  # 只回傳前 40 行，避免洗版
  printf '%s\n' "$TSC_OUTPUT" | head -40 >&2
  exit 2
fi

exit 0
