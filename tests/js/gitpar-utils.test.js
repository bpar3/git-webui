const { loadGitpar } = require("./helpers/load-gitpar");

describe("gitpar text/formatting helpers", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("escapeHtml escapes HTML special characters", () => {
        expect(gitpar.escapeHtml("<script>alert('x')</script>")).toBe(
            "&lt;script&gt;alert('x')&lt;/script&gt;"
        );
    });

    test("escapeHtml handles falsy input", () => {
        expect(gitpar.escapeHtml(undefined)).toBe("");
        expect(gitpar.escapeHtml(null)).toBe("");
        expect(gitpar.escapeHtml("")).toBe("");
    });

    test("splitLines splits on newlines", () => {
        expect(gitpar.splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
    });

    test("shortRefName strips known ref prefixes", () => {
        expect(gitpar.shortRefName("refs/heads/devel")).toBe("devel");
        expect(gitpar.shortRefName("refs/remotes/origin/devel")).toBe("origin/devel");
        expect(gitpar.shortRefName("refs/tags/v1.0")).toBe("v1.0");
    });

    test("shortRefName passes through unknown refs and falsy input", () => {
        expect(gitpar.shortRefName("HEAD")).toBe("HEAD");
        expect(gitpar.shortRefName("")).toBe("");
        expect(gitpar.shortRefName(null)).toBe("");
    });

    test("formatRepoCounts reports a clean tree when nothing changed", () => {
        expect(gitpar.formatRepoCounts({})).toBe("Clean working tree");
    });

    test("formatRepoCounts joins non-zero counts", () => {
        expect(
            gitpar.formatRepoCounts({ staged_count: 2, changed_count: 1, untracked_count: 0 })
        ).toBe("2 staged • 1 changed");
    });

    test("formatRepoTracking reports in sync when even", () => {
        expect(gitpar.formatRepoTracking({ ahead: 0, behind: 0 })).toBe("in sync");
    });

    test("formatRepoTracking reports ahead/behind counts", () => {
        expect(gitpar.formatRepoTracking({ ahead: 3, behind: 1 })).toBe("ahead 3 • behind 1");
    });

    test("formatBranchTracking falls back to branch status", () => {
        expect(gitpar.formatBranchTracking({ status: "local only" })).toBe("local only");
    });

    test("formatBranchTracking includes upstream and ahead/behind", () => {
        expect(
            gitpar.formatBranchTracking({ upstream: "origin/devel", ahead: 2, behind: 0 })
        ).toBe("origin/devel • ahead 2");
    });
});

describe("gitpar.parseDecoratedRefs", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("parses HEAD, local, remote and tag refs from a decorated log line", () => {
        const items = gitpar.parseDecoratedRefs(
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
        const items = gitpar.parseDecoratedRefs(
            ["refs/heads/devel", "refs/heads/devel"],
            "abc123"
        );
        expect(items).toHaveLength(1);
    });

    test("ignores falsy ref entries", () => {
        expect(gitpar.parseDecoratedRefs([null, "", "refs/heads/devel"], "abc123")).toHaveLength(1);
    });
});

describe("gitpar pull strategy / auto-fetch preferences", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
        gitpar.__testLocalStorage.clear();
    });

    test("getPullStrategy defaults to fast-forward", () => {
        expect(gitpar.getPullStrategy()).toBe("ff");
    });

    test("getPullStrategy reflects a stored rebase preference", () => {
        gitpar.__testLocalStorage.setItem(gitpar.PULL_STRATEGY_KEY, "rebase");
        expect(gitpar.getPullStrategy()).toBe("rebase");
    });

    test("isAutoFetchEnabled defaults to false", () => {
        expect(gitpar.isAutoFetchEnabled()).toBe(false);
    });

    test("isAutoFetchEnabled is true only when explicitly enabled", () => {
        gitpar.__testLocalStorage.setItem(gitpar.AUTO_FETCH_KEY, "1");
        expect(gitpar.isAutoFetchEnabled()).toBe(true);
        gitpar.__testLocalStorage.setItem(gitpar.AUTO_FETCH_KEY, "0");
        expect(gitpar.isAutoFetchEnabled()).toBe(false);
    });
});

