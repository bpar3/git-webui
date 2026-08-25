const { loadWebui } = require("./helpers/load-webui");

describe("webui text/formatting helpers", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("escapeHtml escapes HTML special characters", () => {
        expect(webui.escapeHtml("<script>alert('x')</script>")).toBe(
            "&lt;script&gt;alert('x')&lt;/script&gt;"
        );
    });

    test("escapeHtml handles falsy input", () => {
        expect(webui.escapeHtml(undefined)).toBe("");
        expect(webui.escapeHtml(null)).toBe("");
        expect(webui.escapeHtml("")).toBe("");
    });

    test("splitLines splits on newlines", () => {
        expect(webui.splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
    });

    test("shortRefName strips known ref prefixes", () => {
        expect(webui.shortRefName("refs/heads/devel")).toBe("devel");
        expect(webui.shortRefName("refs/remotes/origin/devel")).toBe("origin/devel");
        expect(webui.shortRefName("refs/tags/v1.0")).toBe("v1.0");
    });

    test("shortRefName passes through unknown refs and falsy input", () => {
        expect(webui.shortRefName("HEAD")).toBe("HEAD");
        expect(webui.shortRefName("")).toBe("");
        expect(webui.shortRefName(null)).toBe("");
    });

    test("formatRepoCounts reports a clean tree when nothing changed", () => {
        expect(webui.formatRepoCounts({})).toBe("Clean working tree");
    });

    test("formatRepoCounts joins non-zero counts", () => {
        expect(
            webui.formatRepoCounts({ staged_count: 2, changed_count: 1, untracked_count: 0 })
        ).toBe("2 staged • 1 changed");
    });

    test("formatRepoTracking reports in sync when even", () => {
        expect(webui.formatRepoTracking({ ahead: 0, behind: 0 })).toBe("in sync");
    });

    test("formatRepoTracking reports ahead/behind counts", () => {
        expect(webui.formatRepoTracking({ ahead: 3, behind: 1 })).toBe("ahead 3 • behind 1");
    });

    test("formatBranchTracking falls back to branch status", () => {
        expect(webui.formatBranchTracking({ status: "local only" })).toBe("local only");
    });

    test("formatBranchTracking includes upstream and ahead/behind", () => {
        expect(
            webui.formatBranchTracking({ upstream: "origin/devel", ahead: 2, behind: 0 })
        ).toBe("origin/devel • ahead 2");
    });
});

describe("webui.parseDecoratedRefs", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("parses HEAD, local, remote and tag refs from a decorated log line", () => {
        const items = webui.parseDecoratedRefs(
            ["HEAD -> refs/heads/devel", "refs/remotes/origin/devel", "tag: refs/tags/v1.0"],
            "abc123"
        );

        expect(items).toEqual([
            { kind: "head", fullName: "HEAD", displayName: "HEAD", gitRef: "HEAD", commit: "abc123" },
            {
                kind: "local",
                fullName: "refs/heads/devel",
                displayName: "devel",
                gitRef: "devel",
                commit: "abc123",
            },
            {
                kind: "remote",
                fullName: "refs/remotes/origin/devel",
                displayName: "origin/devel",
                gitRef: "origin/devel",
                commit: "abc123",
            },
            {
                kind: "tag",
                fullName: "refs/tags/v1.0",
                displayName: "v1.0",
                gitRef: "v1.0",
                commit: "abc123",
            },
        ]);
    });

    test("de-duplicates identical refs", () => {
        const items = webui.parseDecoratedRefs(
            ["refs/heads/devel", "refs/heads/devel"],
            "abc123"
        );
        expect(items).toHaveLength(1);
    });

    test("ignores falsy ref entries", () => {
        expect(webui.parseDecoratedRefs([null, "", "refs/heads/devel"], "abc123")).toHaveLength(1);
    });
});

describe("webui.getCurrentBranch / findBranchByRef", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("getCurrentBranch returns null when no branch is current", () => {
        webui.branches = [{ name: "devel", current: false }];
        expect(webui.getCurrentBranch()).toBeNull();
    });

    test("getCurrentBranch returns the branch flagged current", () => {
        webui.branches = [
            { name: "devel", current: false },
            { name: "master", current: true },
        ];
        expect(webui.getCurrentBranch().name).toBe("master");
    });
});
