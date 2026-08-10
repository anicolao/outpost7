import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const MAX_EVENT_TIMEOUT_MS = 2_000;
const projectRoot = process.cwd();

function findTypeScriptFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) return findTypeScriptFiles(fullPath);
        return entry.name.endsWith('.ts') ? [fullPath] : [];
    });
}

function sourceFiles() {
    return [
        join(projectRoot, 'playwright.config.ts'),
        ...findTypeScriptFiles(join(projectRoot, 'tests/e2e')),
    ];
}

function location(source: ts.SourceFile, node: ts.Node) {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    return `${relative(projectRoot, source.fileName)}:${line + 1}`;
}

describe('E2E waiting policy', () => {
    it('serves a prebuilt bundle so navigation never waits for development compilation', () => {
        const config = readFileSync(join(projectRoot, 'playwright.config.ts'), 'utf8');

        expect(config).toContain("command: 'npm run build && npm run preview -- --port 5177'");
    });

    it('hides platform-native scrollbars during pixel-perfect capture', () => {
        const config = readFileSync(join(projectRoot, 'playwright.config.ts'), 'utf8');

        expect(config).toContain("'--hide-scrollbars'");
    });

    it('gives every host game navigation an explicit seed', () => {
        const violations: string[] = [];

        for (const file of sourceFiles()) {
            const source = ts.createSourceFile(
                file,
                readFileSync(file, 'utf8'),
                ts.ScriptTarget.Latest,
                true,
            );

            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node) && node.expression.getText(source).endsWith('.goto')) {
                    const destination = node.arguments[0]?.getText(source) ?? '';
                    const isControllerRoute = destination.includes('/#/hand');
                    if (!isControllerRoute && !destination.includes('seed=')) {
                        violations.push(`${location(source, node)} navigates to an unseeded host game`);
                    }
                }
                ts.forEachChild(node, visit);
            };

            visit(source);
        }

        expect(violations).toEqual([]);
    });

    it('uses condition-driven waits instead of fixed-duration sleeps', () => {
        const violations: string[] = [];

        for (const file of sourceFiles()) {
            const source = ts.createSourceFile(
                file,
                readFileSync(file, 'utf8'),
                ts.ScriptTarget.Latest,
                true,
            );

            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node)) {
                    const callee = node.expression.getText(source);
                    if (callee === 'setTimeout' || callee.endsWith('.waitForTimeout')) {
                        violations.push(`${location(source, node)} uses ${callee}`);
                    }
                }
                ts.forEachChild(node, visit);
            };

            visit(source);
        }

        expect(violations).toEqual([]);
    });

    it('uses events and assertions instead of polling loops', () => {
        const violations: string[] = [];

        for (const file of sourceFiles()) {
            const source = ts.createSourceFile(
                file,
                readFileSync(file, 'utf8'),
                ts.ScriptTarget.Latest,
                true,
            );

            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node)) {
                    const callee = node.expression.getText(source);
                    if (callee === 'expect.poll' || callee.endsWith('.waitForFunction')) {
                        violations.push(`${location(source, node)} uses ${callee}`);
                    }
                }
                ts.forEachChild(node, visit);
            };

            visit(source);
        }

        expect(violations).toEqual([]);
    });

    it('caps explicit event timeouts at two seconds', () => {
        const violations: string[] = [];

        for (const file of sourceFiles()) {
            const source = ts.createSourceFile(
                file,
                readFileSync(file, 'utf8'),
                ts.ScriptTarget.Latest,
                true,
            );

            const visit = (node: ts.Node) => {
                if (
                    ts.isPropertyAssignment(node) &&
                    node.name.getText(source) === 'timeout' &&
                    ts.isNumericLiteral(node.initializer)
                ) {
                    const timeout = Number(node.initializer.text.replaceAll('_', ''));
                    if (timeout > MAX_EVENT_TIMEOUT_MS) {
                        violations.push(`${location(source, node)} sets timeout to ${timeout}ms`);
                    }
                }
                if (
                    ts.isCallExpression(node) &&
                    node.expression.getText(source) === 'AbortSignal.timeout' &&
                    ts.isNumericLiteral(node.arguments[0]) &&
                    Number(node.arguments[0].text.replaceAll('_', '')) > MAX_EVENT_TIMEOUT_MS
                ) {
                    violations.push(`${location(source, node)} sets an abort timeout above ${MAX_EVENT_TIMEOUT_MS}ms`);
                }
                ts.forEachChild(node, visit);
            };

            visit(source);
        }

        expect(violations).toEqual([]);
    });

    it('gives every Playwright event wait an explicit bounded timeout', () => {
        const violations: string[] = [];

        for (const file of sourceFiles()) {
            const source = ts.createSourceFile(
                file,
                readFileSync(file, 'utf8'),
                ts.ScriptTarget.Latest,
                true,
            );

            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node) && node.expression.getText(source).endsWith('.waitForEvent')) {
                    const options = node.arguments[1];
                    const timeout = options && ts.isObjectLiteralExpression(options)
                        ? options.properties.find((property): property is ts.PropertyAssignment =>
                            ts.isPropertyAssignment(property) && property.name.getText(source) === 'timeout'
                        )
                        : undefined;

                    if (!timeout || !ts.isNumericLiteral(timeout.initializer)) {
                        violations.push(`${location(source, node)} has no explicit numeric timeout`);
                    }
                }
                ts.forEachChild(node, visit);
            };

            visit(source);
        }

        expect(violations).toEqual([]);
    });
});
