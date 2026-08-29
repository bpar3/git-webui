const { loadGitpar } = require("./helpers/load-gitpar");

describe("buildResolvedLines", () => {
    let gitpar;
    beforeEach(() => { gitpar = loadGitpar(); });

    const segments = [
        { kind: "context", lines: ["before"] },
        { kind: "conflict", ours: ["ours a", "ours b"], theirs: ["theirs a"], base: [] },
        { kind: "context", lines: ["after"] },
    ];
    const text = (lines) => lines.map((line) => line.text);

    test("context passes through when nothing is chosen", () => {
        const lines = gitpar.buildResolvedLines(segments, [null, { ours: false, theirs: false }, null]);
        expect(text(lines)).toEqual(["before", "after"]);
    });

    test("taking ours contributes only our lines", () => {
        const lines = gitpar.buildResolvedLines(segments, [null, { ours: true, theirs: false }, null]);
        expect(text(lines)).toEqual(["before", "ours a", "ours b", "after"]);
    });

    test("taking theirs contributes only their lines", () => {
        const lines = gitpar.buildResolvedLines(segments, [null, { ours: false, theirs: true }, null]);
        expect(text(lines)).toEqual(["before", "theirs a", "after"]);
    });

    test("taking both keeps ours first", () => {
        const lines = gitpar.buildResolvedLines(segments, [null, { ours: true, theirs: true }, null]);
        expect(text(lines)).toEqual(["before", "ours a", "ours b", "theirs a", "after"]);
    });

    test("every line records which side it came from", () => {
        const lines = gitpar.buildResolvedLines(segments, [null, { ours: true, theirs: true }, null]);
        expect(lines.map((line) => line.origin))
            .toEqual(["context", "ours", "ours", "theirs", "context"]);
    });

    test("a missing selection entry drops the region rather than throwing", () => {
        expect(text(gitpar.buildResolvedLines(segments, []))).toEqual(["before", "after"]);
        expect(text(gitpar.buildResolvedLines(segments, null))).toEqual(["before", "after"]);
    });

    test("a file with no conflicts is returned unchanged", () => {
        const plain = [{ kind: "context", lines: ["one", "two"] }];
        expect(text(gitpar.buildResolvedLines(plain, []))).toEqual(["one", "two"]);
    });

    test("consecutive conflicts each resolve independently", () => {
        const pair = [
            { kind: "conflict", ours: ["A"], theirs: ["a"] },
            { kind: "conflict", ours: ["B"], theirs: ["b"] },
        ];
        const lines = gitpar.buildResolvedLines(pair, [{ ours: true }, { theirs: true }]);
        expect(text(lines)).toEqual(["A", "b"]);
    });
});
