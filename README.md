# pi-autonomy-slider

A [pi](https://pi.dev) extension with four autonomy guidance levels:

- **󱚧 None** — explores and discusses without making changes
- **󱚟 Interactive** — performs only the smallest requested step, then asks before follow-up work
- **󰚩 Default** — normal agent behavior with no additional prompt
- **󱚝 Full** — works autonomously through completion and provides evidence

Press **Ctrl+Shift+A** in pi to open the slider. Use **Left/Right** (or Tab), **Enter** to select, and **Esc** to cancel. Pressing **Ctrl+Shift+A** again while the slider is open advances to the next level.

The current level is saved in the current session and published on the `bufnix:autonomy-level-selection` extension event. With [`pi-model-dial`](https://github.com/bufnix/pi-model-dial), the level's colored glyph is shown in the input prompt's top-right corner. The glyph and slider selection use the same thinking-mode color. For none, interactive, and full, the extension appends terse guidance to the system prompt before each agent run. Default appends nothing. Persisted state is not itself sent to the model.

> Pi already binds Ctrl+A to move to the start of the editor line. Ctrl+Shift+A is unassigned by Pi and avoids the commonly occupied Alt shortcuts.

## Edit the prompts

The prompt strings are in `AUTONOMY_DEFINITIONS` near the top of [`index.ts`](index.ts). Set any mode's `prompt` to an empty string to disable guidance for that mode.

## Install

From GitHub:

```bash
pi install git:github.com/bufnix/pi-autonomy-slider
```

Or install/try a local checkout:

```bash
pi install .
pi -e .
```

You can also open or set the level with a command:

```text
/autonomy
/autonomy full
```

## Development

```bash
pnpm install --ignore-scripts
pnpm typecheck
```
