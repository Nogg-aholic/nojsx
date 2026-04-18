import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ShellLayoutFields } from "../types.js";

type TsModule = typeof import("typescript");

const typescriptModulePromiseByPath = new Map<string, Promise<TsModule>>();

function stripOuterParens(text: string): string {
	const trimmed = text.trim();
	if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function resolveTypeScriptModulePath(filePath: string): string {
	let current = path.dirname(filePath);
	while (true) {
		const candidate = path.join(current, "node_modules", "typescript", "lib", "typescript.js");
		if (existsSync(candidate)) {
			return candidate;
		}

		const parent = path.dirname(current);
		if (parent === current) {
			throw new Error(`Unable to resolve TypeScript runtime for ${filePath}.`);
		}
		current = parent;
	}
}

async function loadTypeScriptForFile(filePath: string): Promise<TsModule> {
	const modulePath = resolveTypeScriptModulePath(filePath);
	const existing = typescriptModulePromiseByPath.get(modulePath);
	if (existing) {
		return existing;
	}

	const promise = import(pathToFileURL(modulePath).href).then((mod) => (mod.default ?? mod) as TsModule);
	typescriptModulePromiseByPath.set(modulePath, promise);
	return promise;
}

export async function readShellPageLayoutFields(shellPagePath: string, defaults?: Partial<ShellLayoutFields>): Promise<ShellLayoutFields> {
	const tsModule = await loadTypeScriptForFile(shellPagePath);
	const sourceText = await Bun.file(shellPagePath).text();
	const sourceFile = tsModule.createSourceFile(shellPagePath, sourceText, tsModule.ScriptTarget.Latest, true, tsModule.ScriptKind.TSX);
	const out: ShellLayoutFields = {
		title: "NUI",
		cspNonce: "nojsx-importmap",
		appHostId: "app",
		bodyClass: "",
		headerAttributes: 'lang="en"',
		headHtml: "",
		headerHtml: "",
		footerHtml: "",
		scriptsHtml: "",
		...defaults
	};

	const byName: Record<string, keyof ShellLayoutFields> = {
		layout_title: "title",
		layout_cspNonce: "cspNonce",
		layout_appHostId: "appHostId",
		layout_bodyClass: "bodyClass",
		layout_headerAttributes: "headerAttributes",
		headerAttributes: "headerAttributes",
		layout_head_html: "headHtml",
		layout_header: "headerHtml",
		layout_footer: "footerHtml",
		layout_scripts: "scriptsHtml"
	};

	const setValue = (propName: string, initializer?: import("typescript").Expression) => {
		const outKey = byName[propName];
		if (!outKey || !initializer) return;
		if (tsModule.isStringLiteral(initializer) || tsModule.isNoSubstitutionTemplateLiteral(initializer)) {
			out[outKey] = initializer.text as never;
			return;
		}
		out[outKey] = stripOuterParens(sourceText.slice(initializer.pos, initializer.end)) as never;
	};

	const visit = (node: import("typescript").Node) => {
		if (tsModule.isClassDeclaration(node) && node.name?.text === "ShellPage") {
			for (const member of node.members) {
				if (!tsModule.isPropertyDeclaration(member)) continue;
				const isStatic = member.modifiers?.some((modifier) => modifier.kind === tsModule.SyntaxKind.StaticKeyword);
				if (!isStatic || !member.name || !tsModule.isIdentifier(member.name)) continue;
				setValue(member.name.text, member.initializer);
			}
		}
		tsModule.forEachChild(node, visit);
	};

	visit(sourceFile);
	return out;
}