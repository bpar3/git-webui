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

describe("webui pull strategy / auto-fetch preferences", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
        webui.__testLocalStorage.clear();
    });

    test("getPullStrategy defaults to fast-forward", () => {
        expect(webui.getPullStrategy()).toBe("ff");
    });

    test("getPullStrategy reflects a stored rebase preference", () => {
        webui.__testLocalStorage.setItem(webui.PULL_STRATEGY_KEY, "rebase");
        expect(webui.getPullStrategy()).toBe("rebase");
    });

    test("isAutoFetchEnabled defaults to false", () => {
        expect(webui.isAutoFetchEnabled()).toBe(false);
    });

    test("isAutoFetchEnabled is true only when explicitly enabled", () => {
        webui.__testLocalStorage.setItem(webui.AUTO_FETCH_KEY, "1");
        expect(webui.isAutoFetchEnabled()).toBe(true);
        webui.__testLocalStorage.setItem(webui.AUTO_FETCH_KEY, "0");
        expect(webui.isAutoFetchEnabled()).toBe(false);
    });
});

describe("webui avatar helpers", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("getInitials uses first and last name initials", () => {
        expect(webui.getInitials("Binu Parayil")).toBe("BP");
        expect(webui.getInitials("Éric ALBER")).toBe("ÉA");
    });

    test("getInitials falls back for single-word or empty names", () => {
        expect(webui.getInitials("Madonna")).toBe("MA");
        expect(webui.getInitials("")).toBe("?");
        expect(webui.getInitials(null)).toBe("?");
        expect(webui.getInitials("   ")).toBe("?");
    });

    test("colorForAuthor is deterministic for the same name", () => {
        expect(webui.colorForAuthor("Binu Parayil")).toBe(webui.colorForAuthor("Binu Parayil"));
    });

    test("colorForAuthor always returns one of webui.COLORS", () => {
        expect(webui.COLORS).toContain(webui.colorForAuthor("Binu Parayil"));
        expect(webui.COLORS).toContain(webui.colorForAuthor(""));
    });

    test("colorForAuthor differs for at least some different names", () => {
        var colors = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"].map(webui.colorForAuthor);
        var distinct = colors.filter(function(color, index) { return colors.indexOf(color) == index; });
        expect(distinct.length).toBeGreaterThan(1);
    });
});

describe("webui.withRepoParam", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("returns the url unchanged when no repo is active", () => {
        webui.activeRepoId = null;
        expect(webui.withRepoParam("/api/branches")).toBe("/api/branches");
    });

    test("appends ?repo= when the url has no query string yet", () => {
        webui.activeRepoId = "/home/user/repo";
        expect(webui.withRepoParam("/api/branches")).toBe("/api/branches?repo=%2Fhome%2Fuser%2Frepo");
    });

    test("appends &repo= when the url already has a query string", () => {
        webui.activeRepoId = "/home/user/repo";
        expect(webui.withRepoParam("/api/blame?path=README.md")).toBe(
            "/api/blame?path=README.md&repo=%2Fhome%2Fuser%2Frepo"
        );
    });
});

