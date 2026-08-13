import {
	type ExtensionAPI,
	type ExtensionContext,
	type Theme,
	type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	type Component,
} from "@earendil-works/pi-tui";

const AUTONOMY_LEVELS = ["none", "interactive", "default", "full"] as const;
type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

interface AutonomyDefinition {
	description: string;
	icon: string;
	themeColor: ThemeColor;
	prompt: string;
}

const AUTONOMY_DEFINITIONS: Record<AutonomyLevel, AutonomyDefinition> = {
	none: {
		description: "Only explores, answers questions, and discusses",
		icon: "󱚧",
		themeColor: "thinkingMinimal",
		prompt: "Don't make changes. Only explore, answer questions, and discuss.",
	},
	interactive: {
		description: "Takes only the smallest requested step, then suggests follow-ups",
		icon: "󱚟",
		themeColor: "thinkingLow",
		prompt:
			"Do only the smallest step explicitly requested, then stop and ask before any follow-up work. If ambiguous, choose the least-damaging interpretation.",
	},
	default: {
		description: "Uses default behavior and may take multiple obvious steps",
		icon: "󰚩",
		themeColor: "thinkingHigh",
		prompt: "",
	},
	full: {
		description: "Works fully autonomously until the task is complete",
		icon: "󱚝",
		themeColor: "thinkingMax",
		prompt:
			"Work autonomously in the isolated environment until the task is complete. Resolve ambiguities by testing alternatives and choosing the best; do not wait for confirmation. Finish with evidence of completion or why completion was impossible.",
	},
};

const DEFAULT_LEVEL: AutonomyLevel = "default";
const STATE_ENTRY = "autonomy-level-state";
const LEGACY_STATUS_ID = "autonomy-level";
// Pi sorts extension footer statuses by key. Keep this last among normal keys.
const STATUS_ID = "zz-autonomy-level";
const AUTONOMY_SHORTCUT = Key.ctrlShift("a");

function styleAutonomyIcon(theme: Theme, level: AutonomyLevel): string {
	const definition = AUTONOMY_DEFINITIONS[level];
	return theme.bold(theme.fg(definition.themeColor, definition.icon));
}

function normalizeAutonomyLevel(value: unknown): AutonomyLevel | undefined {
	if (
		typeof value === "string" &&
		(AUTONOMY_LEVELS as readonly string[]).includes(value)
	) {
		return value as AutonomyLevel;
	}

	// Migrate session state written before the canonical mode names changed.
	switch (value) {
		case "None":
			return "none";
		case "Low":
		case "Interactive":
			return "interactive";
		case "Medium":
		case "Default":
			return "default";
		case "Full":
			return "full";
		default:
			return undefined;
	}
}

class AutonomySlider implements Component {
	readonly width = 70;

	private selectedIndex: number;

	constructor(
		private readonly theme: Theme,
		initialLevel: AutonomyLevel,
		private readonly onChange: () => void,
		private readonly done: (level: AutonomyLevel | null) => void,
	) {
		this.selectedIndex = AUTONOMY_LEVELS.indexOf(initialLevel);
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
			this.done(null);
			return;
		}

		if (matchesKey(data, Key.enter)) {
			this.done(AUTONOMY_LEVELS[this.selectedIndex]);
			return;
		}

		if (matchesKey(data, Key.home)) {
			this.select(0);
			return;
		}

		if (matchesKey(data, Key.end)) {
			this.select(AUTONOMY_LEVELS.length - 1);
			return;
		}

		if (
			matchesKey(data, Key.left) ||
			matchesKey(data, Key.shift("tab")) ||
			data === "h"
		) {
			this.turn(-1);
			return;
		}