describe("gitpar avatar helpers", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("getInitials uses first and last name initials", () => {
        expect(gitpar.getInitials("Binu Parayil")).toBe("BP");
        expect(gitpar.getInitials("Éric ALBER")).toBe("ÉA");
    });

    test("getInitials falls back for single-word or empty names", () => {
        expect(gitpar.getInitials("Madonna")).toBe("MA");
        expect(gitpar.getInitials("")).toBe("?");
        expect(gitpar.getInitials(null)).toBe("?");
        expect(gitpar.getInitials("   ")).toBe("?");
    });

    test("colorForAuthor is deterministic for the same identity", () => {
        expect(gitpar.colorForAuthor("Binu Parayil", "b@example.com"))
            .toBe(gitpar.colorForAuthor("Binu Parayil", "b@example.com"));
    });

    test("colorForAuthor always returns one of gitpar.COLORS", () => {
        expect(gitpar.COLORS).toContain(gitpar.colorForAuthor("Binu Parayil", "b@example.com"));
        expect(gitpar.COLORS).toContain(gitpar.colorForAuthor("", ""));
        expect(gitpar.COLORS).toContain(gitpar.colorForAuthor("Binu Parayil"));
    });

    test("colorForAuthor differs for at least some different names", () => {
        var names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"];
        var colors = names.map(function(name) { return gitpar.colorForAuthor(name, "x@example.com"); });
        var distinct = colors.filter(function(color, index) { return colors.indexOf(color) == index; });
        expect(distinct.length).toBeGreaterThan(1);
    });

    test("colorForAuthor separates one name used with different addresses", () => {
        // The point of hashing the address: two contributors who share a
        // name, or one who commits from work and personal addresses,
        // must not share an avatar colour.
        var addresses = ["a@example.com", "b@example.com", "c@example.com",
                         "d@example.com", "e@example.com", "f@example.com"];
        var colors = addresses.map(function(email) { return gitpar.colorForAuthor("Binu Parayil", email); });
        var distinct = colors.filter(function(color, index) { return colors.indexOf(color) == index; });
        expect(distinct.length).toBeGreaterThan(1);
    });

    test("colorForAuthor does not collide across the name/email boundary", () => {
        expect(gitpar.colorForAuthor("ab", "c")).not.toBe(gitpar.colorForAuthor("a", "bc"));
    });
});

describe("gitpar.withRepoParam", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("returns the url unchanged when no repo is active", () => {
        gitpar.activeRepoId = null;
        expect(gitpar.withRepoParam("/api/branches")).toBe("/api/branches");
    });

    test("appends ?repo= when the url has no query string yet", () => {
        gitpar.activeRepoId = "/home/user/repo";
        expect(gitpar.withRepoParam("/api/branches")).toBe("/api/branches?repo=%2Fhome%2Fuser%2Frepo");
    });

    test("appends &repo= when the url already has a query string", () => {
        gitpar.activeRepoId = "/home/user/repo";
        expect(gitpar.withRepoParam("/api/blame?path=README.md")).toBe(
            "/api/blame?path=README.md&repo=%2Fhome%2Fuser%2Frepo"
        );
    });
});

describe("gitpar.setRefChipFilter", () => {
    let gitpar;
    let $;

    beforeEach(() => {
        gitpar = loadGitpar();
        $ = gitpar.__testJQuery;
        $(gitpar.__testDocument.body).empty().append(
            '<button class="log-entry-ref" data-ref-name="devel">devel</button>' +
            '<button class="log-entry-ref" data-ref-name="master">master</button>' +
            '<button class="log-entry-ref" data-ref-name="devel">devel</button>'
        );
    });

    test("defaults to showing every ref chip", () => {
        expect(gitpar.refChipFilterName).toBeNull();
        $(".log-entry-ref").each(function() {
            expect($(this).css("display")).not.toBe("none");
        });
    });

    test("hides chips that don't match the selected ref name", () => {
        gitpar.setRefChipFilter("devel");
        expect(gitpar.refChipFilterName).toBe("devel");
        expect($(".log-entry-ref[data-ref-name='master']").css("display")).toBe("none");
        $(".log-entry-ref[data-ref-name='devel']").each(function() {
            expect($(this).css("display")).not.toBe("none");
        });
    });

    test("clearing the filter (null) shows every chip again", () => {
        gitpar.setRefChipFilter("devel");
        gitpar.setRefChipFilter(null);
        expect(gitpar.refChipFilterName).toBeNull();
        $(".log-entry-ref").each(function() {
            expect($(this).css("display")).not.toBe("none");
        });
    });
});