describe("webui.setRefChipFilter", () => {
    let webui;
    let $;

    beforeEach(() => {
        webui = loadWebui();
        $ = webui.__testJQuery;
        $(webui.__testDocument.body).empty().append(
            '<button class="log-entry-ref" data-ref-name="devel">devel</button>' +
            '<button class="log-entry-ref" data-ref-name="master">master</button>' +
            '<button class="log-entry-ref" data-ref-name="devel">devel</button>'
        );
    });

    test("defaults to showing every ref chip", () => {
        expect(webui.refChipFilterName).toBeNull();
        $(".log-entry-ref").each(function() {
            expect($(this).css("display")).not.toBe("none");
        });
    });

    test("hides chips that don't match the selected ref name", () => {
        webui.setRefChipFilter("devel");
        expect(webui.refChipFilterName).toBe("devel");
        expect($(".log-entry-ref[data-ref-name='master']").css("display")).toBe("none");
        $(".log-entry-ref[data-ref-name='devel']").each(function() {
            expect($(this).css("display")).not.toBe("none");
        });
    });

    test("clearing the filter (null) shows every chip again", () => {
        webui.setRefChipFilter("devel");
        webui.setRefChipFilter(null);
        expect(webui.refChipFilterName).toBeNull();
        $(".log-entry-ref").each(function() {
            expect($(this).css("display")).not.toBe("none");
        });
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

describe("webui.groupRefsByCommit", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("returns an empty list when there is nothing to place", () => {
        expect(webui.groupRefsByCommit([], [])).toEqual([]);
        expect(webui.groupRefsByCommit(undefined, undefined)).toEqual([]);
    });

    test("keeps a level branch and its upstream on one commit", () => {
        const groups = webui.groupRefsByCommit(
            [{ local_name: "devel", remote_name: "origin/devel", commit: "aaa", remote_commit: "aaa" }], []);
        expect(groups).toHaveLength(1);
        expect(groups[0].commit).toBe("aaa");
        expect(groups[0].refs.map(r => r.displayName)).toEqual(["devel", "origin/devel"]);
    });

    test("splits a branch from its upstream when it is ahead", () => {
        const groups = webui.groupRefsByCommit(
            [{ local_name: "devel", remote_name: "origin/devel", commit: "newer", remote_commit: "older" }], []);
        expect(groups).toHaveLength(2);
        const byCommit = Object.fromEntries(groups.map(g => [g.commit, g.refs.map(r => r.displayName)]));
        expect(byCommit).toEqual({ newer: ["devel"], older: ["origin/devel"] });
    });

    test("places a remote-only branch at its own commit", () => {
        const groups = webui.groupRefsByCommit(
            [{ local_name: null, remote_name: "origin/feature", commit: "bbb" }], []);
        expect(groups).toHaveLength(1);
        expect(groups[0].refs[0]).toMatchObject({ kind: "remote", displayName: "origin/feature" });
    });

    test("groups tags onto the commit they resolve to", () => {
        const groups = webui.groupRefsByCommit(
            [{ local_name: "main", commit: "ccc" }],
            [{ name: "v1.0", commit: "ccc", annotated: true }]);
        expect(groups).toHaveLength(1);
        expect(groups[0].refs.map(r => r.kind)).toEqual(["local", "tag"]);
        expect(groups[0].refs[1].annotated).toBe(true);
    });

    test("orders current branch first, then locals, remotes, tags", () => {
        const groups = webui.groupRefsByCommit(
            [
                { local_name: "zeta", commit: "x" },
                { local_name: "alpha", commit: "x", current: true },
                { local_name: null, remote_name: "origin/zeta", commit: "x" },
            ],
            [{ name: "v2", commit: "x" }]);
        expect(groups[0].refs.map(r => r.displayName))
            .toEqual(["alpha", "zeta", "origin/zeta", "v2"]);
    });

    test("ignores refs with no commit rather than grouping them together", () => {
        const groups = webui.groupRefsByCommit([{ local_name: "orphan", commit: "" }], []);
        expect(groups).toEqual([]);
    });
});

describe("webui.parseHunkHeader", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("reads both starting line numbers", () => {
        expect(webui.parseHunkHeader("@@ -1190,7 +1190,6 @@")).toEqual({
            oldStart: 1190,
            newStart: 1190,
        });
    });

    test("keeps the trailing context section out of the result", () => {
        expect(webui.parseHunkHeader("@@ -1319,6 +1318,143 @@ body {")).toEqual({
            oldStart: 1319,
            newStart: 1318,
        });
    });

    test("handles single-line hunks that omit the count", () => {
        expect(webui.parseHunkHeader("@@ -0,0 +1 @@")).toEqual({
            oldStart: 0,
            newStart: 1,
        });
    });

    test("handles combined diffs with extra @ markers", () => {
        expect(webui.parseHunkHeader("@@@ -1,7 +1,6 @@@")).toEqual({
            oldStart: 1,
            newStart: 1,
        });
    });

    test("returns null for non-hunk lines", () => {
        expect(webui.parseHunkHeader("+added line")).toBeNull();
        expect(webui.parseHunkHeader("diff --git a/x b/x")).toBeNull();
        expect(webui.parseHunkHeader("")).toBeNull();
        expect(webui.parseHunkHeader(undefined)).toBeNull();
    });
});

describe("webui.quoteArg", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("wraps plain values in double quotes", () => {
        expect(webui.quoteArg("src/a.js")).toBe('"src/a.js"');
    });

    test("keeps paths with spaces as a single argument", () => {
        expect(webui.quoteArg("src/some file.txt")).toBe('"src/some file.txt"');
    });

    test("escapes embedded quotes and backslashes", () => {
        expect(webui.quoteArg('a"b')).toBe('"a\\"b"');
        expect(webui.quoteArg("a\\b")).toBe('"a\\\\b"');
    });

    test("leaves shell metacharacters alone (shlex is not a shell)", () => {
        expect(webui.quoteArg("a$b`c")).toBe('"a$b`c"');
    });
});

describe("webui.parseNameStatus", () => {
    let webui;

    beforeEach(() => {
        webui = loadWebui();
    });

    test("returns an empty list for empty or missing output", () => {
        expect(webui.parseNameStatus("")).toEqual([]);
        expect(webui.parseNameStatus(undefined)).toEqual([]);
    });

    test("parses status letters and paths", () => {
        expect(webui.parseNameStatus("M\tsrc/a.js\nA\tsrc/b.js\nD\tsrc/c.js")).toEqual([
            { status: "M", path: "src/a.js" },
            { status: "A", path: "src/b.js" },
            { status: "D", path: "src/c.js" },
        ]);
    });

    test("uses the destination path for renames and drops the score", () => {
        expect(webui.parseNameStatus("R100\told/name.js\tnew/name.js")).toEqual([
            { status: "R", path: "new/name.js" },
        ]);
    });

    test("ignores malformed lines without a path", () => {
        expect(webui.parseNameStatus("M\nM\tkept.js\n\t\n")).toEqual([
            { status: "M", path: "kept.js" },
        ]);
    });

    test("handles paths containing spaces", () => {
        expect(webui.parseNameStatus("A\tsrc/some file.txt")).toEqual([
            { status: "A", path: "src/some file.txt" },
        ]);
    });
});

describe("webui.formatRelativeTime", () => {
    let webui;
    const now = new Date("2026-08-25T12:00:00Z");
    const minutesAgo = (n) => new Date(now.getTime() - n * 60 * 1000);
    const hoursAgo = (n) => minutesAgo(n * 60);
    const daysAgo = (n) => hoursAgo(n * 24);

    beforeEach(() => {
        webui = loadWebui();
    });

    test("just now for sub-minute deltas", () => {
        expect(webui.formatRelativeTime(minutesAgo(0.5), now)).toBe("just now");
    });

    test("singular vs plural minutes", () => {
        expect(webui.formatRelativeTime(minutesAgo(1), now)).toBe("1 minute ago");
        expect(webui.formatRelativeTime(minutesAgo(8), now)).toBe("8 minutes ago");
    });

    test("singular vs plural hours", () => {
        expect(webui.formatRelativeTime(hoursAgo(1), now)).toBe("1 hour ago");
        expect(webui.formatRelativeTime(hoursAgo(17), now)).toBe("17 hours ago");
    });

    test("exactly one day is 'yesterday'", () => {
        expect(webui.formatRelativeTime(daysAgo(1), now)).toBe("yesterday");
    });

    test("2-6 days as 'N days ago'", () => {
        expect(webui.formatRelativeTime(daysAgo(2), now)).toBe("2 days ago");
        expect(webui.formatRelativeTime(daysAgo(6), now)).toBe("6 days ago");
    });

    test("exactly one week is 'last week'", () => {
        expect(webui.formatRelativeTime(daysAgo(7), now)).toBe("last week");
    });

    test("multiple weeks as 'N weeks ago'", () => {
        expect(webui.formatRelativeTime(daysAgo(21), now)).toBe("3 weeks ago");
    });

    test("around a month is 'last month'", () => {
        expect(webui.formatRelativeTime(daysAgo(30), now)).toBe("last month");
    });

    test("multiple months as 'N months ago'", () => {
        expect(webui.formatRelativeTime(daysAgo(90), now)).toBe("3 months ago");
    });

    test("around a year is 'last year'", () => {
        expect(webui.formatRelativeTime(daysAgo(365), now)).toBe("last year");
    });

    test("multiple years as 'N years ago'", () => {
        expect(webui.formatRelativeTime(daysAgo(365 * 3), now)).toBe("3 years ago");
    });
});
