const { loadGitpar } = require("./helpers/load-gitpar");

describe("parseStatusLines", () => {
    let gitpar;
    beforeEach(() => { gitpar = loadGitpar(); });

    test("reads the index column when it has something to say", () => {
        expect(gitpar.parseStatusLines("M  src/a.js")).toEqual([
            { path: "src/a.js", status: "M", conflicted: false },
        ]);
    });

    test("falls back to the working tree column", () => {
        expect(gitpar.parseStatusLines(" M src/a.js")[0].status).toBe("M");
    });

    test("untracked files report as ?", () => {
        expect(gitpar.parseStatusLines("?? new.txt")[0].status).toBe("?");
    });

    test("every unmerged code reports as a conflict", () => {
        ["DD", "AU", "UD", "UA", "DU", "AA", "UU"].forEach((code) => {
            const [file] = gitpar.parseStatusLines(code + " docs/x.md");
            expect(file.conflicted).toBe(true);
            expect(file.status).toBe("U");
        });
    });

    test("a staged add is not mistaken for the AA conflict", () => {
        const [file] = gitpar.parseStatusLines("A  added.txt");
        expect(file.conflicted).toBe(false);
        expect(file.status).toBe("A");
    });

    test("blank and truncated lines are skipped", () => {
        expect(gitpar.parseStatusLines("\n\nM \nM  ok.txt\n")).toEqual([
            { path: "ok.txt", status: "M", conflicted: false },
        ]);
    });

    test("paths containing spaces survive intact", () => {
        expect(gitpar.parseStatusLines("M  some dir/a file.txt")[0].path)
            .toBe("some dir/a file.txt");
    });
});

describe("summarizeStatusCounts", () => {
    let gitpar;
    beforeEach(() => { gitpar = loadGitpar(); });

    test("one kind gives one count", () => {
        const files = gitpar.parseStatusLines("M  a\nM  b\nM  c");
        expect(gitpar.summarizeStatusCounts(files)).toEqual([{ status: "M", count: 3 }]);
    });

    test("mixed kinds are counted separately, in first-seen order", () => {
        const files = gitpar.parseStatusLines("M  a\nUU b\nM  c\n?? d");
        expect(gitpar.summarizeStatusCounts(files)).toEqual([
            { status: "M", count: 2 },
            { status: "U", count: 1 },
            { status: "?", count: 1 },
        ]);
    });

    test("no files gives no counts", () => {
        expect(gitpar.summarizeStatusCounts([])).toEqual([]);
    });
});

describe("theme resolution", () => {
    let gitpar;
    beforeEach(() => { gitpar = loadGitpar(); });

    test("an explicit choice is used as given", () => {
        expect(gitpar.resolveTheme("dark")).toBe("dark");
        expect(gitpar.resolveTheme("light")).toBe("light");
    });

    test("anything unrecognised resolves to light", () => {
        expect(gitpar.resolveTheme("neon")).toBe("light");
        expect(gitpar.resolveTheme(undefined)).toBe("light");
    });

    test("system follows what the desktop reports", () => {
        gitpar.systemPrefersDark = () => true;
        expect(gitpar.resolveTheme("system")).toBe("dark");
        gitpar.systemPrefersDark = () => false;
        expect(gitpar.resolveTheme("system")).toBe("light");
    });
});