describe("gitpar.getCurrentBranch / findBranchByRef", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("getCurrentBranch returns null when no branch is current", () => {
        gitpar.branches = [{ name: "devel", current: false }];
        expect(gitpar.getCurrentBranch()).toBeNull();
    });

    test("getCurrentBranch returns the branch flagged current", () => {
        gitpar.branches = [
            { name: "devel", current: false },
            { name: "master", current: true },
        ];
        expect(gitpar.getCurrentBranch().name).toBe("master");
    });
});

describe("gitpar.formatStashSubject", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("strips the sha and subject git tacks onto an automatic stash", () => {
        expect(gitpar.formatStashSubject("WIP on slicksheet: 09726f9 C on main"))
            .toBe("Stash on slicksheet");
    });

    test("keeps the message from an explicit stash push", () => {
        expect(gitpar.formatStashSubject("On main: half-finished parser"))
            .toBe("Stash on main: half-finished parser");
    });

    test("handles an explicit stash with an empty message", () => {
        expect(gitpar.formatStashSubject("On main:")).toBe("Stash on main");
    });

    test("copes with branch names containing spaces or slashes", () => {
        expect(gitpar.formatStashSubject("WIP on feature/new ui: abc1234 x"))
            .toBe("Stash on feature/new ui");
    });

    test("passes through anything it doesn't recognise", () => {
        expect(gitpar.formatStashSubject("something else entirely"))
            .toBe("something else entirely");
    });

    test("falls back to a plain label when there is no message", () => {
        expect(gitpar.formatStashSubject("")).toBe("Stash");
        expect(gitpar.formatStashSubject(undefined)).toBe("Stash");
    });
});

describe("gitpar.groupRefsByCommit", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("returns an empty list when there is nothing to place", () => {
        expect(gitpar.groupRefsByCommit([], [])).toEqual([]);
        expect(gitpar.groupRefsByCommit(undefined, undefined)).toEqual([]);
    });

    test("keeps a level branch and its upstream on one commit", () => {
        const groups = gitpar.groupRefsByCommit(
            [{ local_name: "devel", remote_name: "origin/devel", commit: "aaa", remote_commit: "aaa" }], []);
        expect(groups).toHaveLength(1);
        expect(groups[0].commit).toBe("aaa");
        expect(groups[0].refs.map(r => r.displayName)).toEqual(["devel", "origin/devel"]);
    });

    test("splits a branch from its upstream when it is ahead", () => {
        const groups = gitpar.groupRefsByCommit(
            [{ local_name: "devel", remote_name: "origin/devel", commit: "newer", remote_commit: "older" }], []);
        expect(groups).toHaveLength(2);
        const byCommit = Object.fromEntries(groups.map(g => [g.commit, g.refs.map(r => r.displayName)]));
        expect(byCommit).toEqual({ newer: ["devel"], older: ["origin/devel"] });
    });

    test("places a remote-only branch at its own commit", () => {
        const groups = gitpar.groupRefsByCommit(
            [{ local_name: null, remote_name: "origin/feature", commit: "bbb" }], []);
        expect(groups).toHaveLength(1);
        expect(groups[0].refs[0]).toMatchObject({ kind: "remote", displayName: "origin/feature" });
    });

    test("groups tags onto the commit they resolve to", () => {
        const groups = gitpar.groupRefsByCommit(
            [{ local_name: "main", commit: "ccc" }],
            [{ name: "v1.0", commit: "ccc", annotated: true }]);
        expect(groups).toHaveLength(1);
        expect(groups[0].refs.map(r => r.kind)).toEqual(["local", "tag"]);
        expect(groups[0].refs[1].annotated).toBe(true);
    });

    test("orders current branch first, then locals, remotes, tags", () => {
        const groups = gitpar.groupRefsByCommit(
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
        const groups = gitpar.groupRefsByCommit([{ local_name: "orphan", commit: "" }], []);
        expect(groups).toEqual([]);
    });
});

describe("gitpar.parseHunkHeader", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("reads both starting line numbers", () => {
        expect(gitpar.parseHunkHeader("@@ -1190,7 +1190,6 @@")).toEqual({
            oldStart: 1190,
            newStart: 1190,
        });
    });

    test("keeps the trailing context section out of the result", () => {
        expect(gitpar.parseHunkHeader("@@ -1319,6 +1318,143 @@ body {")).toEqual({
            oldStart: 1319,
            newStart: 1318,
        });
    });

    test("handles single-line hunks that omit the count", () => {
        expect(gitpar.parseHunkHeader("@@ -0,0 +1 @@")).toEqual({
            oldStart: 0,
            newStart: 1,
        });
    });

    test("handles combined diffs with extra @ markers", () => {
        expect(gitpar.parseHunkHeader("@@@ -1,7 +1,6 @@@")).toEqual({
            oldStart: 1,
            newStart: 1,
        });
    });

    test("returns null for non-hunk lines", () => {
        expect(gitpar.parseHunkHeader("+added line")).toBeNull();
        expect(gitpar.parseHunkHeader("diff --git a/x b/x")).toBeNull();
        expect(gitpar.parseHunkHeader("")).toBeNull();
        expect(gitpar.parseHunkHeader(undefined)).toBeNull();
    });
});