		if (
			matchesKey(data, Key.right) ||
			matchesKey(data, Key.tab) ||
			matchesKey(data, AUTONOMY_SHORTCUT) ||
			data === "l"
		) {
			this.turn(1);
		}
	}

	render(availableWidth: number): string[] {
		const width = Math.min(this.width, Math.max(0, availableWidth));
		if (width < 4) {
			return [truncateToWidth("Autonomy", width, "")];
		}

		const theme = this.theme;
		const innerWidth = width - 2;
		const contentWidth = Math.max(1, innerWidth - 2);
		const level = AUTONOMY_LEVELS[this.selectedIndex];
		const definition = AUTONOMY_DEFINITIONS[level];
		const levelColor = definition.themeColor;

		const pad = (value: string, targetWidth: number): string => {
			const clipped = truncateToWidth(value, targetWidth, "");
			return clipped + " ".repeat(Math.max(0, targetWidth - visibleWidth(clipped)));
		};

		const row = (value = ""): string => {
			return (
				theme.fg("border", "│") +
				pad(value, innerWidth) +
				theme.fg("border", "│")
			);
		};

		const title = theme.fg("text", " Autonomy:");
		const description = theme.fg("muted", ` ${definition.description}`);
		const helpText = "←/→ adjust · enter select · esc cancel";
		const help =
			" ".repeat(Math.max(1, innerWidth - visibleWidth(helpText) - 1)) +
			theme.fg("dim", helpText);

		if (width < 32) {
			return [
				theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
				row(title),
				row(
					theme.fg(
						"dim",
						` Step ${this.selectedIndex + 1}/${AUTONOMY_LEVELS.length}`,
					),
				),
				row(help),
				theme.fg("border", `╰${"─".repeat(innerWidth)}╯`),
			];
		}

		const trackWidth = contentWidth;
		const trackInset = Math.max(0, Math.floor((innerWidth - trackWidth) / 2));
		const markerPositions = AUTONOMY_LEVELS.map((_item, index) =>
			Math.round((index * (trackWidth - 1)) / (AUTONOMY_LEVELS.length - 1)),
		);
		const markerAt = new Map(
			markerPositions.map((position, index) => [position, index]),
		);
		const selectedPosition = markerPositions[this.selectedIndex];

		let track = "";
		for (let position = 0; position < trackWidth; position++) {
			const markerIndex = markerAt.get(position);
			if (markerIndex !== undefined) {
				if (markerIndex === this.selectedIndex) {
					track += theme.bold(theme.fg(levelColor, "●"));
				} else if (markerIndex < this.selectedIndex) {
					track += theme.fg(levelColor, "●");
				} else {
					track += theme.fg("dim", "○");
				}
			} else if (position < selectedPosition) {
				track += theme.fg(levelColor, "━");
			} else {
				track += theme.fg("dim", "─");
			}
		}

		const labelTexts = AUTONOMY_LEVELS;
		const labelStarts = labelTexts.map((label, index) => {
			if (index === 0) return 0;
			if (index === AUTONOMY_LEVELS.length - 1) {
				return trackWidth - visibleWidth(label);
			}
			return Math.round(markerPositions[index] - visibleWidth(label) / 2);
		});

		let labelCursor = 0;
		const labels = labelTexts
			.map((label, index) => {
				const gap = " ".repeat(Math.max(0, labelStarts[index] - labelCursor));
				labelCursor = labelStarts[index] + visibleWidth(label);
				const styled =
					index === this.selectedIndex
						? theme.bold(theme.fg(levelColor, label))
						: theme.fg("muted", label);
				return gap + styled;
			})
			.join("");

		return [
			theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
			row(),
			row(title),
			row(),
			row(`${" ".repeat(trackInset)}${track}`),
			row(`${" ".repeat(trackInset)}${labels}`),
			row(),
			row(description),
			row(),
			row(help),
			theme.fg("border", `╰${"─".repeat(innerWidth)}╯`),
		];
	}

	invalidate(): void {}

	private select(index: number): void {
		if (index === this.selectedIndex) return;
		this.selectedIndex = index;
		this.onChange();
	}

	private turn(direction: -1 | 1): void {
		this.select(
			(this.selectedIndex + direction + AUTONOMY_LEVELS.length) %
				AUTONOMY_LEVELS.length,
		);
	}
}

export default function autonomySliderExtension(pi: ExtensionAPI): void {
	let activeLevel: AutonomyLevel = DEFAULT_LEVEL;
	let sliderOpen = false;

	function updateStatus(ctx: ExtensionContext): void {
		ctx.ui.setStatus(STATUS_ID, styleAutonomyIcon(ctx.ui.theme, activeLevel));
	}

	function setLevel(
		level: AutonomyLevel,
		ctx: ExtensionContext,
		options: { persist?: boolean } = {},
	): void {
		activeLevel = level;
		updateStatus(ctx);

		if (options.persist !== false) {
			pi.appendEntry(STATE_ENTRY, { level });
		}
	}

	async function showSlider(ctx: ExtensionContext): Promise<void> {
		if (ctx.mode !== "tui") {
			if (ctx.hasUI) {
				ctx.ui.notify(
					"The autonomy slider requires interactive mode",
					"warning",
				);
			}
			return;
		}
		if (sliderOpen) return;

		sliderOpen = true;
		try {
			const selected = await ctx.ui.custom<AutonomyLevel | null>(
				(tui, theme, _keybindings, done) =>
					new AutonomySlider(
						theme,
						activeLevel,
						() => tui.requestRender(),
						done,
					),
				{
					overlay: true,
					overlayOptions: {
						width: 70,
						minWidth: 44,
						maxHeight: 13,
						anchor: "center",
						margin: 1,
					},
				},
			);

			if (selected) setLevel(selected, ctx);
		} finally {
			sliderOpen = false;
		}
	}

	pi.registerShortcut(AUTONOMY_SHORTCUT, {
		description: "Open the autonomy slider",
		handler: async (ctx) => showSlider(ctx),
	});

	pi.registerCommand("autonomy", {
		description: "Select an autonomy guidance level",
		handler: async (args, ctx) => {
			const requested = args.trim().toLowerCase();
			if (!requested) {
				await showSlider(ctx);
				return;
			}

			const level = AUTONOMY_LEVELS.find((item) => item === requested);
			if (!level) {
				ctx.ui.notify(
					"Autonomy must be none, interactive, default, or full",
					"error",
				);
				return;
			}

			setLevel(level, ctx);
		},
	});

	pi.on("before_agent_start", (event) => {
		const prompt = AUTONOMY_DEFINITIONS[activeLevel].prompt;
		if (!prompt) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n[AUTONOMY: ${activeLevel.toUpperCase()}]\n${prompt}`,
		};
	});

	pi.on("session_start", (_event, ctx) => {
		activeLevel = DEFAULT_LEVEL;
		ctx.ui.setStatus(LEGACY_STATUS_ID, undefined);

		const branch = ctx.sessionManager.getBranch();
		for (let index = branch.length - 1; index >= 0; index--) {
			const entry = branch[index];
			if (entry?.type !== "custom" || entry.customType !== STATE_ENTRY) continue;

			const savedLevel = normalizeAutonomyLevel(
				(entry.data as { level?: unknown } | undefined)?.level,
			);
			if (!savedLevel) continue;

			activeLevel = savedLevel;
			break;
		}

		updateStatus(ctx);
	});
}