describe("gitpar.quoteArg", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("wraps plain values in double quotes", () => {
        expect(gitpar.quoteArg("src/a.js")).toBe('"src/a.js"');
    });

    test("keeps paths with spaces as a single argument", () => {
        expect(gitpar.quoteArg("src/some file.txt")).toBe('"src/some file.txt"');
    });

    test("escapes embedded quotes and backslashes", () => {
        expect(gitpar.quoteArg('a"b')).toBe('"a\\"b"');
        expect(gitpar.quoteArg("a\\b")).toBe('"a\\\\b"');
    });

    test("leaves shell metacharacters alone (shlex is not a shell)", () => {
        expect(gitpar.quoteArg("a$b`c")).toBe('"a$b`c"');
    });
});

describe("gitpar.parseNameStatus", () => {
    let gitpar;

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("returns an empty list for empty or missing output", () => {
        expect(gitpar.parseNameStatus("")).toEqual([]);
        expect(gitpar.parseNameStatus(undefined)).toEqual([]);
    });

    test("parses status letters and paths", () => {
        expect(gitpar.parseNameStatus("M\tsrc/a.js\nA\tsrc/b.js\nD\tsrc/c.js")).toEqual([
            { status: "M", path: "src/a.js" },
            { status: "A", path: "src/b.js" },
            { status: "D", path: "src/c.js" },
        ]);
    });

    test("uses the destination path for renames and drops the score", () => {
        expect(gitpar.parseNameStatus("R100\told/name.js\tnew/name.js")).toEqual([
            { status: "R", path: "new/name.js" },
        ]);
    });

    test("ignores malformed lines without a path", () => {
        expect(gitpar.parseNameStatus("M\nM\tkept.js\n\t\n")).toEqual([
            { status: "M", path: "kept.js" },
        ]);
    });

    test("handles paths containing spaces", () => {
        expect(gitpar.parseNameStatus("A\tsrc/some file.txt")).toEqual([
            { status: "A", path: "src/some file.txt" },
        ]);
    });
});

describe("gitpar.formatRelativeTime", () => {
    let gitpar;
    const now = new Date("2026-08-25T12:00:00Z");
    const minutesAgo = (n) => new Date(now.getTime() - n * 60 * 1000);
    const hoursAgo = (n) => minutesAgo(n * 60);
    const daysAgo = (n) => hoursAgo(n * 24);

    beforeEach(() => {
        gitpar = loadGitpar();
    });

    test("just now for sub-minute deltas", () => {
        expect(gitpar.formatRelativeTime(minutesAgo(0.5), now)).toBe("just now");
    });

    test("singular vs plural minutes", () => {
        expect(gitpar.formatRelativeTime(minutesAgo(1), now)).toBe("1 minute ago");
        expect(gitpar.formatRelativeTime(minutesAgo(8), now)).toBe("8 minutes ago");
    });

    test("singular vs plural hours", () => {
        expect(gitpar.formatRelativeTime(hoursAgo(1), now)).toBe("1 hour ago");
        expect(gitpar.formatRelativeTime(hoursAgo(17), now)).toBe("17 hours ago");
    });

    test("exactly one day is 'yesterday'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(1), now)).toBe("yesterday");
    });

    test("2-6 days as 'N days ago'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(2), now)).toBe("2 days ago");
        expect(gitpar.formatRelativeTime(daysAgo(6), now)).toBe("6 days ago");
    });

    test("exactly one week is 'last week'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(7), now)).toBe("last week");
    });

    test("multiple weeks as 'N weeks ago'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(21), now)).toBe("3 weeks ago");
    });

    test("around a month is 'last month'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(30), now)).toBe("last month");
    });

    test("multiple months as 'N months ago'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(90), now)).toBe("3 months ago");
    });

    test("around a year is 'last year'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(365), now)).toBe("last year");
    });

    test("multiple years as 'N years ago'", () => {
        expect(gitpar.formatRelativeTime(daysAgo(365 * 3), now)).toBe("3 years ago");
    });
});
