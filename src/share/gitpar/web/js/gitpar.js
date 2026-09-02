/*
 * Copyright 2015 Eric ALBER
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict"

var gitpar = gitpar || {};

gitpar.repo = "/";
gitpar.repoPath = null;
gitpar.recentRepos = [];
gitpar.activeRepoId = null;
gitpar.openRepos = [];
gitpar.workspacePath = null;
gitpar.recentWorkspaces = [];
gitpar.workspaceRepos = [];
// Refs for the repository currently open. Declared and cleared together
// because they are refetched together - leaving one behind means drawing
// a repository with another's refs.
gitpar.branches = [];
gitpar.tags = [];
gitpar.stashes = [];
// True once gitpar.stashes actually reflects the open repository, rather
// than being merely absent-of-stashes because nothing has loaded yet. The
// log view needs this distinction to know whether it's safe to trust an
// empty stash list when seeding its walk.
gitpar.branchesLoaded = false;
// Shas of commits no remote holds yet. A set, because every row in the
// log asks whether it is one of these.
gitpar.unpushed = [];
gitpar.unpushedSet = {};

gitpar.setUnpushed = function(shas) {
    gitpar.unpushed = shas || [];
    gitpar.unpushedSet = {};
    for (var i = 0; i < gitpar.unpushed.length; ++i) {
        gitpar.unpushedSet[gitpar.unpushed[i]] = true;
    }
}

gitpar.clearRepoRefs = function() {
    gitpar.branches = [];
    gitpar.tags = [];
    gitpar.stashes = [];
    gitpar.branchesLoaded = false;
    gitpar.setUnpushed([]);
}

gitpar.viewonly = false;
gitpar.historyRef = null;

gitpar.COLORS = ["#ffab1d", "#fd8c25", "#f36e4a", "#fc6148", "#d75ab6", "#b25ade", "#6575ff", "#7b77e9", "#4ea8ec", "#00d0f5", "#4eb94e", "#51af23", "#8b9f1c", "#d0b02f", "#d0853a", "#a4a4a4",
                "#ffc51f", "#fe982c", "#fd7854", "#ff705f", "#e467c3", "#bd65e9", "#7183ff", "#8985f7", "#55b6ff", "#10dcff", "#51cd51", "#5cba2e", "#9eb22f", "#debe3d", "#e19344", "#b8b8b8",
                "#ffd03b", "#ffae38", "#ff8a6a", "#ff7e7e", "#ef72ce", "#c56df1", "#8091ff", "#918dff", "#69caff", "#3ee1ff", "#72da72", "#71cf43", "#abbf3c", "#e6c645", "#eda04e", "#c5c5c5",
                "#ffd84c", "#ffb946", "#ff987c", "#ff8f8f", "#fb7eda", "#ce76fa", "#90a0ff", "#9c98ff", "#74cbff", "#64e7ff", "#7ce47c", "#85e357", "#b8cc49", "#edcd4c", "#f9ad58", "#d0d0d0",
                "#ffe651", "#ffbf51", "#ffa48b", "#ff9d9e", "#ff8de1", "#d583ff", "#97a9ff", "#a7a4ff", "#82d3ff", "#76eaff", "#85ed85", "#8deb5f", "#c2d653", "#f5d862", "#fcb75c", "#d7d7d7",
                "#fff456", "#ffc66d", "#ffb39e", "#ffabad", "#ff9de5", "#da90ff", "#9fb2ff", "#b2afff", "#8ddaff", "#8bedff", "#99f299", "#97f569", "#cde153", "#fbe276", "#ffc160", "#e1e1e1",
                "#fff970", "#ffd587", "#ffc2b2", "#ffb9bd", "#ffa5e7", "#de9cff", "#afbeff", "#bbb8ff", "#9fd4ff", "#9aefff", "#b3f7b3", "#a0fe72", "#dbef6c", "#fcee98", "#ffca69", "#eaeaea",
                "#763700", "#9f241e", "#982c0e", "#a81300", "#80035f", "#650d90", "#082fca", "#3531a3", "#1d4892", "#006f84", "#036b03", "#236600", "#445200", "#544509", "#702408", "#343434",
                "#9a5000", "#b33a20", "#b02f0f", "#c8210a", "#950f74", "#7b23a7", "#263dd4", "#4642b4", "#1d5cac", "#00849c", "#0e760e", "#287800", "#495600", "#6c5809", "#8d3a13", "#4e4e4e",
                "#c36806", "#c85120", "#bf3624", "#df2512", "#aa2288", "#933bbf", "#444cde", "#5753c5", "#1d71c6", "#0099bf", "#188018", "#2e8c00", "#607100", "#907609", "#ab511f", "#686868",
                "#e47b07", "#e36920", "#d34e2a", "#ec3b24", "#ba3d99", "#9d45c9", "#4f5aec", "#615dcf", "#3286cf", "#00abca", "#279227", "#3a980c", "#6c7f00", "#ab8b0a", "#b56427", "#757575",
                "#ff911a", "#fc8120", "#e7623e", "#fa5236", "#ca4da9", "#a74fd3", "#5a68ff", "#6d69db", "#489bd9", "#00bcde", "#36a436", "#47a519", "#798d0a", "#c1a120", "#bf7730", "#8e8e8e"]


// The theme lives on the server, in the same state file as the open
// repos. localStorage was the obvious place and the wrong one: it is
// scoped to an origin, the origin includes the port, and the port moves
// to 8001 whenever 8000 is taken - so choosing dark and reopening the
// app could land on a different origin with an empty store and paint
// light again.
//
// The write is fire-and-forget. A theme that failed to save is worth a
// line in the console, not a dialog over the app.
gitpar.THEME_CHOICES = ["system", "light", "dark"];
// What the user picked, which is not always what is on screen: under
// "system" the desktop decides, and can change while the app is open.
gitpar.themePreference = "light";

gitpar.systemPrefersDark = function() {
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

gitpar.resolveTheme = function(preference) {
    if (preference == "system") {
        return gitpar.systemPrefersDark() ? "dark" : "light";
    }
    return preference == "dark" ? "dark" : "light";
}

gitpar.applyTheme = function(theme, persist) {
    if (gitpar.THEME_CHOICES.indexOf(theme) == -1) {
        theme = "light";
    }
    gitpar.themePreference = theme;
    $("body").toggleClass("dark-mode", gitpar.resolveTheme(theme) == "dark");
    if (persist === false) {
        return;
    }
    $.ajax({
        url: "/api/settings/theme",
        method: "POST",
        // The preference, not what it resolved to today: saving
        // "dark" for a System choice would pin the theme and stop it
        // following the desktop on the next launch.
        data: JSON.stringify({ theme: theme }),
        contentType: "application/json",
    }).fail(function() {
        console.log("Could not save the theme preference.");
    });
}

// Applies what the server reported, without writing it straight back.
// The one exception is a theme left behind in localStorage by a version
// that stored it there: it is carried over once, saved, and cleared, so
// the choice survives the upgrade instead of resetting to light.
// The desktop can change while the app is open - a night-mode schedule,
// a manual switch - and "system" means following it, not sampling it
// once at startup.
gitpar.watchSystemTheme = function() {
    if (!window.matchMedia) {
        return;
    }
    var query = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function() {
        if (gitpar.themePreference == "system") {
            gitpar.applyTheme("system", false);
        }
    };
    if (query.addEventListener) {
        query.addEventListener("change", onChange);
    } else if (query.addListener) {
        query.addListener(onChange);
    }
}

gitpar.adoptTheme = function(serverTheme) {
    var stored = null;
    try {
        stored = localStorage.getItem("theme");
    } catch (error) {
        // Private mode, or storage disabled. Nothing to migrate.
    }
    if (stored && stored != serverTheme) {
        gitpar.applyTheme(stored);
        try {
            localStorage.removeItem("theme");
        } catch (error) {
        }
        return;
    }
    gitpar.applyTheme(serverTheme, false);
    gitpar.watchSystemTheme();
}

// Porcelain status codes for a path git could not merge. Both columns
// carry a letter for these, which is what separates "unmerged" from an
// ordinary staged change - a plain "A" in the index is an added file,
// but "AA" is both sides adding the same path.
gitpar.UNMERGED_STATUS_CODES = ["DD", "AU", "UD", "UA", "DU", "AA", "UU"];

// One entry per path in `git status --porcelain`, with the single
// letter worth showing and whether the path is in conflict. The index
// column wins when it has something to say, so a staged rename reads as
// R rather than as whatever the working tree column happens to hold.
gitpar.parseStatusLines = function(text) {
    var files = [];
    gitpar.splitLines(text || "").forEach(function(line) {
        if (!line || line.length < 4) {
            return;
        }
        var code = line.substr(0, 2);
        var indexStatus = code[0];
        var workTreeStatus = code[1];
        var conflicted = gitpar.UNMERGED_STATUS_CODES.indexOf(code) != -1;
        var status = conflicted ? "U"
                   : (indexStatus != " " && indexStatus != "?" ? indexStatus : workTreeStatus);
        files.push({ path: line.substr(3), status: status, conflicted: conflicted });
    });
    return files;
}

// "3 M", or "2 M 1 U" when the changes are not all of a kind - the
// counts a status column would give, folded into one line.
gitpar.summarizeStatusCounts = function(files) {
    var order = [];
    var counts = {};
    (files || []).forEach(function(file) {
        if (counts[file.status] === undefined) {
            counts[file.status] = 0;
            order.push(file.status);
        }
        ++counts[file.status];
    });
    return order.map(function(status) {
        return { status: status, count: counts[status] };
    });
}

gitpar.showModal = function(title, message, type) {
    var body = $("#error-modal .alert");
    $("#error-modal .modal-title").text(title);
    body.removeClass("alert-danger alert-info");
    body.addClass(type == "info" ? "alert-info" : "alert-danger");
    body.text(message);
    $("#error-modal").modal('show');
}

gitpar.showError = function(message) {
    gitpar.showModal("Error", message, "error");
}

gitpar.showResult = function(title, message) {
    gitpar.showModal(title, message, "info");
}

// A notice floats over the app in the bottom-right and takes itself
// away. It used to be a dismissible block appended to <body>, which is
// a flex column, so it became a layout row: the whole UI shifted down
// and reflowed, and stayed shifted until it was dismissed by hand.
//
// Notices stack rather than replace, so a second one doesn't erase a
// message that hasn't been read yet, and the stack is capped so a
// chatty remote can't fill the window.
gitpar.MAX_NOTICES = 3;
gitpar.NOTICE_TIMEOUT = 7000;

gitpar.showNotice = function(label, message, kind) {
    var messageBox = $("#message-box");
    if (messageBox.length == 0) {
        return;
    }
    var notice = $('<div class="app-notice app-notice-enter" role="status">' +
                       '<div class="app-notice-body">' +
                           '<span class="app-notice-label"></span>' +
                           '<pre class="app-notice-text"></pre>' +
                       '</div>' +
                       '<button type="button" class="app-notice-close" title="Dismiss">&times;</button>' +
                   '</div>');
    notice.toggleClass("app-notice-error", kind == "error");
    $(".app-notice-label", notice).text(label);
    $(".app-notice-text", notice).text(String(message).replace(/\s+$/, ""));

    var timer = null;
    var dismiss = function() {
        window.clearTimeout(timer);
        notice.remove();
    };
    // Hovering holds the notice open - the timeout exists so it goes
    // away on its own, not so it can vanish mid-read.
    var arm = function() {
        window.clearTimeout(timer);
        timer = window.setTimeout(dismiss, gitpar.NOTICE_TIMEOUT);
    };
    $(".app-notice-close", notice).click(dismiss);
    notice.hover(function() { window.clearTimeout(timer); }, arm);
    arm();

    messageBox.append(notice);
    while (messageBox.children().length > gitpar.MAX_NOTICES) {
        messageBox.children().first().remove();
    }
}

gitpar.showWarning = function(message) {
    gitpar.showNotice("Warning", message, "error");
}

gitpar.parseApiError = function(xhr, fallbackMessage) {
    if (xhr.responseJSON && xhr.responseJSON.error) {
        return xhr.responseJSON.error;
    }
    if (xhr.responseText) {
        try {
            var payload = JSON.parse(xhr.responseText);
            if (payload.error) {
                return payload.error;
            }
        } catch (error) {
        }
        return xhr.responseText;
    }
    return fallbackMessage;
}

gitpar.withRepoParam = function(url) {
    if (!gitpar.activeRepoId) {
        return url;
    }
    var separator = url.indexOf("?") == -1 ? "?" : "&";
    return url + separator + "repo=" + encodeURIComponent(gitpar.activeRepoId);
}

gitpar.apiGet = function(url, callback) {
    $.getJSON(gitpar.withRepoParam(url))
    .done(callback)
    .fail(function(xhr) {
        gitpar.showError(gitpar.parseApiError(xhr, "GitPar server not running"));
    });
}

gitpar.apiPost = function(url, payload, callback, errorCallback) {
    $.ajax({
        url: gitpar.withRepoParam(url),
        method: "POST",
        data: JSON.stringify(payload || {}),
        contentType: "application/json",
        dataType: "json"
    })
    .done(callback)
    .fail(function(xhr) {
        if (errorCallback) {
            errorCallback(xhr);
        } else {
            gitpar.showError(gitpar.parseApiError(xhr, "Request failed"));
        }
    });
}

gitpar.escapeHtml = function(text) {
    return $("<div>").text(text || "").html();
}

gitpar.reloadApp = function() {
    document.location.reload();
}

gitpar.reloadWithPostAction = function(viewName) {
    if (viewName) {
        sessionStorage.setItem("gitpar-post-action", viewName);
    }
    gitpar.reloadApp();
}

// Applies a /api/repos/{select,open,clone,create} response (a full repo
// context payload) without a full page reload, so opening a repo while
// others are already open just adds/focuses a tab. The one exception is
// going from zero open repos to the first one: the view instances
// (historyView, workspaceView, ...) don't exist yet in that case, so a
// full bootstrap (page reload) is simplest and only happens once per
// session.
gitpar.applyOpenedRepoContext = function(mainView, context) {
    gitpar.recentRepos = context.recent_repos || gitpar.recentRepos;
    gitpar.openRepos = context.open_repos || [];
    if (!mainView.historyView) {
        gitpar.reloadApp();
        return;
    }
    mainView.repoChrome.switchActiveRepo(context.repo_id);
}

gitpar.setFlashMessage = function(title, message, type) {
    sessionStorage.setItem("gitpar-flash", JSON.stringify({
        title: title,
        message: message,
        type: type || "info"
    }));
}

gitpar.consumeFlashMessage = function() {
    var payload = sessionStorage.getItem("gitpar-flash");
    if (!payload) {
        return null;
    }
    sessionStorage.removeItem("gitpar-flash");
    try {
        return JSON.parse(payload);
    } catch (error) {
        return null;
    }
}

gitpar.formatRepoCounts = function(repo) {
    var parts = [];
    if (repo.staged_count > 0) {
        parts.push(repo.staged_count + " staged");
    }
    if (repo.changed_count > 0) {
        parts.push(repo.changed_count + " changed");
    }
    if (repo.untracked_count > 0) {
        parts.push(repo.untracked_count + " untracked");
    }
    if (parts.length == 0) {
        return "Clean working tree";
    }
    return parts.join(" • ");
}

gitpar.formatRepoTracking = function(repo) {
    var parts = [];
    if (repo.ahead > 0) {
        parts.push("ahead " + repo.ahead);
    }
    if (repo.behind > 0) {
        parts.push("behind " + repo.behind);
    }
    if (parts.length == 0) {
        return "in sync";
    }
    return parts.join(" • ");
}

gitpar.formatBranchTracking = function(branch) {
    var parts = [];
    if (branch.upstream) {
        parts.push(branch.upstream);
    }
    if (branch.ahead > 0) {
        parts.push("ahead " + branch.ahead);
    }
    if (branch.behind > 0) {
        parts.push("behind " + branch.behind);
    }
    if (parts.length == 0) {
        parts.push(branch.status);
    }
    return parts.join(" • ");
}

gitpar.shortRefName = function(refName) {
    if (!refName) {
        return "";
    }
    if (refName.indexOf("refs/heads/") == 0) {
        return refName.substr(11);
    }
    if (refName.indexOf("refs/remotes/") == 0) {
        return refName.substr(13);
    }
    if (refName.indexOf("refs/tags/") == 0) {
        return refName.substr(10);
    }
    return refName;
}

gitpar.parseDecoratedRefs = function(refs, commitHash) {
    var items = [];
    var seen = {};

    function pushRef(kind, fullName, displayName, gitRef) {
        var key = [kind, fullName, displayName].join("::");
        if (seen[key]) {
            return;
        }
        seen[key] = true;
        items.push({
            kind: kind,
            fullName: fullName,
            displayName: displayName,
            gitRef: gitRef || gitpar.shortRefName(fullName),
            commit: commitHash,
        });
    }

    (refs || []).forEach(function(ref) {
        if (!ref) {
            return;
        }
        if (ref.indexOf("HEAD -> ") == 0) {
            pushRef("head", "HEAD", "HEAD", "HEAD");
            ref = ref.substr(8);
        }
        if (ref == "HEAD") {
            pushRef("head", "HEAD", "HEAD", "HEAD");
        } else if (ref.indexOf("refs/heads/") == 0) {
            pushRef("local", ref, gitpar.shortRefName(ref), gitpar.shortRefName(ref));
        } else if (ref.indexOf("refs/remotes/") == 0) {
            pushRef("remote", ref, gitpar.shortRefName(ref), gitpar.shortRefName(ref));
        } else if (ref.indexOf("tag: refs/tags/") == 0) {
            var fullTag = ref.substr(5);
            pushRef("tag", fullTag, gitpar.shortRefName(fullTag), gitpar.shortRefName(fullTag));
        } else if (ref.indexOf("refs/tags/") == 0) {
            pushRef("tag", ref, gitpar.shortRefName(ref), gitpar.shortRefName(ref));
        } else {
            pushRef("other", ref, gitpar.shortRefName(ref), ref);
        }
    });

    return items;
}

gitpar.getInitials = function(name) {
    if (!name) {
        return "?";
    }
    var parts = name.trim().split(/\s+/).filter(function(part) { return part.length > 0; });
    if (parts.length == 0) {
        return "?";
    }
    if (parts.length == 1) {
        return parts[0].substr(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

gitpar.hashString = function(str) {
    var hash = 0;
    for (var i = 0; i < str.length; ++i) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

// Keyed on the whole identity, not the name. Two people can share a
// name, and one person's work can arrive under several addresses; in
// both cases the colour is meant to tell them apart, so the address is
// part of what it hashes. The separator is a character git won't let
// into either field, so "ab" + "c" can't collide with "a" + "bc".
gitpar.colorForAuthor = function(name, email) {
    var identity = (name || "") + "\n" + (email || "");
    if (identity == "\n") {
        return gitpar.COLORS[0];
    }
    return gitpar.COLORS[gitpar.hashString(identity) % gitpar.COLORS.length];
}

// The absolute date shown on an expanded commit: weekday, short month,
// and the time to the minute. Seconds are noise at this size, and the
// weekday is what makes a date read as a moment rather than a serial
// number. Falls back to the locale default if Intl rejects the options.
gitpar.formatCommitDate = function(date) {
    if (!date) {
        return "";
    }
    try {
        return date.toLocaleString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch (error) {
        return date.toLocaleString();
    }
}

// Turns git's own stash subject into a compact label.
// Auto-created stashes read "WIP on <branch>: <sha> <subject>", which is
// mostly noise once the row is marked as a stash; an explicit
// `git stash push -m` reads "On <branch>: <message>" and that message is
// worth keeping. Anything unrecognised is passed through.
gitpar.formatStashSubject = function(message) {
    if (!message) {
        return "Stash";
    }
    var wip = /^WIP on ([^:]+):/.exec(message);
    if (wip) {
        return "Stash on " + wip[1];
    }
    var named = /^On ([^:]+):\s*(.*)$/.exec(message);
    if (named) {
        return named[2] ? "Stash on " + named[1] + ": " + named[2]
                        : "Stash on " + named[1];
    }
    return message;
}

// Expands branch entries and tags into individual refs, each keyed by
// the commit it actually points at, then groups them per commit.
//
// A tracking branch arrives as one entry holding both a local and a
// remote name. Those are two distinct refs and sit on different commits
// whenever the branch is ahead or behind, so they are emitted
// separately and only end up sharing a row when they really are level.
// Local branches sort ahead of remotes, and tags last.
gitpar.groupRefsByCommit = function(branches, tags) {
    var order = { local: 0, remote: 1, tag: 2 };
    var groups = [];
    var byCommit = {};

    var add = function(commit, refInfo) {
        if (!commit) {
            return;
        }
        var group = byCommit[commit];
        if (!group) {
            group = { commit: commit, refs: [] };
            byCommit[commit] = group;
            groups.push(group);
        }
        group.refs.push(refInfo);
    };

    (branches || []).forEach(function(branch) {
        if (branch.local_name) {
            add(branch.commit, {
                kind: "local",
                fullName: "refs/heads/" + branch.local_name,
                displayName: branch.local_name,
                gitRef: branch.local_name,
                commit: branch.commit,
                current: !!branch.current,
            });
        }
        if (branch.remote_name) {
            var remoteCommit = branch.remote_commit || (branch.local_name ? null : branch.commit);
            add(remoteCommit, {
                kind: "remote",
                fullName: "refs/remotes/" + branch.remote_name,
                displayName: branch.remote_name,
                gitRef: branch.remote_name,
                commit: remoteCommit,
                current: false,
            });
        }
    });

    (tags || []).forEach(function(tag) {
        add(tag.commit, {
            kind: "tag",
            fullName: "refs/tags/" + tag.name,
            displayName: tag.name,
            gitRef: tag.name,
            commit: tag.commit,
            annotated: !!tag.annotated,
            current: false,
        });
    });

    groups.forEach(function(group) {
        group.refs.sort(function(a, b) {
            if (a.current != b.current) {
                return a.current ? -1 : 1;
            }
            if (order[a.kind] != order[b.kind]) {
                return order[a.kind] - order[b.kind];
            }
            return a.displayName.localeCompare(b.displayName);
        });
    });
    return groups;
}

// Reads the starting line numbers out of a hunk header, e.g.
// "@@ -1190,7 +1190,6 @@ body {" -> { oldStart: 1190, newStart: 1190 }.
// The counts are deliberately ignored: the gutters number lines as they
// are emitted, so only the starting points matter. Returns null for
// anything that isn't a hunk header.
gitpar.parseHunkHeader = function(line) {
    if (!line) {
        return null;
    }
    var match = /^@@+ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (!match) {
        return null;
    }
    return { oldStart: parseInt(match[1], 10), newStart: parseInt(match[2], 10) };
}

// Quotes a value for the git command strings sent to the backend, which
// parses them with shlex. Only " and \ need escaping: shlex isn't a
// shell, so $ and backticks inside double quotes are already literal.
gitpar.quoteArg = function(value) {
    return '"' + String(value).replace(/([\\"])/g, "\\$1") + '"';
}

// A plain `push` on a branch with no upstream fails outright, and git's
// own stderr already names the exact fix - it has worked out the right
// remote for this branch itself, accounting for multiple remotes,
// remote.pushDefault and the like, which is not worth re-deriving
// independently. Recognising that specific message is what turns it
// from raw stderr in the generic error banner into a plain question:
// publish this branch there? Returns null for any other failure, so a
// push failing for some other reason still shows as a normal error.
gitpar.NO_UPSTREAM_PATTERN = /git push --set-upstream (\S+) (\S+)/;

gitpar.parseNoUpstreamError = function(message) {
    var match = gitpar.NO_UPSTREAM_PATTERN.exec(String(message || ""));
    return match ? { remote: match[1], branch: match[2] } : null;
}

// "origin" if it's one of the configured remotes, otherwise whichever
// remote sorts first - a plain default for the common case, so the
// prompt that asks which remote to publish to starts on a reasonable
// answer instead of an arbitrary one.
gitpar.defaultRemoteName = function(remotes) {
    var names = (remotes || []).map(function(remote) { return remote.name; });
    if (names.indexOf("origin") != -1) {
        return "origin";
    }
    return names.slice().sort()[0] || "";
}

// Matches what was typed against the repo's actual remotes, tolerating
// surrounding whitespace but nothing fuzzier than that - a mistyped
// remote name should be caught, not silently coerced into whichever
// one happens to look close.
gitpar.matchRemoteName = function(remotes, typed) {
    if (!typed) {
        return null;
    }
    var trimmed = typed.trim();
    var match = (remotes || []).filter(function(remote) {
        return remote.name == trimmed;
    })[0];
    return match ? match.name : null;
}

// `git branch -d` refuses to delete anything that isn't a strict
// ancestor of HEAD (or the branch's own upstream) - which is the right
// default, but it also fires on a branch that was genuinely finished
// and squash- or rebase-merged, since neither operation leaves the
// original commits reachable the way an ordinary merge does. git's own
// message already names the fix (-D); this only recognises that it
// said so, the same way parseNoUpstreamError recognises push's.
gitpar.NOT_FULLY_MERGED_PATTERN = /is not fully merged/;

gitpar.isBranchNotFullyMergedError = function(message) {
    return gitpar.NOT_FULLY_MERGED_PATTERN.test(String(message || ""));
}

// A remote needing credentials git doesn't have would otherwise hang the
// request forever - the backend's GIT_TERMINAL_PROMPT=0 turns that into
// this specific, fast failure instead. Recognising it is what turns a raw
// "terminal prompts disabled" stderr line into a "set up credentials for
// this remote" prompt, the same way parseNoUpstreamError recognises
// push's message.
gitpar.CREDENTIALS_NEEDED_PATTERN = /could not read (Username|Password) for '([^']*)': terminal prompts disabled/;

gitpar.parseCredentialsNeededError = function(message) {
    var match = gitpar.CREDENTIALS_NEEDED_PATTERN.exec(String(message || ""));
    return match ? { field: match[1], url: match[2] } : null;
}

// Parses `git diff-tree --name-status` output into {status, path} pairs.
// Fields are tab-separated; renames and copies carry a similarity score
// on the status (R100) and a second path, which is the one to show.
gitpar.parseNameStatus = function(data) {
    if (!data) {
        return [];
    }
    var files = [];
    gitpar.splitLines(data).forEach(function(line) {
        var parts = line.split("\t");
        if (parts.length < 2 || !parts[0]) {
            return;
        }
        var status = parts[0].charAt(0);
        var path = parts[parts.length - 1];
        if (!path) {
            return;
        }
        files.push({ status: status, path: path });
    });
    return files;
}

gitpar.formatRelativeTime = function(date, now) {
    var reference = now || new Date();
    var seconds = Math.round((reference.getTime() - date.getTime()) / 1000);
    if (seconds < 60) {
        return "just now";
    }
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return minutes + " minute" + (minutes == 1 ? "" : "s") + " ago";
    }
    var hours = Math.round(minutes / 60);
    if (hours < 24) {
        return hours + " hour" + (hours == 1 ? "" : "s") + " ago";
    }
    var days = Math.round(hours / 24);
    if (days == 1) {
        return "yesterday";
    }
    if (days < 7) {
        return days + " days ago";
    }
    var weeks = Math.round(days / 7);
    if (weeks == 1) {
        return "last week";
    }
    if (weeks < 4) {
        return weeks + " weeks ago";
    }
    var months = Math.round(days / 30);
    if (months <= 1) {
        return "last month";
    }
    if (months < 12) {
        return months + " months ago";
    }
    var years = Math.round(days / 365);
    if (years == 1) {
        return "last year";
    }
    return years + " years ago";
}

gitpar.historyAuthorFilter = null;

gitpar.refChipFilterName = null;

gitpar.setRefChipFilter = function(displayName) {
    gitpar.refChipFilterName = displayName || null;
    $(".log-entry-ref").each(function() {
        var name = $(this).attr("data-ref-name");
        $(this).toggle(!gitpar.refChipFilterName || name == gitpar.refChipFilterName);
    });
}

gitpar.getCurrentBranch = function() {
    return gitpar.branches.filter(function(branch) {
        return branch.current;
    })[0] || null;
}

gitpar.findBranchByRef = function(refInfo) {
    if (!refInfo) {
        return null;
    }
    if (refInfo.kind == "head") {
        return gitpar.getCurrentBranch();
    }
    return gitpar.branches.filter(function(branch) {
        if (refInfo.kind == "local") {
            return branch.local_name == refInfo.gitRef;
        }
        if (refInfo.kind == "remote") {
            return branch.remote_name == refInfo.gitRef;
        }
        return false;
    })[0] || null;
}

// A sibling directory named after the branch, offered as a starting
// point rather than left blank - one thing to confirm instead of one
// to compose from nothing. Slashes and spaces in the branch name are
// flattened to hyphens: a literal slash would nest the new worktree
// inside an unrelated directory of that name rather than beside the
// repo, which is never what "feature/x" as a suggested path means.
gitpar.suggestWorktreePath = function(repoPath, branchName) {
    if (!repoPath || !branchName) {
        return "";
    }
    var trimmed = repoPath.replace(/\/+$/, "");
    var lastSlash = trimmed.lastIndexOf("/");
    // parent can legitimately be "" for a repo at the filesystem root
    // ("/repo" -> parent ""), which is different from there being no
    // slash at all (a bare relative name, with no parent to rejoin) -
    // hence branching on whether a slash was found, not on parent being
    // truthy.
    var parent = lastSlash >= 0 ? trimmed.substring(0, lastSlash) : "";
    var repoName = lastSlash >= 0 ? trimmed.substring(lastSlash + 1) : trimmed;
    var safeBranch = branchName.trim().replace(/[\/\s]+/g, "-");
    if (!repoName || !safeBranch) {
        return "";
    }
    return (lastSlash >= 0 ? parent + "/" : "") + repoName + "-" + safeBranch;
}

gitpar.copyToClipboard = function(text, label) {
    if (!text) {
        return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
        .then(function() {
            gitpar.showResult("Copied", (label || "Value") + " copied to clipboard.");
        })
        .catch(function() {
            gitpar.showResult("Copy", text);
        });
    } else {
        gitpar.showResult("Copy", text);
    }
}

gitpar.git = function(cmd, arg1, arg2, arg3) {
    // cmd = git command line arguments
    // other arguments = optional stdin content, a callback function, and an
    // optional error callback:
    // ex:
    // git("log", mycallback)
    // git("log", mycallback, myErrorCallback)
    // git("commit -F -", "my commit message", mycallback)
    if (typeof(arg1) == "function") {
        var callback = arg1;
        var onError = arg2;
    } else {
        // Convention : first line = git arguments, rest = process stdin
        cmd += "\n" + arg1;
        var callback = arg2;
        var onError = arg3;
    }
    return $.post(gitpar.withRepoParam("git"), cmd, function(data, status, xhr) {
        if (xhr.status == 200) {
            // Convention : last lines are footer meta data like headers. An empty line marks the start if the footers
            var footers = {};
            var fIndex = data.length;
            while (true) {
                var oldFIndex = fIndex;
                var fIndex = data.lastIndexOf("\r\n", fIndex - 1);
                var line = data.substring(fIndex + 2, oldFIndex);
                if (line.length > 0) {
                    var footer = line.split(": ");
                    footers[footer[0]] = footer[1];
                } else {
                    break;
                }
            }

            var messageStartIndex = fIndex - parseInt(footers["Git-Stderr-Length"]);
            var message = data.substring(messageStartIndex, fIndex);
            var output = data.substring(0, messageStartIndex);
            var rcode = parseInt(footers["Git-Return-Code"]);
            if (rcode == 0) {
                if (callback) {
                    callback(output);
                }
                // Return code 0 with stderr output. This is not a
                // failure - git reports normal progress on stderr, so
                // an ordinary fetch or push lands here every time. It
                // is shown as what it is, the command's own output,
                // labelled with the command that produced it.
                if (message.length > 0) {
                    console.log(message);
                    gitpar.showNotice("git " + String(cmd).split(/\s+/)[0], message);
                }
            } else {
                console.log(message);
                // An error callback that returns true has handled the
                // failure itself (e.g. retried), so the generic banner
                // is skipped.
                if (onError && onError(message) === true) {
                    return;
                }
                gitpar.showError(message);
            }
        } else {
            console.log(data);
            gitpar.showError(data);
        }
    }, "text")
    .fail(function(xhr, status, error) {
        gitpar.showError("GitPar server not running");
    });
};

gitpar.detachChildren = function(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

gitpar.splitLines = function(data) {
    return data.split("\n").filter(function(s) { return s.length > 0; });
};

gitpar.getNodeIndex = function(element) {
    var index = 0;
    while (element.previousElementSibling) {
        element = element.previousElementSibling;
        ++index;
    }
    return index;
}

gitpar.RepoPicker = function(mainView) {

    var self = this;
    self.mode = "repo";

    self.getPickerTitle = function() {
        return self.mode == "workspace" ? "Select Folder Of Repositories" : "Select Git Repository";
    }

    self.selectWorkspace = function(path) {
        gitpar.apiPost("/api/workspaces/select", {path: path}, gitpar.reloadApp);
    }

    self.selectRepo = function(path) {
        gitpar.apiPost("/api/repos/select", {path: path}, function(context) {
            gitpar.applyOpenedRepoContext(mainView, context);
        });
    }

    self.openCurrentPath = function() {
        var value = $(".repo-picker-path", self.element).val();
        if (value.length == 0) {
            return;
        }
        if (self.mode == "workspace") {
            self.selectWorkspace(value);
        } else {
            self.selectRepo(value);
        }
    }

    self.openNative = function(path, mode) {
        self.mode = mode || self.mode || "repo";
        gitpar.apiPost("/api/fs/pick-directory", {
            path: path || gitpar.repoPath || null,
            title: self.getPickerTitle(),
        }, function(data) {
            if (data.unsupported) {
                gitpar.showWarning((data.error || "Native folder picker unavailable.") + " Falling back to the built-in browser.");
                self.open(path, self.mode);
                return;
            }
            if (data.cancelled) {
                return;
            }
            if (self.mode == "workspace") {
                self.selectWorkspace(data.path);
            } else {
                self.selectRepo(data.path);
            }
        }, function(xhr) {
            gitpar.showWarning(gitpar.parseApiError(xhr, "Native folder picker unavailable.") + " Falling back to the built-in browser.");
            self.open(path, self.mode);
        });
    }

    self.loadPath = function(path) {
        var requestPath = path ? "?path=" + encodeURIComponent(path) : "";
        gitpar.apiGet("/api/fs/list" + requestPath, function(data) {
            self.currentPath = data.path;
            self.parentPath = data.parent_path;
            self.updateChrome();
            self.renderDirectory(data);
        });
    }

    self.goUp = function() {
        if (self.parentPath) {
            self.loadPath(self.parentPath);
        }
    }

    self.goHome = function() {
        self.loadPath(null);
    }

    self.submitPath = function() {
        var value = $(".repo-picker-path", self.element).val();
        if (value.length > 0) {
            self.loadPath(value);
        }
    }

    self.updateChrome = function() {
        var isWorkspaceMode = self.mode == "workspace";
        $(".repo-picker-eyebrow", self.element).text(isWorkspaceMode ? "Workspace Control" : "Repository Control");
        $(".repo-picker-title", self.element).text(isWorkspaceMode ? "Open Folder Of Repositories" : "Browse Local Repositories");
        $(".repo-picker-open-current", self.element).text(isWorkspaceMode ? "Open Folder" : "Open Repo");
        $(".repo-picker-hint", self.element).text(
            isWorkspaceMode
                ? "Choose a parent directory and GitPar will surface each repo as a workspace rail."
                : "Choose a single git repo or drill into a repo folder from the local filesystem."
        );
    }

    self.renderDirectory = function(data) {
        var pathInput = $(".repo-picker-path", self.element);
        pathInput.val(data.path);

        var list = $(".repo-picker-list", self.element);
        list.empty();
        if (data.entries.length == 0) {
            $('<div class="repo-picker-empty">No subdirectories in this location.</div>').appendTo(list);
            return;
        }

        data.entries.forEach(function(entry) {
            var badge = entry.is_repo ? '<span class="repo-picker-badge">repo</span>' : '';
            var row = $( '<div class="repo-picker-row">' +
                            '<button type="button" class="btn btn-link repo-picker-entry"></button>' +
                            '<div class="repo-picker-actions">' +
                                badge +
                                '<button type="button" class="btn btn-default btn-xs repo-picker-browse">Browse</button>' +
                            '</div>' +
                        '</div>');
            $(".repo-picker-entry", row).text(entry.name);
            $(".repo-picker-entry", row).attr("title", entry.path);
            $(".repo-picker-entry", row).click(function() {
                self.loadPath(entry.path);
            });
            $(".repo-picker-browse", row).click(function() {
                self.loadPath(entry.path);
            });
            if (self.mode == "workspace") {
                $('<button type="button" class="btn btn-primary btn-xs repo-picker-open">Open Folder</button>')
                    .appendTo($(".repo-picker-actions", row))
                    .click(function() {
                        self.selectWorkspace(entry.path);
                    });
            } else if (entry.is_repo) {
                $('<button type="button" class="btn btn-primary btn-xs repo-picker-open">Open Repo</button>')
                    .appendTo($(".repo-picker-actions", row))
                    .click(function() {
                        self.selectRepo(entry.path);
                    });
            }
            list.append(row);
        });
    }

    self.open = function(path, mode) {
        self.mode = mode || "repo";
        self.updateChrome();
        self.loadPath(path || gitpar.repoPath || null);
        $(self.element).modal("show");
    }

    self.element = $(   '<div class="modal fade" id="repo-picker-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog modal-lg" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Repository Control</div>' +
                                        '<h4 class="modal-title repo-picker-title">Browse Local Repositories</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<p class="repo-picker-hint"></p>' +
                                        '<div class="repo-picker-toolbar">' +
                                            '<input type="text" class="form-control repo-picker-path" placeholder="Enter a path">' +
                                            '<div class="btn-group">' +
                                                '<button type="button" class="btn btn-default repo-picker-home">Home</button>' +
                                                '<button type="button" class="btn btn-default repo-picker-up">Up</button>' +
                                                '<button type="button" class="btn btn-primary repo-picker-go">Go</button>' +
                                                '<button type="button" class="btn btn-success repo-picker-open-current">Open Repo</button>' +
                                            '</div>' +
                                        '</div>' +
                                        '<div class="repo-picker-list"></div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];

    $(".repo-picker-home", self.element).click(self.goHome);
    $(".repo-picker-up", self.element).click(self.goUp);
    $(".repo-picker-go", self.element).click(self.submitPath);
    $(".repo-picker-open-current", self.element).click(self.openCurrentPath);
    $(".repo-picker-path", self.element).keypress(function(event) {
        if (event.which == 13) {
            self.submitPath();
        }
    });
};

// Pull strategy and auto-fetch, on the same footing as the theme: kept
// on the server rather than in localStorage, for the same reason - the
// port moves whenever the one below it is taken, localStorage is keyed
// by origin, and two windows on different ports used to quietly hold
// different settings.
gitpar.PULL_STRATEGIES = ["ff", "rebase"];
gitpar.pullStrategy = "ff";
gitpar.autoFetchEnabled = false;

gitpar.applyPullStrategy = function(strategy, persist) {
    if (gitpar.PULL_STRATEGIES.indexOf(strategy) == -1) {
        strategy = "ff";
    }
    gitpar.pullStrategy = strategy;
    if (persist === false) {
        return;
    }
    $.ajax({
        url: "/api/settings/pull-strategy",
        method: "POST",
        data: JSON.stringify({ strategy: strategy }),
        contentType: "application/json",
    }).fail(function() {
        console.log("Could not save the pull strategy.");
    });
}

// Named applyAutoFetchPreference, not applyAutoFetch - gitpar.Toolbar
// already has an instance method of that name which starts or stops the
// fetch timer. This one only records the preference and persists it;
// the toolbar re-reads gitpar.autoFetchEnabled to act on it.
gitpar.applyAutoFetchPreference = function(enabled, persist) {
    gitpar.autoFetchEnabled = !!enabled;
    if (persist === false) {
        return;
    }
    $.ajax({
        url: "/api/settings/auto-fetch",
        method: "POST",
        data: JSON.stringify({ enabled: gitpar.autoFetchEnabled }),
        contentType: "application/json",
    }).fail(function() {
        console.log("Could not save the auto-fetch preference.");
    });
}

// Adopts what the server reported, migrating a value left behind in
// localStorage by a version that stored it there - carried over once,
// saved through the new endpoint, and cleared.
gitpar.adoptPullStrategy = function(serverStrategy) {
    var stored = null;
    try {
        stored = localStorage.getItem("gitpar-pull-strategy");
    } catch (error) {
    }
    if (stored && stored != serverStrategy) {
        gitpar.applyPullStrategy(stored);
    } else {
        gitpar.applyPullStrategy(serverStrategy, false);
    }
    try {
        localStorage.removeItem("gitpar-pull-strategy");
    } catch (error) {
    }
}

gitpar.adoptAutoFetchPreference = function(serverEnabled) {
    var stored = null;
    try {
        stored = localStorage.getItem("gitpar-auto-fetch");
    } catch (error) {
    }
    if (stored !== null) {
        gitpar.applyAutoFetchPreference(stored == "1");
    } else {
        gitpar.applyAutoFetchPreference(serverEnabled, false);
    }
    try {
        localStorage.removeItem("gitpar-auto-fetch");
    } catch (error) {
    }
}

gitpar.Toolbar = function(mainView) {

    var self = this;
    self.expandedDrawer = null;
    self.openMenuName = null;

    // -- data / branch helpers (unchanged behavior from the former RepoChrome) --

    self.currentBranch = function() {
        for (var i = 0; i < gitpar.branches.length; ++i) {
            if (gitpar.branches[i].current) {
                return gitpar.branches[i];
            }
        }
        return null;
    }

    self.branchSummary = function() {
        var current = self.currentBranch();
        if (!current) {
            return "No branch selected";
        }
        return current.display_name || current.local_name || current.remote_name || "Detached";
    }

    self.loadBranches = function(callback) {
        if (!gitpar.repoPath) {
            gitpar.clearRepoRefs();
            self.updateStatusMeta();
            if (callback) {
                callback();
            }
            return;
        }
        gitpar.apiGet("/api/branches", function(data) {
            gitpar.branches = data.branches || [];
            gitpar.tags = data.tags || [];
            gitpar.stashes = data.stashes || [];
            gitpar.branchesLoaded = true;
            gitpar.setUnpushed(data.unpushed);
            self.updateStatusMeta();
            if (mainView.historyView) {
                mainView.historyView.refreshToolbar();
                // The log's first render can land before this fetch
                // resolves, in which case it walked --all without knowing
                // about any stashes and drew their raw internal commits
                // instead of a single collapsed stash row. Now that the
                // real stash list is in, redraw it once to pick that up.
                var logView = mainView.historyView.logView;
                if (logView && logView.stashSeedPending) {
                    logView.update(gitpar.historyRef);
                }
            }
            if (callback) {
                callback();
            }
        });
    }

    self.updateStatusMeta = function() {
        $(".toolbar-repo-value", self.element).text(gitpar.repo || "No Repository");
        $(".toolbar-branch-value", self.element).text(self.branchSummary());
        $(".app-titlebar-path", self.element).text("GitPar" + (gitpar.repoPath ? " - " + gitpar.repoPath : ""));
        $("title")[0].textContent = gitpar.repoPath ? "Git - " + gitpar.repo : "GitPar";
        var current = self.currentBranch();
        // Commits waiting to go out. Behind/ahead come from the
        // upstream's tracking info; with no upstream there is none, so
        // the push count falls back to everything no remote holds -
        // which is what Publish would send.
        self.setBadge("#toolbar-pull-badge", current && current.behind);
        self.setBadge("#toolbar-push-badge",
                      current && current.upstream ? current.ahead : gitpar.unpushed.length);

        // A branch with no upstream has nothing to pull from, and its
        // push is the one that creates the remote branch - so the
        // button says what it will do, and Pull is disabled rather
        // than left to fail with "no tracking information".
        var tracked = !!(current && current.upstream);
        $("#toolbar-push span:not(.toolbar-remote-btn-icon):not(.toolbar-remote-btn-badge)", self.element)
            .text(tracked ? "Push" : "Publish");
        $("#toolbar-pull", self.element)
            .prop("disabled", !tracked)
            .attr("title", tracked ? "Left-click to pull, right-click for options"
                                   : "Nothing to pull: this branch has no upstream");
    }

    self.setBadge = function(selector, count) {
        var badge = $(selector, self.element);
        if (count > 0) {
            badge.text(count > 99 ? "99+" : count).show();
        } else {
            badge.hide();
        }
    }

    // The tab names the state the repo is actually in. A stopped merge
    // is not a list of changes to review and commit - it is a set of
    // decisions blocking everything else - so it says so, and counts
    // the files still waiting rather than every changed file.
    self.setChangesBadge = function(count, conflictCount) {
        var conflicted = conflictCount > 0;
        $(".toolbar-tab[data-section='workspace'] .toolbar-tab-text", self.element)
            .text(conflicted ? "Conflicts" : "Changes");
        $(".toolbar-tab[data-section='workspace']", self.element)
            .toggleClass("toolbar-tab-conflicted", conflicted);
        self.setBadge("#toolbar-changes-badge", conflicted ? conflictCount : count);
    }

    self.openPicker = function() {
        mainView.repoPicker.openNative(gitpar.repoPath, "repo");
    }

    self.openWorkspacePicker = function() {
        mainView.repoPicker.openNative(gitpar.workspacePath || gitpar.repoPath, "workspace");
    }

    self.selectRecentRepo = function(event) {
        var path = event.currentTarget.getAttribute("data-path");
        if (path) {
            mainView.repoPicker.selectRepo(path);
        }
    }

    self.focusHistoryRef = function(refName) {
        gitpar.historyRef = refName || null;
        self.activateSection("history");
        if (mainView.historyView) {
            mainView.historyView.update(gitpar.historyRef);
        }
    }

    self.compareRef = function(sourceRef) {
        var current = self.currentBranch();
        var targetRef = current && current.local_name ? current.local_name : null;
        gitpar.apiPost("/api/branches/compare", {
            source_ref: sourceRef,
            target_ref: targetRef,
        }, function(data) {
            $(".branch-compare-title", self.compareModal).text(data.source_ref + " compared to " + data.target_ref);
            $(".branch-compare-summary", self.compareModal).text(data.summary || "No diff summary available.");
            $(".branch-compare-diff", self.compareModal).text(data.diff || "No diff output.");
            $(self.compareModal).modal("show");
        });
    }

    self.checkoutRef = function(localName, remoteName) {
        gitpar.apiPost("/api/branches/checkout", {
            local_name: localName || null,
            remote_name: remoteName || null,
        }, gitpar.reloadApp);
    }

    self.mergeRef = function(sourceRef, squash) {
        var current = self.currentBranch();
        var targetRef = current && current.local_name ? current.local_name : null;
        if (!sourceRef || !targetRef) {
            return;
        }
        var actionLabel = squash ? "Squash merge" : "Merge";
        if (!window.confirm(actionLabel + " '" + sourceRef + "' into '" + targetRef + "'?")) {
            return;
        }
        gitpar.apiPost(squash ? "/api/branches/squash-merge" : "/api/branches/merge", {
            source_ref: sourceRef,
            target_ref: targetRef,
        }, function(data) {
            gitpar.setFlashMessage(
                actionLabel + " completed",
                data.message || ((squash ? "Squashed " : "Merged ") + sourceRef + " into " + targetRef),
                "info"
            );
            gitpar.reloadWithPostAction(squash ? "workspace" : "history");
        }, function(xhr) {
            gitpar.setFlashMessage(
                actionLabel + " needs attention",
                gitpar.parseApiError(xhr, actionLabel + " failed"),
                "error"
            );
            gitpar.reloadWithPostAction("workspace");
        });
    }

    self.removeBranch = function(localName) {
        if (!localName) {
            return;
        }
        if (!window.confirm("Delete branch '" + localName + "'?")) {
            return;
        }
        self.deleteBranch(localName, false);
    }

    self.deleteBranch = function(localName, force) {
        gitpar.apiPost("/api/branches/delete", {local_name: localName, force: !!force}, gitpar.reloadApp, function(xhr) {
            var message = gitpar.parseApiError(xhr, "Unable to delete branch");
            // A first, safe attempt (force is still false here - a
            // retry never asks a second time) that failed only because
            // the branch isn't a strict ancestor is offered a retry with
            // -D; every other failure - a branch checked out elsewhere,
            // one that's genuinely unmerged, anything else - still shows
            // as a normal error instead.
            if (!force && gitpar.isBranchNotFullyMergedError(message)) {
                if (window.confirm(
                    "'" + localName + "' is not fully merged into its usual ancestry - normal " +
                    "after a squash or rebase merge, since neither leaves the original commits " +
                    "reachable the way an ordinary merge does. Delete it anyway?"
                )) {
                    self.deleteBranch(localName, true);
                }
                return;
            }
            gitpar.showError(message);
        });
    }

    self.removeRemoteBranch = function(remoteName) {
        if (!remoteName) {
            return;
        }
        if (!window.confirm("Delete '" + remoteName + "' from the remote? This cannot be undone.")) {
            return;
        }
        gitpar.apiPost("/api/branches/delete-remote", {remote_name: remoteName}, gitpar.reloadApp);
    }

    self.createBranchAtRef = function(startPoint, suggestedName) {
        var branchName = window.prompt("New branch name", suggestedName || "");
        if (!branchName) {
            return;
        }
        // Which remote to publish to is only ever ambiguous with more
        // than one configured - a single remote (or none) is exactly
        // what git itself would use, so there's nothing to ask and the
        // branch is created the same way it always was. This is also
        // why the remote list is fetched here rather than kept cached
        // anywhere: it's read once, right before the one prompt that
        // needs it, rather than a piece of state to keep in sync.
        gitpar.apiGet("/api/remotes", function(data) {
            var remotes = data.remotes || [];
            if (remotes.length < 2) {
                self.createBranchWithRemote(branchName, startPoint, null);
                return;
            }
            var names = remotes.map(function(remote) { return remote.name; });
            var typed = window.prompt(
                "Push '" + branchName + "' to which remote? (" + names.join(", ") + ")\n" +
                "Leave blank to create it locally only.",
                gitpar.defaultRemoteName(remotes)
            );
            if (!typed || !typed.trim()) {
                self.createBranchWithRemote(branchName, startPoint, null);
                return;
            }
            var remote = gitpar.matchRemoteName(remotes, typed);
            if (!remote) {
                // createBranchWithRemote ends in a full page reload
                // (checkout switched branches, which the rest of the
                // app needs to pick up) - a showError here would be
                // wiped out before it could be read, the same way any
                // DOM state is. setFlashMessage is what survives that,
                // read back and shown once the reload completes.
                gitpar.setFlashMessage(
                    "Branch created locally only",
                    "'" + typed.trim() + "' is not one of this repo's remotes (" + names.join(", ") + ").",
                    "error"
                );
            }
            self.createBranchWithRemote(branchName, startPoint, remote);
        }, function(xhr) {
            // No remotes to ask about, or the listing itself failed -
            // either way, falling back to the plain local create is the
            // one behaviour that was always available.
            self.createBranchWithRemote(branchName, startPoint, null);
        });
    }

    self.createBranchWithRemote = function(branchName, startPoint, remote) {
        // create already checks out the new branch (checkout: true is
        // git checkout -b under the hood), so publishing it is just the
        // push that follows - not a separate checkout first.
        gitpar.apiPost("/api/branches/create", {
            name: branchName,
            start_point: startPoint,
            checkout: true,
        }, function() {
            if (!remote) {
                gitpar.reloadApp();
                return;
            }
            // remote/branchName are a chosen-from-a-list remote name and
            // a ref-format branch name, not free-form text - the same
            // reason other ref names are embedded unquoted elsewhere
            // (onPushSetUpstream, for one).
            self.runRemoteAction("toolbar-push", "push --set-upstream " + remote + " " + branchName, function() {
                gitpar.reloadApp();
            }, function(message) {
                // The branch exists and is checked out either way - only
                // the publish failed, so that's what's reported. Flashed
                // rather than shown directly, since the reload right
                // after would otherwise wipe out an error dialog before
                // there was any chance to read it.
                gitpar.setFlashMessage("Branch created, but not published", message, "error");
                gitpar.reloadApp();
            });
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to create branch"));
        });
    }

    self.createTagAtRef = function(startPoint, suggestedName) {
        var tagName = window.prompt("New tag name", suggestedName || "");
        if (!tagName) {
            return;
        }
        gitpar.git("tag " + tagName + (startPoint ? " " + startPoint : ""), function() {
            gitpar.showResult("Tag created", "Created tag " + tagName);
        });
    }

    // -- section / tab switching (replaces the former SideBarView) --

    self.activeSectionName = "history";

    self.activateSection = function(sectionName) {
        self.activeSectionName = sectionName;
        // The Branch label doubles as the Branches section's tab (there
        // is no separate Branches button), so it takes the active state
        // alongside the real tabs.
        $(".toolbar-tab, .toolbar-label[data-section]", self.element).removeClass("active");
        $("[data-section='" + sectionName + "']", self.element).addClass("active");
    }

    // Remembers whichever section was showing right before Changes, so
    // Escape can return to it - set here rather than only at the
    // "jumped in from a commit's file" call sites, so it also covers
    // arriving via the toolbar tab/keyboard shortcut the same way.
    // Left untouched if already on workspace, so a second, unrelated
    // showWorkspace() call (the Ctrl+1 shortcut fired twice, say) can't
    // clobber a real return point with "workspace" itself.
    self.workspaceReturnSection = null;

    self.showWorkspace = function() {
        if (self.activeSectionName != "workspace") {
            self.workspaceReturnSection = self.activeSectionName;
        }
        self.activateSection("workspace");
        mainView.workspaceView.update("stage");
    }

    self.showHistory = function() {
        self.hideDiffControls();
        self.activateSection("history");
        mainView.historyView.update(gitpar.historyRef);
    }

    self.showBranches = function() {
        self.hideDiffControls();
        self.activateSection("branches");
        mainView.branchesView.update();
    }

    // -- diff controls (hunk step / options / focus), shown in the main
    // toolbar next to Fetch whenever the Changes view has a diff loaded,
    // so they stay reachable without scrolling back up to the diff pane
    // itself.

    self.diffControlsTarget = null;

    self.showDiffControls = function(diffView) {
        self.diffControlsTarget = diffView;
        var visible = !!(diffView && diffView.currentDiff);
        $(".toolbar-diff-controls, .toolbar-diff-controls-divider", self.element).toggle(visible);
    }

    self.hideDiffControls = function() {
        self.diffControlsTarget = null;
        $(".toolbar-diff-controls, .toolbar-diff-controls-divider", self.element).hide();
    }

    self.renderDiffMoreMenu = function() {
        var menu = $(".toolbar-menu[data-menu='diff-more']", self.element);
        menu.empty();
        var target = self.diffControlsTarget;
        if (!target) {
            return;
        }
        menu.append(self.appMenuItem("Ignore whitespace", null, function() {
            target.toggleIgnoreWhitespace();
        }, { checked: !!target.ignoreWhitespace }));
        menu.append(self.appMenuItem("Complete file", null, function() {
            target.allContext();
        }, { checked: !!target.complete }));
        menu.append(self.appMenuItem("Side-by-side", null, function() {
            target.toggleSideBySide();
        }, { checked: !!target.sideBySide }));
    }

    self.refreshActiveSection = function() {
        if (self.activeSectionName == "workspace" && !gitpar.viewonly) {
            mainView.workspaceView.update("stage");
        } else if (self.activeSectionName == "branches") {
            mainView.branchesView.update();
        } else {
            mainView.historyView.update(gitpar.historyRef);
        }
    }

    // -- hamburger app menu --

    self.closeMenus = function() {
        $(".toolbar-menu", self.element).removeClass("open").hide();
        self.openMenuName = null;
    }

    self.toggleMenu = function(name, anchor) {
        var menu = $(".toolbar-menu[data-menu='" + name + "']", self.element);
        var willOpen = self.openMenuName != name;
        self.closeMenus();
        if (willOpen) {
            self.openMenuName = name;
            menu.addClass("open").show();
            var rect = anchor.getBoundingClientRect();
            menu.css({ top: (rect.bottom + 4) + "px", left: rect.left + "px", position: "fixed" });
        }
    }

    // The menu is grouped rather than flat: a single list of everything
    // the app can do had grown long enough that finding anything in it
    // meant reading all of it, and four of its actions - Worktrees,
    // Reflog, Submodules, and the stash list - had no entry at all, so
    // those views were unreachable.
    self.APP_MENU_CATEGORIES = [
        { id: "file", label: "File" },
        { id: "view", label: "View" },
        { id: "repo", label: "Repo" },
        { id: "help", label: "Help" },
    ];
    self.appMenuCategory = "file";

    self.appMenuItem = function(label, shortcut, action, options) {
        options = options || {};
        var item = $('<button type="button" class="toolbar-menu-item">');
        item.append($('<span class="toolbar-menu-label">').text(label));
        if (shortcut) {
            item.append($('<span class="toolbar-menu-shortcut">').text(shortcut));
        }
        if (options.checked) {
            item.addClass("checked");
        }
        if (options.disabled) {
            item.prop("disabled", true);
        } else {
            item.click(function() {
                self.closeMenus();
                action();
            });
        }
        return item;
    }

    self.appMenuDivider = function() {
        return $('<div class="toolbar-menu-divider"></div>');
    }

    self.renderAppMenuPanel = function() {
        var panel = $(".app-menu-panel", self.element);
        panel.empty();
        $(".app-menu-cat", self.element).each(function() {
            $(this).toggleClass("active", $(this).attr("data-category") == self.appMenuCategory);
        });
        var builders = {
            file: self.buildFileMenu,
            view: self.buildViewMenu,
            repo: self.buildRepoMenu,
            help: self.buildHelpMenu,
        };
        (builders[self.appMenuCategory] || self.buildFileMenu)(panel);
    }

    self.buildFileMenu = function(panel) {
        panel.append(self.appMenuItem("Create Repo\u2026", "Ctrl+Shift+N", self.createRepoFlow));
        panel.append(self.appMenuItem("Clone Repo\u2026", "Ctrl+N", self.cloneRepo));
        panel.append(self.appMenuItem("Open Local Repo\u2026", "Ctrl+O", self.openPicker));
        panel.append(self.appMenuItem("Open Repo Folder\u2026", null, self.openWorkspacePicker));
        if (gitpar.repoPath) {
            panel.append(self.appMenuDivider());
            panel.append(self.appMenuItem("Close " + gitpar.repoPath, null, function() {
                self.closeRepoTab(gitpar.activeRepoId);
            }));
        }
        // The repositories this app has opened, current one ticked -
        // the same list the repo label offers, reachable from the menu
        // as well because that is where a File menu is looked for.
        if (gitpar.recentRepos.length > 0) {
            panel.append(self.appMenuDivider());
            gitpar.recentRepos.forEach(function(repo) {
                panel.append(self.appMenuItem(repo.path, null, function() {
                    mainView.repoPicker.selectRepo(repo.path);
                }, { checked: !!repo.active }));
            });
        }
    }

    self.buildViewMenu = function(panel) {
        panel.append($('<div class="toolbar-menu-heading">Theme</div>'));
        [["system", "System"], ["light", "Light"], ["dark", "Dark"]].forEach(function(choice) {
            panel.append(self.appMenuItem(choice[1], null, function() {
                gitpar.applyTheme(choice[0]);
            }, { checked: gitpar.themePreference == choice[0] }));
        });
        panel.append(self.appMenuDivider());
        panel.append(self.appMenuItem("Show Changes", "Ctrl+1", self.showWorkspace));
        panel.append(self.appMenuItem("Show Commits", "Ctrl+2", self.showHistory));
        panel.append(self.appMenuItem("Show Branches", "Ctrl+3", self.showBranches));
        panel.append(self.appMenuDivider());
        panel.append(self.appMenuItem("Reload", null, function() { window.location.reload(); }));
    }

    self.buildRepoMenu = function(panel) {
        var noRepo = !gitpar.repoPath;
        panel.append(self.appMenuItem("Find\u2026", "Ctrl+F", function() {
            mainView.searchOverlay.show();
        }, { disabled: noRepo }));
        panel.append(self.appMenuDivider());
        var current = self.currentBranch();
        panel.append(self.appMenuItem("Pull", "Ctrl+Shift+P", function() { self.onPull(); },
                                      { disabled: noRepo || !(current && current.upstream) }));
        panel.append(self.appMenuItem("Push", "Ctrl+Shift+U", function() { self.onPush(); },
                                      { disabled: noRepo }));
        panel.append(self.appMenuItem("Force Push", null, self.onForcePush, { disabled: noRepo }));
        panel.append(self.appMenuItem("Fetch", "Ctrl+Shift+F", function() { self.onFetch(); },
                                      { disabled: noRepo }));
        panel.append(self.appMenuDivider());
        panel.append(self.appMenuItem("Auto fetch", null, function() {
            self.toggleAutoFetch();
        }, { checked: gitpar.autoFetchEnabled }));
        panel.append(self.appMenuItem("Configure Remotes\u2026", null, function() {
            mainView.configureRemotesView.show();
        }, { disabled: noRepo }));
        panel.append(self.appMenuItem("Credentials\u2026", null, function() {
            mainView.credentialsView.show();
        }, { disabled: noRepo }));
        panel.append(self.appMenuDivider());
        panel.append(self.appMenuItem("Stashes\u2026", null, function() {
            mainView.stashesView.show();
        }, { disabled: noRepo }));
        panel.append(self.appMenuItem("Worktrees\u2026", null, function() {
            mainView.worktreesView.show();
        }, { disabled: noRepo }));
        panel.append(self.appMenuItem("Submodules\u2026", null, function() {
            mainView.submodulesView.show();
        }, { disabled: noRepo }));
        panel.append(self.appMenuItem("Reflog\u2026", null, function() {
            mainView.reflogView.show();
        }, { disabled: noRepo }));
    }

    self.buildHelpMenu = function(panel) {
        panel.append(self.appMenuItem("About GitPar", null, function() {
            $("#help-modal").modal("show");
        }));
    }

    self.renderAppMenu = function() {
        var menu = $(".toolbar-menu[data-menu='app']", self.element);
        menu.empty();
        menu.addClass("app-menu");
        var categories = $('<div class="app-menu-cats"></div>');
        self.APP_MENU_CATEGORIES.forEach(function(category) {
            var button = $('<button type="button" class="app-menu-cat">')
                .attr("data-category", category.id)
                .append($('<span>').text(category.label))
                .append('<span class="app-menu-cat-arrow">&#8250;</span>');
            // Hover as well as click: a category is a place to look, not
            // a thing to commit to, so pointing at one is enough.
            var choose = function(event) {
                event.stopPropagation();
                self.appMenuCategory = category.id;
                self.renderAppMenuPanel();
            };
            button.click(choose);
            button.mouseenter(choose);
            categories.append(button);
        });
        menu.append(categories);
        menu.append($('<div class="app-menu-panel"></div>'));
        self.renderAppMenuPanel();
    }

    self.onAppMenuAction = function(event) {
        var action = event.currentTarget.getAttribute("data-action");
        self.closeMenus();
        if (action == "open-local") {
            self.openPicker();
        } else if (action == "open-workspace") {
            self.openWorkspacePicker();
        } else if (action == "clone-repo") {
            self.cloneRepo();
        } else if (action == "create-repo") {
            self.createRepoFlow();
        } else if (action == "toggle-theme") {
            self.toggleTheme();
        } else if (action == "worktrees") {
            mainView.worktreesView.show();
        } else if (action == "stashes") {
            mainView.stashesView.show();
        } else if (action == "reflog") {
            mainView.reflogView.show();
        } else if (action == "submodules") {
            mainView.submodulesView.show();
        } else if (action == "help") {
            $("#help-modal").modal("show");
        }
    }

    self.toggleTheme = function() {
        gitpar.applyTheme($("body").hasClass("dark-mode") ? "light" : "dark");
    }

    // -- repo dropdown --

    self.renderRepoMenu = function() {
        var menu = $(".toolbar-menu[data-menu='repo']", self.element);
        menu.empty();
        var list = $('<div class="toolbar-repo-list"></div>');
        if (gitpar.recentRepos.length == 0) {
            list.append('<div class="toolbar-menu-empty">No recent repositories yet.</div>');
        } else {
            gitpar.recentRepos.forEach(function(repo) {
                var item = $('<button type="button" class="toolbar-menu-item toolbar-repo-item" data-path="' + gitpar.escapeHtml(repo.path) + '"></button>');
                if (repo.active) {
                    item.addClass("checked");
                }
                item.append('<span class="repo-chip-name">' + gitpar.escapeHtml(repo.name) + '</span>');
                item.append('<span class="repo-chip-path">' + gitpar.escapeHtml(repo.path) + '</span>');
                item.click(self.selectRecentRepo);
                list.append(item);
            });
        }
        menu.append(list);

        if (gitpar.workspacePath) {
            menu.append('<div class="toolbar-menu-divider"></div>');
            menu.append('<div class="toolbar-menu-heading">Folder of Repos: ' + gitpar.escapeHtml(gitpar.workspacePath) + '</div>');
            if (gitpar.workspaceRepos.length == 0) {
                menu.append('<div class="toolbar-menu-empty">No git repos found in this folder.</div>');
            } else {
                gitpar.workspaceRepos.forEach(function(repo) {
                    var item = $('<button type="button" class="toolbar-menu-item toolbar-repo-item"></button>');
                    if (repo.active) {
                        item.addClass("checked");
                    }
                    item.append('<span class="repo-chip-name">' + gitpar.escapeHtml(repo.name) + ' <span class="ref-chip-extra">[' + gitpar.escapeHtml(repo.branch) + ']</span></span>');
                    item.append('<span class="repo-chip-path">' + gitpar.escapeHtml(gitpar.formatRepoCounts(repo)) + '</span>');
                    item.click(function() {
                        mainView.repoPicker.selectRepo(repo.path);
                    });
                    menu.append(item);
                });
            }
        }

        menu.append('<div class="toolbar-menu-divider"></div>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="open-local">Open Local Repo&hellip;</button>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="open-workspace">Open Repo Folder&hellip;</button>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="clone-repo">Clone Repo&hellip;</button>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="create-repo">Create Repo&hellip;</button>');
        if (!gitpar.viewonly) {
            menu.append('<div class="toolbar-menu-divider"></div>');
            menu.append('<button type="button" class="toolbar-menu-item" data-action="worktrees">Worktrees&hellip;</button>');
            menu.append('<button type="button" class="toolbar-menu-item" data-action="stashes">Stashes&hellip;</button>');
            menu.append('<button type="button" class="toolbar-menu-item" data-action="reflog">Reflog&hellip;</button>');
            menu.append('<button type="button" class="toolbar-menu-item" data-action="submodules">Submodules&hellip;</button>');
        }
        $(".toolbar-menu-item[data-action]", menu).click(self.onAppMenuAction);
    }

    self.cloneRepo = function() {
        var url = window.prompt("Repository URL to clone");
        if (!url) {
            return;
        }
        gitpar.apiPost("/api/fs/pick-directory", {
            path: gitpar.workspacePath || gitpar.repoPath || null,
            title: "Choose destination folder",
        }, function(data) {
            if (data.unsupported) {
                gitpar.showWarning(data.error || "Native folder picker unavailable.");
                return;
            }
            if (data.cancelled) {
                return;
            }
            gitpar.apiPost("/api/repos/clone", {url: url, destination: data.path}, function(context) {
                gitpar.applyOpenedRepoContext(mainView, context);
            }, function(xhr) {
                gitpar.showError(gitpar.parseApiError(xhr, "Clone failed"));
            });
        });
    }

    self.createRepoFlow = function() {
        var name = window.prompt("New repository folder name");
        if (!name) {
            return;
        }
        gitpar.apiPost("/api/fs/pick-directory", {
            path: gitpar.workspacePath || gitpar.repoPath || null,
            title: "Choose parent folder",
        }, function(data) {
            if (data.unsupported) {
                gitpar.showWarning(data.error || "Native folder picker unavailable.");
                return;
            }
            if (data.cancelled) {
                return;
            }
            gitpar.apiPost("/api/repos/create", {destination: data.path, directory_name: name}, function(context) {
                gitpar.applyOpenedRepoContext(mainView, context);
            }, function(xhr) {
                gitpar.showError(gitpar.parseApiError(xhr, "Create repo failed"));
            });
        });
    }

    // -- Pull / Push / Fetch : left click executes, right click opens options --

    // While a remote action's git subprocess is running, it may be
    // blocked waiting on a credential prompt (see base_git_env's
    // GIT_ASKPASS in the backend) - polling for one and surfacing it
    // here is what actually answers it, rather than just letting the
    // request fail once GIT_TERMINAL_PROMPT's fast-fail kicks in.
    self.showAskpassPrompt = function(promptId, promptText, onDone) {
        var isPassword = /password/i.test(promptText || "");
        $(".askpass-prompt-text", self.askpassModal).text(promptText || "Credentials needed");
        var input = $(".askpass-input", self.askpassModal)
            .attr("type", isPassword ? "password" : "text")
            .val("");
        var submitted = false;
        var submit = function(value) {
            if (submitted) {
                return;
            }
            submitted = true;
            $(self.askpassModal).modal("hide");
            // Either way the wait is over: a 404 here just means the
            // prompt was already answered or timed out elsewhere.
            gitpar.apiPost("/api/askpass/answer", { id: promptId, value: value }, onDone, onDone);
        };
        $(".askpass-submit", self.askpassModal).off("click").click(function() { submit(input.val()); });
        // Cancelling submits an empty value rather than leaving the
        // prompt open - the git subprocess is genuinely blocked on the
        // other end, so "do nothing" would just make it wait out the
        // full timeout instead of failing right away.
        $(".askpass-cancel", self.askpassModal).off("click").click(function() { submit(""); });
        input.off("keydown").on("keydown", function(event) {
            if (event.key == "Enter") {
                event.preventDefault();
                submit(input.val());
            }
        });
        $(self.askpassModal).modal("show");
        setTimeout(function() { input.focus(); }, 200);
    }

    self.startAskpassPolling = function() {
        var stopped = false;
        var showing = false;
        var poll = function() {
            if (stopped) {
                return;
            }
            // Deliberately not gitpar.apiGet: a transient failure here
            // is routine (nothing to report, or the window closing) and
            // should just retry quietly, not pop an error modal on top
            // of whatever the reader is doing.
            $.getJSON(gitpar.withRepoParam("/api/askpass/pending"))
                .done(function(data) {
                    if (stopped) {
                        return;
                    }
                    if (data.id && !showing) {
                        showing = true;
                        self.showAskpassPrompt(data.id, data.prompt, function() {
                            showing = false;
                            if (!stopped) {
                                setTimeout(poll, 300);
                            }
                        });
                    } else if (!data.id) {
                        setTimeout(poll, 500);
                    }
                    // else: a prompt is already showing - its own onDone
                    // callback resumes polling once it's answered.
                })
                .fail(function() {
                    if (!stopped) {
                        setTimeout(poll, 1000);
                    }
                });
        };
        poll();
        return function() {
            stopped = true;
            $(self.askpassModal).modal("hide");
        };
    }

    self.runRemoteAction = function(buttonId, cmd, callback, onError) {
        var button = $("#" + buttonId, self.element).addClass("toolbar-remote-btn-busy");
        var stopAskpassPolling = self.startAskpassPolling();
        return gitpar.git(cmd, function(data) {
            callback(data);
        }, onError).always(function() {
            button.removeClass("toolbar-remote-btn-busy");
            stopAskpassPolling();
        });
    }

    // These deliberately say nothing on success: the spinner covers the
    // wait and the refreshed branch state shows the result, so a modal
    // would only be something to dismiss. Failures still raise one -
    // gitpar.git surfaces a non-zero exit through showError - and git's
    // warnings on a successful run still reach the message bar.

    // Every remote action refreshes whichever section is actually on
    // screen, via refreshActiveSection - not a specific one. A pull
    // brings in new commits the Commits view has to redraw to show, but
    // it can just as easily land the reader on Branches or Search, and
    // forcing a switch to Changes (as onPull alone used to do
    // unconditionally) took over the screen regardless of where the
    // reader was. refreshActiveSection already existed for exactly this
    // - redraw the visible section in place - because switching a repo
    // tab needed the same thing.

    // Recognises the backend's GIT_TERMINAL_PROMPT=0 failure (see
    // base_git_env in src/bin/gitpar) and offers the fix instead of
    // showing that stderr line raw. Shared by fetch/pull/push, the same
    // way onPush's own onError below handles its own no-upstream case.
    // Returns true (suppressing the generic error modal) when it applies.
    self.handleCredentialsNeededError = function(message) {
        var needed = gitpar.parseCredentialsNeededError(message);
        if (!needed) {
            return false;
        }
        if (window.confirm("This repository needs credentials for " + needed.url + ". Set them up now?")) {
            mainView.credentialsView.show();
        }
        return true;
    }

    self.onPull = function(event) {
        if (event) {
            event.preventDefault();
        }
        var strategy = gitpar.pullStrategy;
        // --prune: a plain fetch (which pull runs first) never removes a
        // remote-tracking ref for a branch that's gone from the remote -
        // that's what --prune is for, and without it every fetch/pull
        // leaves that branch showing here forever, looking exactly as
        // live as one that still exists. Only the tracking ref goes;
        // a local branch of the same name, if there is one, is untouched.
        var args = (strategy == "rebase" ? "pull --rebase" : "pull") + " --prune";
        self.runRemoteAction("toolbar-pull", args, function(data) {
            self.loadBranches();
            self.refreshActiveSection();
        }, self.handleCredentialsNeededError);
    }

    self.onPushSetUpstream = function(remote, branch) {
        if (!window.confirm("'" + branch + "' has no upstream yet. Publish it to '" + remote + "' and track it there?")) {
            return;
        }
        // remote/branch are ref-format tokens straight out of git's own
        // suggested command line, never free-form text - the same
        // reason branch and tag names are embedded unquoted elsewhere
        // (createTagAtRef, for one): git's own naming rules already
        // forbid the characters that would need escaping here.
        self.runRemoteAction("toolbar-push", "push --set-upstream " + remote + " " + branch, function(data) {
            self.loadBranches();
            self.refreshActiveSection();
        });
    }

    self.onPush = function(event) {
        if (event) {
            event.preventDefault();
        }
        self.runRemoteAction("toolbar-push", "push", function(data) {
            self.loadBranches();
            self.refreshActiveSection();
        }, function(message) {
            var noUpstream = gitpar.parseNoUpstreamError(message);
            if (noUpstream) {
                self.onPushSetUpstream(noUpstream.remote, noUpstream.branch);
                return true;
            }
            return self.handleCredentialsNeededError(message);
        });
    }

    self.onForcePush = function() {
        if (!window.confirm("Force push may overwrite remote history. Continue?")) {
            return;
        }
        self.runRemoteAction("toolbar-push", "push --force", function(data) {
            self.loadBranches();
            self.refreshActiveSection();
        });
    }

    self.onFetch = function(event) {
        if (event) {
            event.preventDefault();
        }
        if (!gitpar.repoPath) {
            return;
        }
        // Keyed by repo rather than a plain flag: switching to a
        // different repo tab while one repo's fetch is still in flight
        // must still be able to fetch the newly-active one - only a
        // second trigger for the *same* repo (the window regaining focus
        // right after a tab switch already started one, say) should be
        // skipped.
        if (self.fetchInFlightFor == gitpar.activeRepoId) {
            return;
        }
        self.fetchInFlightFor = gitpar.activeRepoId;
        // --prune: without it, a branch deleted on the remote keeps its
        // local remote-tracking ref indefinitely - fetch has no reason
        // to touch a ref it wasn't told to remove - so it goes on
        // looking exactly like a branch that's still there, in every
        // repo that never happens to fetch it away. This is also what
        // the periodic auto-fetch timer runs, so a background fetch
        // cleans up the same way an explicit one does.
        self.runRemoteAction("toolbar-fetch", "fetch --prune", function(data) {
            self.loadBranches();
            self.refreshActiveSection();
        }, self.handleCredentialsNeededError).always(function() {
            self.fetchInFlightFor = null;
        });
    }

    self.toggleAutoFetch = function() {
        gitpar.applyAutoFetchPreference(!gitpar.autoFetchEnabled);
        self.applyAutoFetch();
    }

    // Instance method: starts or stops this window's fetch timer to
    // match gitpar.autoFetchEnabled. Distinct from the module-level
    // gitpar.applyAutoFetchPreference, which only records the
    // preference and persists it - this is the one that actually acts
    // on it, and runs again after every toggle and at startup.
    self.applyAutoFetch = function() {
        if (self.autoFetchTimer) {
            clearInterval(self.autoFetchTimer);
            self.autoFetchTimer = null;
        }
        if (gitpar.autoFetchEnabled) {
            self.autoFetchTimer = setInterval(self.onFetch, 5 * 60 * 1000);
        }
    }

    self.setPullStrategy = function(strategy) {
        gitpar.applyPullStrategy(strategy);
    }

    self.renderRemoteMenu = function(kind) {
        var menu = $(".toolbar-menu[data-menu='" + kind + "']", self.element);
        menu.empty();
        if (kind == "pull") {
            var strategy = gitpar.pullStrategy;
            var ffItem = $('<button type="button" class="toolbar-menu-item' + (strategy != "rebase" ? " checked" : "") + '">Fast Forward When Possible</button>');
            ffItem.click(function() { self.setPullStrategy("ff"); });
            var rebaseItem = $('<button type="button" class="toolbar-menu-item' + (strategy == "rebase" ? " checked" : "") + '">Rebase</button>');
            rebaseItem.click(function() { self.setPullStrategy("rebase"); });
            menu.append(ffItem).append(rebaseItem).append('<div class="toolbar-menu-divider"></div>');
        } else if (kind == "push") {
            var forceItem = $('<button type="button" class="toolbar-menu-item">Force Push</button>');
            forceItem.click(self.onForcePush);
            menu.append(forceItem).append('<div class="toolbar-menu-divider"></div>');
        } else if (kind == "fetch") {
            var autoItem = $('<button type="button" class="toolbar-menu-item' + (gitpar.autoFetchEnabled ? " checked" : "") + '">Auto fetch</button>');
            autoItem.click(self.toggleAutoFetch);
            menu.append(autoItem).append('<div class="toolbar-menu-divider"></div>');
        }
        var configureItem = $('<button type="button" class="toolbar-menu-item">Configure Remotes</button>');
        configureItem.click(function() { mainView.configureRemotesView.show(); });
        menu.append(configureItem);
    }

    self.onRemoteContextMenu = function(kind, event) {
        event.preventDefault();
        self.renderRemoteMenu(kind);
        self.toggleMenu(kind, event.currentTarget);
    }

    // -- repo tabs (multiple repos open simultaneously) --

    self.renderRepoTabs = function() {
        var strip = $(".repo-tab-strip", self.element);
        strip.empty();
        if (gitpar.openRepos.length == 0) {
            return;
        }
        gitpar.openRepos.forEach(function(repo) {
            var tab = $('<div class="repo-tab" draggable="true"><span class="repo-tab-name"></span><button type="button" class="repo-tab-close" title="Close">&times;</button></div>');
            if (repo.path == gitpar.activeRepoId) {
                tab.addClass("active");
            }
            $(".repo-tab-name", tab).text(repo.name).attr("title", repo.path);
            $(".repo-tab-name", tab).click(function() {
                self.switchActiveRepo(repo.path);
            });
            $(".repo-tab-close", tab).click(function(event) {
                event.stopPropagation();
                self.closeRepoTab(repo.path);
            });
            // Reordering is purely a client-side arrangement - open_repos
            // is persisted with a merge-safe add/remove delta (see
            // save_open_repos_delta) so two instances' tab lists combine
            // safely; an explicit order doesn't merge the same way; so a
            // drag here doesn't survive a reload or reach other repo
            // tabs, only this window's.
            tab.on("dragstart", function(event) {
                self.draggedRepoId = repo.path;
                tab.addClass("dragging");
                event.originalEvent.dataTransfer.effectAllowed = "move";
                event.originalEvent.dataTransfer.setData("text/plain", repo.path);
            });
            tab.on("dragend", function() {
                self.draggedRepoId = null;
                $(".repo-tab", strip).removeClass("dragging drag-over");
            });
            tab.on("dragover", function(event) {
                if (!self.draggedRepoId || self.draggedRepoId == repo.path) {
                    return;
                }
                event.preventDefault();
                event.originalEvent.dataTransfer.dropEffect = "move";
                tab.addClass("drag-over");
            });
            tab.on("dragleave", function() {
                tab.removeClass("drag-over");
            });
            tab.on("drop", function(event) {
                event.preventDefault();
                tab.removeClass("drag-over");
                self.reorderRepoTab(self.draggedRepoId, repo.path);
            });
            strip.append(tab);
        });
        var addButton = $('<button type="button" class="repo-tab-add" title="Open another repo">+</button>');
        addButton.click(self.openPicker);
        strip.append(addButton);
    }

    self.reorderRepoTab = function(draggedId, targetId) {
        if (!draggedId || draggedId == targetId) {
            return;
        }
        var fromIndex = gitpar.openRepos.findIndex(function(repo) { return repo.path == draggedId; });
        var toIndex = gitpar.openRepos.findIndex(function(repo) { return repo.path == targetId; });
        if (fromIndex == -1 || toIndex == -1) {
            return;
        }
        var moved = gitpar.openRepos.splice(fromIndex, 1)[0];
        gitpar.openRepos.splice(toIndex, 0, moved);
        self.renderRepoTabs();
    }

    self.switchActiveRepo = function(repoId) {
        if (!repoId || repoId == gitpar.activeRepoId) {
            return;
        }
        var entry = gitpar.openRepos.filter(function(repo) { return repo.path == repoId; })[0];
        gitpar.activeRepoId = repoId;
        gitpar.repoPath = repoId;
        gitpar.repo = entry ? entry.name : repoId;
        gitpar.historyRef = null;
        gitpar.historyAuthorFilter = null;
        gitpar.refChipFilterName = null;
        // Branches, tags and stashes belong to the repository that was
        // open. loadBranches refetches them, but refreshActiveSection
        // below runs first and would otherwise draw the new repository
        // using the old one's refs - and seed the log with stash commits
        // that don't exist here.
        gitpar.clearRepoRefs();
        self.renderRepoTabs();
        self.update();
        self.refreshActiveSection();
        self.onFetch();
    }

    self.closeRepoTab = function(repoId) {
        gitpar.apiPost("/api/repos/close", {repo_id: repoId}, function(context) {
            gitpar.openRepos = context.open_repos || [];
            self.renderRepoTabs();
            if (!context.has_repo) {
                gitpar.activeRepoId = null;
                gitpar.repoPath = null;
                mainView.switchTo(new gitpar.NoRepoView(mainView).element);
                return;
            }
            if (context.repo_id != gitpar.activeRepoId) {
                gitpar.activeRepoId = context.repo_id;
                gitpar.repoPath = context.repo_path;
                gitpar.repo = context.repo_name;
                gitpar.historyRef = null;
                gitpar.historyAuthorFilter = null;
                gitpar.refChipFilterName = null;
                self.update();
                self.refreshActiveSection();
            }
        });
    }

    // -- rendering --

    self.update = function() {
        self.updateStatusMeta();
        self.loadBranches();
        self.renderRepoTabs();
    }

    self.element = $(   '<div id="app-chrome">' +
                            '<div id="app-titlebar">' +
                                '<img class="app-titlebar-mark" src="/img/gitpar-icon.svg" alt="GitPar">' +
                                '<span class="app-titlebar-path"></span>' +
                            '</div>' +
                            '<div class="repo-tab-strip"></div>' +
                            '<div id="app-toolbar">' +
                                '<button type="button" class="icon-btn" id="app-menu-button" title="Menu" aria-label="Menu">&#9776;</button>' +
                                '<div class="toolbar-menu" data-menu="app"></div>' +

                                '<div class="toolbar-label" id="toolbar-repo-label">' +
                                    '<div class="toolbar-label-value toolbar-repo-value"></div>' +
                                    '<div class="toolbar-label-caption">Repo</div>' +
                                '</div>' +
                                '<div class="toolbar-menu" data-menu="repo"></div>' +

                                '<div class="toolbar-label" id="toolbar-branch-label" data-section="branches" title="Show all branches">' +
                                    '<div class="toolbar-label-value toolbar-branch-value"></div>' +
                                    '<div class="toolbar-label-caption">Branch</div>' +
                                '</div>' +

                                '<div class="toolbar-tabs">' +
                                    '<button type="button" class="toolbar-tab" data-section="workspace">' +
                                        '<span class="toolbar-tab-icon">&#9776;</span>' +
                                        '<span class="toolbar-tab-text">Changes</span>' +
                                        '<span class="toolbar-tab-badge" id="toolbar-changes-badge"></span>' +
                                    '</button>' +
                                    '<button type="button" class="toolbar-tab" data-section="history">' +
                                        '<span class="toolbar-tab-icon">&#9776;</span>' +
                                        '<span class="toolbar-tab-text">Commits</span>' +
                                    '</button>' +
                                    '<button type="button" class="toolbar-tab" id="toolbar-search-button">' +
                                        '<span class="toolbar-tab-icon">&#128269;</span>' +
                                        '<span class="toolbar-tab-text">Search</span>' +
                                    '</button>' +
                                '</div>' +

                                '<div class="toolbar-spacer"></div>' +

                                '<div class="toolbar-diff-controls" style="display:none">' +
                                    '<button type="button" class="icon-btn" id="toolbar-diff-hunk-prev" title="Previous change" aria-label="Previous change">&#8963;</button>' +
                                    '<button type="button" class="icon-btn" id="toolbar-diff-hunk-next" title="Next change" aria-label="Next change">&#8964;</button>' +
                                    '<button type="button" class="icon-btn" id="toolbar-diff-more" title="Diff options" aria-label="Diff options">&#8942;</button>' +
                                    '<div class="toolbar-menu" data-menu="diff-more"></div>' +
                                    '<button type="button" class="icon-btn" id="toolbar-diff-focus" title="Focus diff" aria-label="Focus diff">&#8599;</button>' +
                                '</div>' +
                                '<div class="toolbar-divider toolbar-diff-controls-divider" style="display:none"></div>' +

                                '<div class="toolbar-remote-actions">' +
                                    '<button type="button" class="toolbar-remote-btn" id="toolbar-pull" title="Left-click to pull, right-click for options">' +
                                        '<span class="toolbar-remote-btn-icon">&#8595;</span><span>Pull</span>' +
                                        '<span class="toolbar-remote-btn-badge" id="toolbar-pull-badge"></span>' +
                                    '</button>' +
                                    '<div class="toolbar-menu" data-menu="pull"></div>' +
                                    '<button type="button" class="toolbar-remote-btn" id="toolbar-push" title="Left-click to push, right-click for options">' +
                                        '<span class="toolbar-remote-btn-icon">&#8593;</span><span>Push</span>' +
                                        '<span class="toolbar-remote-btn-badge" id="toolbar-push-badge"></span>' +
                                    '</button>' +
                                    '<div class="toolbar-menu" data-menu="push"></div>' +
                                    '<button type="button" class="toolbar-remote-btn" id="toolbar-fetch" title="Left-click to fetch, right-click for options">' +
                                        '<span class="toolbar-remote-btn-icon">&#8635;</span><span>Fetch</span>' +
                                    '</button>' +
                                    '<div class="toolbar-menu" data-menu="fetch"></div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];

    self.compareModal = $(   '<div class="modal fade" id="branch-compare-modal" tabindex="-1" role="dialog">' +
                                '<div class="modal-dialog modal-lg" role="document">' +
                                    '<div class="modal-content">' +
                                        '<div class="modal-header">' +
                                            '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                            '<div class="repo-picker-eyebrow">Branch Compare</div>' +
                                            '<h4 class="modal-title branch-compare-title">Compare Branches</h4>' +
                                        '</div>' +
                                        '<div class="modal-body">' +
                                            '<pre class="branch-compare-summary"></pre>' +
                                            '<pre class="branch-compare-diff"></pre>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>')[0];

    // data-backdrop="static"/data-keyboard="false": the git subprocess on
    // the other end is genuinely blocked waiting for an answer, so
    // dismissing this by clicking outside or pressing Escape without
    // actually answering would just leave it hanging - Cancel (which
    // submits an empty value) is the only way out that doesn't.
    self.askpassModal = $(   '<div class="modal fade" id="askpass-modal" tabindex="-1" role="dialog" data-backdrop="static" data-keyboard="false">' +
                                '<div class="modal-dialog" role="document">' +
                                    '<div class="modal-content">' +
                                        '<div class="modal-header">' +
                                            '<div class="repo-picker-eyebrow">Credentials needed</div>' +
                                            '<h4 class="modal-title askpass-prompt-text"></h4>' +
                                        '</div>' +
                                        '<div class="modal-body">' +
                                            '<input type="text" class="form-control askpass-input">' +
                                        '</div>' +
                                        '<div class="modal-footer">' +
                                            '<button type="button" class="btn btn-default askpass-cancel">Cancel</button>' +
                                            '<button type="button" class="btn btn-primary askpass-submit">Continue</button>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>')[0];

    $("#app-menu-button", self.element).click(function(event) {
        event.stopPropagation();
        self.renderAppMenu();
        self.toggleMenu("app", event.currentTarget);
    });

    // The shortcuts the menu advertises. Typing in a field owns its own
    // keystrokes, so nothing fires while a commit message or a filter
    // has focus.
    $(document).on("keydown", function(event) {
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }
        var target = event.target;
        if (target && (target.tagName == "INPUT" || target.tagName == "TEXTAREA" || target.isContentEditable)) {
            return;
        }
        var key = String(event.key).toLowerCase();
        if (!event.shiftKey && key == "1") {
            event.preventDefault();
            self.showWorkspace();
        } else if (!event.shiftKey && key == "2") {
            event.preventDefault();
            self.showHistory();
        } else if (!event.shiftKey && key == "3") {
            event.preventDefault();
            self.showBranches();
        } else if (event.shiftKey && key == "p" && !gitpar.viewonly) {
            event.preventDefault();
            self.onPull();
        } else if (event.shiftKey && key == "u" && !gitpar.viewonly) {
            event.preventDefault();
            self.onPush();
        } else if (event.shiftKey && key == "f" && !gitpar.viewonly) {
            event.preventDefault();
            self.onFetch();
        }
    });

    // Clicking a file from a commit's changes, or from the working
    // directory summary, jumps to the Changes view to show it -
    // plain Escape returns to whichever section that jump left, the
    // same "back" a modal or an expanded commit already gives.
    $(document).on("keydown", function(event) {
        if (event.key != "Escape" || self.activeSectionName != "workspace" || !self.workspaceReturnSection) {
            return;
        }
        var target = event.target;
        if (target && (target.tagName == "INPUT" || target.tagName == "TEXTAREA" || target.isContentEditable)) {
            return;
        }
        // A modal or the Stash/Discard dropdown has its own, more
        // specific meaning for Escape - let that happen instead of also
        // navigating away underneath it.
        if ($(".modal.in").length > 0 || $(".workspace-dropdown-menu.open").length > 0) {
            return;
        }
        var returnTo = self.workspaceReturnSection;
        self.workspaceReturnSection = null;
        if (returnTo == "branches") {
            self.showBranches();
        } else {
            self.showHistory();
        }
    });

    $("#toolbar-repo-label", self.element).click(function(event) {
        event.stopPropagation();
        self.renderRepoMenu();
        self.toggleMenu("repo", event.currentTarget);
    });

    $(".toolbar-menu", self.element).click(function(event) {
        event.stopPropagation();
    });
    $(document).on("click", self.closeMenus);

    $("#toolbar-pull", self.element).click(self.onPull);
    $("#toolbar-pull", self.element).on("contextmenu", function(event) { self.onRemoteContextMenu("pull", event); });
    $("#toolbar-push", self.element).click(self.onPush);
    $("#toolbar-push", self.element).on("contextmenu", function(event) { self.onRemoteContextMenu("push", event); });
    $("#toolbar-fetch", self.element).click(self.onFetch);
    $("#toolbar-fetch", self.element).on("contextmenu", function(event) { self.onRemoteContextMenu("fetch", event); });

    $("#toolbar-diff-hunk-prev", self.element).click(function() {
        if (self.diffControlsTarget) { self.diffControlsTarget.stepHunk(-1); }
    });
    $("#toolbar-diff-hunk-next", self.element).click(function() {
        if (self.diffControlsTarget) { self.diffControlsTarget.stepHunk(1); }
    });
    $("#toolbar-diff-more", self.element).click(function(event) {
        event.stopPropagation();
        self.renderDiffMoreMenu();
        self.toggleMenu("diff-more", event.currentTarget);
    });
    $("#toolbar-diff-focus", self.element).click(function(event) {
        if (mainView.workspaceView) {
            var on = mainView.workspaceView.toggleFocusMode();
            $(event.currentTarget).toggleClass("on", on).attr("aria-pressed", on);
        }
    });

    if (gitpar.viewonly) {
        $("#toolbar-push, #toolbar-pull, #app-menu-button", self.element).prop("disabled", true);
    } else {
        $(".toolbar-tab[data-section='workspace']", self.element).click(self.showWorkspace);
    }
    $(".toolbar-tab[data-section='history']", self.element).click(self.showHistory);
    $("#toolbar-branch-label", self.element).click(self.showBranches);
    $("#toolbar-search-button", self.element).click(function() {
        mainView.searchOverlay.show();
    });

    self.applyAutoFetch();

    // Refresh remote state whenever the reader actually comes back to
    // look at it - the window regaining OS/browser focus after being
    // elsewhere, not just the periodic timer above. onFetch's own
    // per-repo in-flight guard keeps this from overlapping that timer,
    // a manual click, or the same trigger firing twice in a row.
    $(window).on("focus", function() {
        self.onFetch();
    });

    $("body").append(self.compareModal);
    $("body").append(self.askpassModal);
    self.activateSection("history");
};

gitpar.ConfigureRemotesView = function() {

    var self = this;

    self.refresh = function() {
        gitpar.apiGet("/api/remotes", function(data) {
            self.render(data.remotes || []);
        });
    }

    self.render = function(remotes) {
        var list = $(".configure-remotes-list", self.element);
        list.empty();
        if (remotes.length == 0) {
            list.append('<div class="toolbar-menu-empty">No remotes configured.</div>');
        }
        remotes.forEach(function(remote) {
            var row = $(  '<div class="configure-remotes-row">' +
                                '<div class="configure-remotes-name"></div>' +
                                '<div class="configure-remotes-url"></div>' +
                                '<button type="button" class="btn btn-danger btn-xs configure-remotes-remove">Remove</button>' +
                            '</div>');
            $(".configure-remotes-name", row).text(remote.name);
            $(".configure-remotes-url", row).text(remote.fetch_url || "");
            $(".configure-remotes-remove", row).click(function() {
                if (!window.confirm("Remove remote '" + remote.name + "'?")) {
                    return;
                }
                gitpar.apiPost("/api/remotes/remove", {name: remote.name}, function(data) {
                    self.render(data.remotes || []);
                }, function(xhr) {
                    gitpar.showError(gitpar.parseApiError(xhr, "Unable to remove remote"));
                });
            });
            list.append(row);
        });
    }

    self.onAdd = function() {
        var name = $(".configure-remotes-add-name", self.element).val();
        var url = $(".configure-remotes-add-url", self.element).val();
        if (!name || !url) {
            return;
        }
        gitpar.apiPost("/api/remotes/add", {name: name, url: url}, function(data) {
            $(".configure-remotes-add-name, .configure-remotes-add-url", self.element).val("");
            self.render(data.remotes || []);
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to add remote"));
        });
    }

    self.show = function() {
        self.refresh();
        $(self.element).modal("show");
    }

    self.element = $(   '<div class="modal fade" id="configure-remotes-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Remotes</div>' +
                                        '<h4 class="modal-title">Configure Remotes</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<div class="configure-remotes-list"></div>' +
                                        '<div class="configure-remotes-add">' +
                                            '<input type="text" class="form-control input-sm configure-remotes-add-name" placeholder="name (e.g. origin)">' +
                                            '<input type="text" class="form-control input-sm configure-remotes-add-url" placeholder="url">' +
                                            '<button type="button" class="btn btn-primary btn-sm configure-remotes-add-button">Add</button>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $(".configure-remotes-add-button", self.element).click(self.onAdd);
    $("body").append(self.element);
};

// Built-in git credential helpers worth offering, per platform. "cache"
// (in-memory, time-limited) is the safe default everywhere including
// Linux, where a real secret-store helper (libsecret) may or may not
// actually be installed - git config accepts the name unconditionally,
// so the only reliable way to know if it works is trying it, which
// happens naturally the first time something needs a credential.
gitpar.CREDENTIAL_HELPER_CHOICES = {
    darwin: [
        { value: "osxkeychain", label: "macOS Keychain (recommended)" },
        { value: "cache", label: "Cache in memory (times out)" },
        { value: "store", label: "Store in a plain text file (less secure)" },
    ],
    win32: [
        { value: "manager-core", label: "Git Credential Manager (recommended)" },
        { value: "wincred", label: "Windows Credential Manager" },
        { value: "cache", label: "Cache in memory (times out)" },
        { value: "store", label: "Store in a plain text file (less secure)" },
    ],
    linux: [
        { value: "cache", label: "Cache in memory (recommended, times out)" },
        { value: "libsecret", label: "OS keyring via libsecret (needs git-credential-libsecret installed)" },
        { value: "store", label: "Store in a plain text file (less secure)" },
    ],
};

gitpar.suggestedCredentialHelpers = function() {
    return gitpar.CREDENTIAL_HELPER_CHOICES[gitpar.platform] || gitpar.CREDENTIAL_HELPER_CHOICES.linux;
}

// Where a native keychain-backed helper's entries actually live, so the
// Credentials panel can point there rather than trying to reimplement
// browsing a platform keychain in-app.
gitpar.CREDENTIAL_HELPER_KEYCHAIN_HINTS = {
    darwin: "Keychain Access",
    win32: "Windows Credential Manager",
    linux: "your keyring app (e.g. Seahorse or GNOME Passwords)",
};

/*
 * == CredentialsView ==========================================================
 * Reads and writes git's own credential.helper config - GitPar never
 * stores or sees a credential itself. Everything here rides straight on
 * the existing unrestricted /git passthrough (gitpar.git), the same as a
 * user typing these same commands into a real terminal; there is no
 * dedicated backend endpoint for any of it.
 */
gitpar.CredentialsView = function() {

    var self = this;

    // git config --get resolves local > global > system on its own, so
    // this is the value actually in effect right now. Its own separate
    // --global --get tells "this repo overrides it" apart from
    // "inheriting the global/system default" for display purposes.
    // config --get exits 1 (not an error - just "unset") when nothing
    // matches, so both reads treat that as an empty value rather than
    // showing the generic error modal.
    self.refresh = function() {
        gitpar.git("config --get credential.helper", function(effective) {
            gitpar.git("config --global --get credential.helper", function(global_) {
                self.render(effective.trim(), global_.trim());
            }, function() {
                self.render(effective.trim(), "");
                return true;
            });
        }, function() {
            self.render("", "");
            return true;
        });
    }

    self.render = function(effective, global_) {
        var status = $(".credentials-status", self.element);
        if (!effective) {
            status.text("No credential helper is configured - git will ask for a username and password every time, and won't remember them.");
        } else if (effective == global_) {
            status.text("Currently using “" + effective + "”, configured globally (all repositories).");
        } else {
            status.text("Currently using “" + effective + "”, configured for this repository only.");
        }

        var select = $(".credentials-helper-select", self.element);
        select.empty();
        select.append($('<option value="">Don’t store credentials</option>'));
        gitpar.suggestedCredentialHelpers().forEach(function(choice) {
            select.append($('<option>').attr("value", choice.value).text(choice.label));
        });
        select.val(effective);

        $(".credentials-scope-select", self.element).val(effective && effective != global_ ? "repo" : "global");

        self.renderManagement(effective);
    }

    // Whatever's actually managing stored credentials right now gets a
    // matching management affordance below the picker: store's entries
    // can be listed and individually forgotten, cache's can only be
    // cleared as a whole (it's an opaque in-memory daemon), and a native
    // keychain helper's are pointed at rather than reimplemented here.
    self.renderManagement = function(effective) {
        var container = $(".credentials-management", self.element);
        container.empty();
        if (!effective) {
            return;
        }
        if (effective == "store" || effective.indexOf("store ") == 0) {
            self.renderStoredList(container);
        } else if (effective == "cache" || effective.indexOf("cache ") == 0) {
            self.renderCacheClear(container);
        } else {
            self.renderKeychainHint(container, effective);
        }
    }

    self.renderStoredList = function(container) {
        container.append('<h5 class="credentials-management-title">Stored credentials</h5>');
        var list = $('<div class="credentials-stored-list">Loading…</div>').appendTo(container);
        // Deliberately not gitpar.apiGet: listing what's stored is
        // routine background info for this panel, not worth a full
        // error modal if the file happens to be briefly unreadable.
        $.getJSON(gitpar.withRepoParam("/api/credentials/stored"))
            .done(function(data) {
                list.empty();
                if (!data.entries || data.entries.length == 0) {
                    list.append($('<div class="credentials-stored-empty"></div>')
                        .text("No stored credentials found in " + data.path + "."));
                    return;
                }
                data.entries.forEach(function(entry) {
                    var row = $(  '<div class="credentials-stored-row">' +
                                        '<span class="credentials-stored-host"></span>' +
                                        '<span class="credentials-stored-user"></span>' +
                                        '<button type="button" class="btn btn-danger btn-xs credentials-stored-forget">Forget</button>' +
                                    '</div>');
                    $(".credentials-stored-host", row).text(entry.protocol + "://" + entry.host);
                    $(".credentials-stored-user", row).text(entry.username || "(no username)");
                    $(".credentials-stored-forget", row).click(function() {
                        self.forgetStoredCredential(entry, row);
                    });
                    list.append(row);
                });
            })
            .fail(function() {
                list.text("Unable to read stored credentials.");
            });
    }

    self.forgetStoredCredential = function(entry, row) {
        if (!window.confirm("Forget the stored credential for " + entry.host +
                (entry.username ? " (" + entry.username + ")" : "") + "?")) {
            return;
        }
        // git credential reject removes whatever matches this from the
        // *configured* helper - store here, since that's the only case
        // this is ever called from - via the same key=value stdin
        // protocol every git credential helper speaks, rather than this
        // editing the file directly and having to reproduce store's own
        // format/escaping rules to do it safely.
        var stdin = "protocol=" + entry.protocol + "\nhost=" + entry.host +
            (entry.username ? "\nusername=" + entry.username : "") + "\n\n";
        gitpar.git("credential reject", stdin, function() {
            row.remove();
        }, function(message) {
            gitpar.showError(message);
            return true;
        });
    }

    self.renderCacheClear = function(container) {
        container.append('<h5 class="credentials-management-title">Cached credentials</h5>');
        var button = $('<button type="button" class="btn btn-default btn-sm credentials-cache-clear">Clear cached credentials</button>')
            .appendTo(container);
        button.click(function() {
            gitpar.git("credential-cache exit", function() {
                gitpar.showResult("Cleared", "Cached credentials have been cleared.");
            }, function(message) {
                gitpar.showError(message);
                return true;
            });
        });
    }

    self.renderKeychainHint = function(container, effective) {
        var hint = gitpar.CREDENTIAL_HELPER_KEYCHAIN_HINTS[gitpar.platform] || "your system's credential manager";
        container.append($('<div class="credentials-management-hint"></div>').text(
            "Credentials go through " + effective + " - manage or remove individual entries in " + hint + "."));
    }

    self.onSave = function() {
        var helper = $(".credentials-helper-select", self.element).val();
        var scope = $(".credentials-scope-select", self.element).val();
        var scopeFlag = scope == "global" ? "--global " : "";
        // An empty value unsets the key at that scope, same as leaving
        // it unconfigured - git config --unset rather than setting it to
        // nothing, which config credential.helper "" would otherwise do.
        var cmd = helper
            ? "config " + scopeFlag + "credential.helper " + gitpar.quoteArg(helper)
            : "config " + scopeFlag + "--unset credential.helper";
        gitpar.git(cmd, function() {
            self.refresh();
        }, function(message) {
            // --unset on a key that was never set exits non-zero too -
            // not a real failure, there's simply nothing to remove.
            if (!helper) {
                self.refresh();
                return true;
            }
            gitpar.showError(message);
            return true;
        });
    }

    self.show = function() {
        self.refresh();
        $(self.element).modal("show");
    }

    self.element = $(   '<div class="modal fade" id="credentials-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Credentials</div>' +
                                        '<h4 class="modal-title">Repository Credentials</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<div class="credentials-status"></div>' +
                                        '<div class="credentials-form">' +
                                            '<label>Credential helper</label>' +
                                            '<select class="form-control input-sm credentials-helper-select"></select>' +
                                            '<label>Apply to</label>' +
                                            '<select class="form-control input-sm credentials-scope-select">' +
                                                '<option value="repo">This repository only</option>' +
                                                '<option value="global">Global (all repositories)</option>' +
                                            '</select>' +
                                            '<button type="button" class="btn btn-primary btn-sm credentials-save-button">Save</button>' +
                                        '</div>' +
                                        '<div class="credentials-management"></div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $(".credentials-save-button", self.element).click(self.onSave);
    $("body").append(self.element);
};

/*
 * == WorktreesView =============================================================
 * Local branches, browsed the same way as the Branches view - one row per
 * branch, click-driven rather than typed - paired with their worktree if
 * one exists. Git allows one worktree per branch at a time, which used to
 * be the failure the old blank-fields form kept hitting silently (trying
 * to create a branch that already existed); showing the pairing up front
 * removes the only way to reach that failure. A row with no worktree gets
 * a suggested sibling path rather than a blank field, and starting a whole
 * new branch stays a separate, deliberate action from reattaching to one
 * that already exists.
 */
gitpar.WorktreesView = function(mainView) {

    var self = this;
    self.branches = [];
    self.worktrees = [];
    self.filterText = "";
    // local_name of the branch whose inline "new worktree" row is open,
    // if any - only one at a time, same as the log view only ever has one
    // commit card open.
    self.creatingFor = null;

    self.show = function() {
        self.creatingFor = null;
        self.filterText = "";
        $(".worktrees-view-filter", self.element).val("");
        self.refresh();
        mainView.switchTo(self.element);
    }

    self.close = function() {
        mainView.repoChrome.showHistory();
    }

    self.refresh = function() {
        gitpar.apiGet("/api/branches", function(branchData) {
            self.branches = (branchData.branches || []).filter(function(branch) {
                return !!branch.local_name;
            });
            gitpar.apiGet("/api/worktrees", function(worktreeData) {
                self.worktrees = worktreeData.worktrees || [];
                self.render();
            });
        });
    }

    self.worktreeFor = function(localName) {
        return self.worktrees.filter(function(worktree) {
            return !worktree.detached && worktree.branch == localName;
        })[0] || null;
    }

    self.matchesFilter = function(branch) {
        if (!self.filterText) {
            return true;
        }
        return branch.local_name.toLowerCase().indexOf(self.filterText) != -1;
    }

    self.render = function() {
        var list = $(".worktrees-view-list", self.element);
        list.empty();
        var matchedPaths = {};
        var shown = 0;
        self.branches.forEach(function(branch) {
            if (!self.matchesFilter(branch)) {
                return;
            }
            shown++;
            var worktree = self.worktreeFor(branch.local_name);
            if (worktree) {
                matchedPaths[worktree.path] = true;
            }
            list.append(self.buildRow(branch, worktree));
        });
        if (shown == 0) {
            list.append('<div class="worktrees-view-empty">No branches match this filter.</div>');
        }
        self.renderOtherWorktrees(matchedPaths);
    }

    // Worktrees that don't belong to any branch shown above - a detached
    // one, most likely. Rare enough that it earns a plain, quiet section
    // rather than a row of its own kind everywhere else, and stays
    // entirely out of the way when there is nothing to put in it.
    self.renderOtherWorktrees = function(matchedPaths) {
        var section = $(".worktrees-view-other", self.element);
        section.empty();
        var others = self.worktrees.filter(function(worktree) {
            return !matchedPaths[worktree.path];
        });
        section.toggle(others.length > 0);
        if (others.length == 0) {
            return;
        }
        section.append('<div class="worktrees-view-other-label">Other worktrees</div>');
        others.forEach(function(worktree) {
            var row = $('<div class="worktrees-view-other-row"></div>');
            row.append($('<span class="wtv-path">').attr("title", worktree.path).text(worktree.path));
            row.append($('<span class="wtv-none">').text(worktree.detached ? "(detached)" : (worktree.branch || "")));
            var removeBtn = $('<button type="button" class="wtv-link-btn quiet">Remove</button>');
            var isMainWorktree = worktree.path == gitpar.repoPath;
            removeBtn.prop("disabled", isMainWorktree);
            removeBtn.click(function() {
                self.removeWorktree(worktree.path);
            });
            row.append(removeBtn);
            section.append(row);
        });
    }

    self.buildRow = function(branch, worktree) {
        var barClass = branch.current ? "current" : "local";
        var row = $(  '<div class="wtv-row">' +
                            '<div class="wtv-row-bar ' + barClass + '">' +
                                '<span class="wtv-row-name"></span>' +
                            '</div>' +
                            '<div class="wtv-cell"></div>' +
                        '</div>');
        $(".wtv-row-name", row).text(branch.local_name);
        if (branch.current) {
            $(".wtv-row-bar", row).append('<span class="wtv-row-check" title="Current branch">&#10003;</span>');
        }

        var cell = $(".wtv-cell", row);
        var isMainWorktree = worktree && worktree.path == gitpar.repoPath;
        if (branch.current || isMainWorktree) {
            // The worktree this app is itself running from - never
            // offered for removal, and there's nothing useful to copy
            // that the reader doesn't already know.
            cell.append($('<span class="wtv-none">').text("— you're standing in this one"));
        } else if (worktree) {
            cell.append($('<span class="wtv-path">').attr("title", worktree.path).text(worktree.path));
            var copyBtn = $('<button type="button" class="wtv-link-btn">Copy path</button>');
            copyBtn.click(function() {
                gitpar.copyToClipboard(worktree.path, "Worktree path");
            });
            cell.append(copyBtn);
            var removeBtn = $('<button type="button" class="wtv-link-btn quiet">Remove</button>');
            removeBtn.click(function() {
                self.removeWorktree(worktree.path);
            });
            cell.append(removeBtn);
        } else if (self.creatingFor == branch.local_name) {
            cell.addClass("editing");
            cell.append(self.buildCreateForm(branch));
        } else {
            cell.append($('<span class="wtv-none">').text("no worktree"));
            var startBtn = $('<button type="button" class="wtv-link-btn">+ New Worktree</button>');
            startBtn.click(function() {
                self.creatingFor = branch.local_name;
                self.render();
            });
            cell.append(startBtn);
        }
        return row;
    }

    self.buildCreateForm = function(branch) {
        var suggested = gitpar.suggestWorktreePath(gitpar.repoPath, branch.local_name);
        var form = $(  '<div class="wtv-inline-create">' +
                            '<input type="text" class="wtv-path-input">' +
                            '<button type="button" class="btn btn-primary btn-xs wtv-create-btn">Create</button>' +
                            '<button type="button" class="wtv-link-btn quiet wtv-cancel-btn">Cancel</button>' +
                        '</div>');
        $(".wtv-path-input", form).val(suggested);
        $(".wtv-create-btn", form).click(function() {
            self.addWorktree(branch.local_name, $(".wtv-path-input", form).val(), false, null);
        });
        $(".wtv-cancel-btn", form).click(function() {
            self.creatingFor = null;
            self.render();
        });
        return form;
    }

    self.addWorktree = function(branchName, path, createBranch, startPoint) {
        if (!path || !path.trim()) {
            return;
        }
        gitpar.apiPost("/api/worktrees/add", {
            path: path.trim(),
            branch: branchName,
            create_branch: !!createBranch,
            start_point: startPoint,
        }, function() {
            self.creatingFor = null;
            self.refresh();
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to add worktree"));
        });
    }

    self.removeWorktree = function(path) {
        if (!window.confirm("Remove worktree at '" + path + "'?")) {
            return;
        }
        gitpar.apiPost("/api/worktrees/remove", {path: path, force: true}, function() {
            self.refresh();
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to remove worktree"));
        });
    }

    // Starting a new branch is a different intent from reattaching to one
    // that already exists, so it keeps its own control rather than living
    // inside a row that doesn't exist yet - mirroring "Create branch
    // here" elsewhere in the app, which is the same two-step shape: name
    // the branch, then confirm where.
    self.onNewBranch = function() {
        var branchName = window.prompt("New branch name");
        if (!branchName || !branchName.trim()) {
            return;
        }
        branchName = branchName.trim();
        var suggested = gitpar.suggestWorktreePath(gitpar.repoPath, branchName);
        var path = window.prompt("Worktree path for '" + branchName + "'", suggested);
        if (!path || !path.trim()) {
            return;
        }
        self.addWorktree(branchName, path, true, gitpar.historyRef || "HEAD");
    }

    self.onFilterInput = function(event) {
        self.filterText = event.currentTarget.value.toLowerCase();
        self.render();
    }

    self.element = $(   '<div id="worktrees-view">' +
                            '<div class="worktrees-view-head">' +
                                '<div>' +
                                    '<div class="repo-picker-eyebrow">Worktrees</div>' +
                                    '<h4 class="worktrees-view-title">Manage Worktrees</h4>' +
                                '</div>' +
                                '<button type="button" class="btn btn-default btn-sm worktrees-view-close">Close</button>' +
                            '</div>' +
                            '<div class="worktrees-view-toolbar">' +
                                '<input type="text" class="form-control input-sm worktrees-view-filter" placeholder="Find a branch">' +
                            '</div>' +
                            '<div class="worktrees-view-header">' +
                                '<div class="worktrees-view-header-branch">Branch</div>' +
                                '<div class="worktrees-view-header-worktree">Worktree</div>' +
                            '</div>' +
                            '<div class="worktrees-view-list"></div>' +
                            '<div class="worktrees-view-other"></div>' +
                            '<div class="worktrees-view-footer">' +
                                '<button type="button" class="wtv-link-btn worktrees-view-new-branch">+ New worktree with a new branch&hellip;</button>' +
                            '</div>' +
                        '</div>')[0];
    $(".worktrees-view-filter", self.element).on("input", self.onFilterInput);
    $(".worktrees-view-close", self.element).click(self.close);
    $(".worktrees-view-new-branch", self.element).click(self.onNewBranch);
};

/*
 * == StashesView ================================================================
 */
gitpar.StashesView = function(mainView) {

    var self = this;

    self.refresh = function() {
        gitpar.apiGet("/api/stashes", function(data) {
            self.render(data.stashes || []);
        });
    }

    self.render = function(stashes) {
        var list = $(".stashes-list", self.element);
        list.empty();
        if (stashes.length == 0) {
            list.append('<div class="toolbar-menu-empty">No stashes.</div>');
        }
        stashes.forEach(function(stash) {
            var row = $(  '<div class="stashes-row">' +
                                '<div class="stashes-row-message"></div>' +
                                '<div class="stashes-row-meta"></div>' +
                                '<div class="stashes-row-actions">' +
                                    '<button type="button" class="btn btn-default btn-xs stashes-pop">Pop</button>' +
                                    '<button type="button" class="btn btn-default btn-xs stashes-apply">Apply</button>' +
                                    '<button type="button" class="btn btn-danger btn-xs stashes-drop">Drop</button>' +
                                '</div>' +
                            '</div>');
            $(".stashes-row-message", row).text(stash.message);
            $(".stashes-row-meta", row).text(stash.ref + " • " + stash.author + " • " + stash.date);
            $(".stashes-pop", row).click(function() { self.apply(stash.ref, true); });
            $(".stashes-apply", row).click(function() { self.apply(stash.ref, false); });
            $(".stashes-drop", row).click(function() {
                if (!window.confirm("Drop stash '" + stash.message + "'?")) {
                    return;
                }
                gitpar.apiPost("/api/stashes/drop", {ref: stash.ref}, function(data) {
                    self.render(data.stashes || []);
                }, function(xhr) {
                    gitpar.showError(gitpar.parseApiError(xhr, "Unable to drop stash"));
                });
            });
            list.append(row);
        });
    }

    self.apply = function(ref, pop) {
        gitpar.apiPost("/api/stashes/apply", {ref: ref, pop: pop}, function(data) {
            gitpar.showResult(pop ? "Stash popped" : "Stash applied", data.message || "");
            $(self.element).modal("hide");
            if (mainView.workspaceView) {
                mainView.workspaceView.update("stage");
            }
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to apply stash"));
        });
    }

    self.show = function() {
        self.refresh();
        $(self.element).modal("show");
    }

    self.element = $(   '<div class="modal fade" id="stashes-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Stashes</div>' +
                                        '<h4 class="modal-title">Stashes</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<div class="stashes-list"></div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $("body").append(self.element);
};

/*
 * == ReflogView ================================================================
 */
gitpar.ReflogView = function(mainView) {

    var self = this;

    self.refresh = function() {
        gitpar.apiGet("/api/reflog", function(data) {
            self.render(data.entries || []);
        });
    }

    self.render = function(entries) {
        var list = $(".reflog-list", self.element);
        list.empty();
        if (entries.length == 0) {
            list.append('<div class="toolbar-menu-empty">No reflog entries.</div>');
        }
        entries.forEach(function(entry) {
            var row = $(  '<div class="reflog-row">' +
                                '<div class="reflog-row-selector"></div>' +
                                '<div class="reflog-row-action"></div>' +
                                '<div class="reflog-row-date"></div>' +
                                '<button type="button" class="btn btn-default btn-xs reflog-reset">Reset here</button>' +
                            '</div>');
            $(".reflog-row-selector", row).text(entry.selector);
            $(".reflog-row-action", row).text(entry.action);
            $(".reflog-row-date", row).text(entry.date);
            $(".reflog-reset", row).click(function() {
                if (!window.confirm("Hard reset the current branch to " + entry.selector + " (" + entry.action + ")? This cannot be undone.")) {
                    return;
                }
                gitpar.git("reset --hard " + entry.commit, function() {
                    gitpar.showResult("Reset complete", "Reset to " + entry.selector);
                    $(self.element).modal("hide");
                    gitpar.reloadWithPostAction("history");
                });
            });
            list.append(row);
        });
    }

    self.show = function() {
        self.refresh();
        $(self.element).modal("show");
    }

    self.element = $(   '<div class="modal fade" id="reflog-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog modal-lg" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Reflog</div>' +
                                        '<h4 class="modal-title">HEAD Reflog</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<div class="reflog-list"></div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $("body").append(self.element);
};

/*
 * == SubmodulesView =============================================================
 */
gitpar.SubmodulesView = function(mainView) {

    var self = this;

    self.refresh = function() {
        gitpar.apiGet("/api/submodules", function(data) {
            self.render(data.submodules || []);
        });
    }

    self.render = function(submodules) {
        var list = $(".submodules-list", self.element);
        list.empty();
        if (submodules.length == 0) {
            list.append('<div class="toolbar-menu-empty">No submodules in this repository.</div>');
        }
        submodules.forEach(function(submodule) {
            var row = $(  '<div class="submodules-row">' +
                                '<div class="submodules-row-path"></div>' +
                                '<div class="submodules-row-status"></div>' +
                            '</div>');
            $(".submodules-row-path", row).text(submodule.path);
            $(".submodules-row-status", row).text(submodule.status.replace("_", " ") + (submodule.describe ? " (" + submodule.describe + ")" : ""));
            list.append(row);
        });
    }

    self.onUpdateAll = function() {
        gitpar.apiPost("/api/submodules/update", {init: true}, function(data) {
            gitpar.showResult("Submodules updated", "Ran submodule update --init --recursive");
            self.render(data.submodules || []);
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to update submodules"));
        });
    }

    self.show = function() {
        self.refresh();
        $(self.element).modal("show");
    }

    self.element = $(   '<div class="modal fade" id="submodules-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Submodules</div>' +
                                        '<h4 class="modal-title">Submodules</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<div class="submodules-list"></div>' +
                                        '<button type="button" class="btn btn-primary btn-sm submodules-update-all">Update All (init + recursive)</button>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $(".submodules-update-all", self.element).click(self.onUpdateAll);
    $("body").append(self.element);
};

/*
 * == InteractiveRebaseView =======================================================
 * A scoped interactive rebase editor: reorder is implicit in the list order,
 * plus per-commit Pick/Squash/Drop. Reword is intentionally not supported -
 * it would need a second pause/resume round trip with the rebase process.
 */
gitpar.InteractiveRebaseView = function(mainView) {

    var self = this;

    self.show = function(base) {
        self.base = base;
        gitpar.git("log --format=%H%x09%s --date-order " + base + "..HEAD --", function(data) {
            var commits = gitpar.splitLines(data).filter(function(line) { return line.length > 0; }).map(function(line) {
                var parts = line.split("\t");
                return { commit: parts[0], message: parts[1] || "" };
            });
            commits.reverse(); // oldest first, matching rebase todo order
            self.render(commits);
            $(self.element).modal("show");
        });
    }

    self.render = function(commits) {
        $(".interactive-rebase-base", self.element).text(self.base);
        var list = $(".interactive-rebase-list", self.element);
        list.empty();
        if (commits.length == 0) {
            list.append('<div class="toolbar-menu-empty">HEAD is already up to date with ' + gitpar.escapeHtml(self.base) + '.</div>');
            return;
        }
        commits.forEach(function(commit) {
            var row = $(  '<div class="interactive-rebase-row">' +
                                '<select class="form-control input-sm interactive-rebase-action">' +
                                    '<option value="pick">Pick</option>' +
                                    '<option value="squash">Squash</option>' +
                                    '<option value="drop">Drop</option>' +
                                '</select>' +
                                '<span class="interactive-rebase-hash"></span>' +
                                '<span class="interactive-rebase-message"></span>' +
                            '</div>');
            row[0].commitSha = commit.commit;
            $(".interactive-rebase-hash", row).text(commit.commit.substr(0, 7));
            $(".interactive-rebase-message", row).text(commit.message);
            list.append(row);
        });
    }

    self.onRun = function() {
        var actions = [];
        $(".interactive-rebase-row", self.element).each(function() {
            actions.push({ commit: this.commitSha, action: $(".interactive-rebase-action", this).val() });
        });
        if (actions.length == 0) {
            return;
        }
        if (!window.confirm("Rewrite " + actions.length + " commit(s) onto " + self.base + "? This rewrites history.")) {
            return;
        }
        gitpar.apiPost("/api/rebase/plan", {base: self.base, actions: actions}, function(data) {
            gitpar.showResult("Rebase completed", data.message || "");
            $(self.element).modal("hide");
            gitpar.reloadWithPostAction("history");
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Rebase failed"));
        });
    }

    self.element = $(   '<div class="modal fade" id="interactive-rebase-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog modal-lg" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Interactive Rebase</div>' +
                                        '<h4 class="modal-title">Rebase HEAD onto <span class="interactive-rebase-base"></span></h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<p class="repo-picker-hint">Commits are listed oldest first, applied in this order. Reordering rows is not supported yet; use Drop to remove a commit and Squash to fold it into the one above.</p>' +
                                        '<div class="interactive-rebase-list"></div>' +
                                        '<button type="button" class="btn btn-primary btn-sm interactive-rebase-run">Rebase</button>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $(".interactive-rebase-run", self.element).click(self.onRun);
    $("body").append(self.element);
};

gitpar.NoRepoView = function(mainView) {

    var self = this;

    self.element = $(   '<div id="no-repo-view" class="jumbotron">' +
                            '<div class="no-repo-kicker">Local Git Dashboard</div>' +
                            '<h1>Choose a repository</h1>' +
                            '<p>Start from recent repositories, or open a folder of repos to build a multi-repo workspace without restarting git-gitpar.</p>' +
                            '<p><button type="button" class="btn btn-primary btn-lg no-repo-browse">Browse Repo</button> <button type="button" class="btn btn-default btn-lg no-repo-workspace">Open Repo Folder</button></p>' +
                        '</div>')[0];

    $(".no-repo-browse", self.element).click(function() {
        mainView.repoPicker.openNative(null, "repo");
    });
    $(".no-repo-workspace", self.element).click(function() {
        mainView.repoPicker.openNative(null, "workspace");
    });
};

gitpar.TabBox = function(buttons) {

    var self = this;

    self.itemClicked = function(event) {
        self.updateSelection(event.target.parentElement);
    }

    self.select = function(index) {
        self.updateSelection(self.element.children[index]);
    }

    self.updateSelection = function(elt) {
        $(".active", self.element).removeClass("active");
        $(elt).addClass("active");
        elt.callback();
    }

    self.element = $('<ul class="nav nav-pills nav-justified" role="tablist">')[0];

    for (var i = 0; i < buttons.length; ++i) {
        var item = buttons[i];
        var li = $('<li><a href="#">' + item[0] + '</a></li>');
        li.appendTo(self.element);
        li.click(self.itemClicked);
        li[0].callback = item[1];
    }
};

/*
 * == RefActionMenu ============================================================
 */
gitpar.RefActionMenu = function(mainView) {

    var self = this;

    self.hide = function() {
        $(self.element).removeClass("open").hide();
        self.context = null;
    }

    self.addAction = function(label, callback, disabled, extraClass) {
        var button = $('<button type="button" class="btn btn-link ref-action-menu-item">' + label + '</button>');
        if (extraClass) {
            button.addClass(extraClass);
        }
        button.prop("disabled", !!disabled);
        button.click(function(event) {
            event.preventDefault();
            event.stopPropagation();
            self.hide();
            if (!disabled) {
                callback();
            }
        });
        self.list.append(button);
    }

    self.render = function(refInfo, entry) {
        var branch = gitpar.findBranchByRef(refInfo);
        var current = gitpar.getCurrentBranch();
        var isCurrentLocal = branch && branch.current && branch.local_name;
        var mergeDisabled = gitpar.viewonly || !current || !current.local_name || isCurrentLocal;

        $(".ref-action-menu-title", self.element).text(refInfo.displayName || refInfo.gitRef || refInfo.fullName || "Ref");
        $(".ref-action-menu-subtitle", self.element).text(entry.commit.substr(0, 12));
        self.list.empty();

        self.addAction("View this ref only", function() {
            mainView.repoChrome.focusHistoryRef(refInfo.gitRef);
        }, !refInfo.gitRef);
        self.addAction("Return to all refs", function() {
            mainView.repoChrome.focusHistoryRef(null);
        }, false);

        if (refInfo.kind == "local") {
            self.addAction("Checkout", function() {
                mainView.repoChrome.checkoutRef(refInfo.gitRef, null);
            }, gitpar.viewonly || isCurrentLocal);
        } else if (refInfo.kind == "remote") {
            // findBranchByRef pairs a remote ref with a local branch of
            // the same name even without upstream tracking configured -
            // the same match `git checkout --track` itself refuses once
            // it exists, since it would collide with that branch name.
            // Local and remote pointing at different commits (the
            // remote ahead, say) doesn't change any of that: checking
            // out an existing branch never needs it to match its
            // upstream first, so there is nothing here to resolve
            // before switching to it.
            if (branch && branch.local_name) {
                self.addAction("Checkout", function() {
                    mainView.repoChrome.checkoutRef(branch.local_name, null);
                }, gitpar.viewonly || isCurrentLocal);
            } else {
                self.addAction("Checkout tracking branch", function() {
                    mainView.repoChrome.checkoutRef(null, refInfo.gitRef);
                }, gitpar.viewonly);
            }
        }

        self.addAction("Create branch here", function() {
            mainView.repoChrome.createBranchAtRef(refInfo.gitRef || entry.commit, refInfo.displayName + "-copy");
        }, gitpar.viewonly);
        self.addAction("Create tag here", function() {
            mainView.repoChrome.createTagAtRef(refInfo.gitRef || entry.commit, refInfo.displayName + "-tag");
        }, gitpar.viewonly);

        self.addAction("Hide other branches", function() {
            gitpar.setRefChipFilter(refInfo.displayName);
        }, !refInfo.displayName);
        self.addAction("Show All Branches", function() {
            gitpar.setRefChipFilter(null);
        }, !gitpar.refChipFilterName);

        if (refInfo.kind == "local" || refInfo.kind == "remote") {
            self.addAction("Compare to current branch", function() {
                mainView.repoChrome.compareRef(refInfo.gitRef);
            }, !current || !current.local_name || isCurrentLocal);
            self.addAction("Merge into current branch", function() {
                mainView.repoChrome.mergeRef(refInfo.gitRef, false);
            }, mergeDisabled);
            self.addAction("Squash into current branch", function() {
                mainView.repoChrome.mergeRef(refInfo.gitRef, true);
            }, mergeDisabled);
        }

        if (refInfo.kind == "local") {
            self.addAction("Delete local branch", function() {
                mainView.repoChrome.removeBranch(refInfo.gitRef);
            }, gitpar.viewonly || !branch || !branch.can_delete, "danger");
        } else if (refInfo.kind == "remote") {
            // Not gated on branch.can_delete - that flag describes
            // whether the paired *local* branch can be deleted (not the
            // one currently checked out), which has nothing to do with
            // deleting the remote ref. The only real constraint here is
            // push access, which isn't known ahead of time; git reports
            // it if the push --delete is rejected.
            self.addAction("Delete " + refInfo.gitRef, function() {
                mainView.repoChrome.removeRemoteBranch(refInfo.gitRef);
            }, gitpar.viewonly, "danger");
        }

        if (refInfo.kind == "local" || refInfo.kind == "remote") {
            self.addAction("Interactive Rebase onto here&hellip;", function() {
                mainView.interactiveRebaseView.show(refInfo.gitRef);
            }, gitpar.viewonly);
        }

        self.addAction("Copy ref name", function() {
            gitpar.copyToClipboard(refInfo.gitRef || refInfo.fullName, "Ref name");
        }, !(refInfo.gitRef || refInfo.fullName));
        self.addAction("Copy commit hash", function() {
            gitpar.copyToClipboard(entry.commit, "Commit hash");
        }, !entry.commit);
        self.addAction("Configure Remotes", function() {
            mainView.configureRemotesView.show();
        }, gitpar.viewonly);
    }

    self.show = function(anchor, refInfo, entry) {
        self.context = { refInfo: refInfo, entry: entry };
        self.render(refInfo, entry);
        $(self.element).show().addClass("open");

        var rect = anchor.getBoundingClientRect();
        var top = rect.bottom + 8;
        var left = rect.left;
        var padding = 12;
        var menuWidth = self.element.offsetWidth;
        var menuHeight = self.element.offsetHeight;

        if (left + menuWidth > window.innerWidth - padding) {
            left = window.innerWidth - menuWidth - padding;
        }
        if (left < padding) {
            left = padding;
        }
        if (top + menuHeight > window.innerHeight - padding) {
            top = rect.top - menuHeight - 8;
        }
        if (top < padding) {
            top = padding;
        }

        self.element.style.top = top + "px";
        self.element.style.left = left + "px";
    }

    self.element = $(   '<div class="ref-action-menu">' +
                            '<div class="ref-action-menu-header">' +
                                '<div class="ref-action-menu-title"></div>' +
                                '<div class="ref-action-menu-subtitle"></div>' +
                            '</div>' +
                            '<div class="ref-action-menu-list"></div>' +
                        '</div>')[0];
    self.list = $(".ref-action-menu-list", self.element);
    $(document).on("click", function() {
        self.hide();
    });
    $(document).on("keydown", function(event) {
        if (event.key == "Escape") {
            self.hide();
        }
    });
    $(window).on("resize scroll", function() {
        self.hide();
    });
    $(self.element).on("click", function(event) {
        event.stopPropagation();
    });
    $("body").append(self.element);
    self.hide();
};

/*
 * == CommitActionMenu =========================================================
 * The hover "⋮ show commit menu" popup for a single commit row.
 */
gitpar.CommitActionMenu = function(mainView) {

    var self = this;

    self.hide = function() {
        $(self.element).removeClass("open").hide();
        self.entry = null;
    }

    self.addAction = function(label, callback, disabled, extraClass) {
        var button = $('<button type="button" class="btn btn-link ref-action-menu-item">' + label + '</button>');
        if (extraClass) {
            button.addClass(extraClass);
        }
        button.prop("disabled", !!disabled);
        button.click(function(event) {
            event.preventDefault();
            event.stopPropagation();
            self.hide();
            if (!disabled) {
                callback();
            }
        });
        self.list.append(button);
    }

    // A stash's actions don't overlap the generic commit ones at all -
    // there's no branch/tag to make from it and nothing to cherry-pick
    // or revert (a stash is 2-3 parents deep with synthetic index/
    // untracked-file commits, not a normal single change) - so a stash
    // row gets its own menu entirely, matching what actually applies.
    self.renderStashActions = function(stash) {
        self.addAction("Unstash Changes", function() {
            self.applyStash(stash, true);
        }, gitpar.viewonly);
        self.addAction("Unstash Changes and Keep Stash", function() {
            self.applyStash(stash, false);
        }, gitpar.viewonly);
        self.addAction("Discard Stash", function() {
            if (!window.confirm("Discard stash '" + stash.message + "'? This cannot be undone.")) {
                return;
            }
            gitpar.apiPost("/api/stashes/drop", { ref: stash.ref }, function() {
                self.afterStashChange();
            }, function(xhr) {
                gitpar.showError(gitpar.parseApiError(xhr, "Unable to discard stash"));
            });
        }, gitpar.viewonly, "danger");
    }

    self.applyStash = function(stash, pop) {
        gitpar.apiPost("/api/stashes/apply", { ref: stash.ref, pop: pop }, function(data) {
            gitpar.showResult(pop ? "Stash popped" : "Stash applied", data.message || "");
            self.afterStashChange();
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to apply stash"));
        });
    }

    // Popping or dropping changes the stash list itself (gitpar.stashes,
    // which the log seeds its walk with to draw one row per stash - see
    // LogView.populate) - refetching that before redrawing is what
    // makes the row for this stash actually disappear, the same
    // sequencing a remote action already uses (loadBranches, then
    // redraw whatever section is showing).
    self.afterStashChange = function() {
        mainView.repoChrome.loadBranches(function() {
            mainView.repoChrome.refreshActiveSection();
        });
    }

    self.render = function(entry) {
        $(".ref-action-menu-title", self.element).text(entry.abbrevMessage());
        $(".ref-action-menu-subtitle", self.element).text(entry.commit.substr(0, 12));
        self.list.empty();

        if (entry.stash) {
            self.renderStashActions(entry.stash);
            return;
        }

        self.addAction("Create Branch Here…", function() {
            mainView.repoChrome.createBranchAtRef(entry.commit, entry.commit.substr(0, 8) + "-branch");
        }, gitpar.viewonly);
        self.addAction("Create Tag Here…", function() {
            mainView.repoChrome.createTagAtRef(entry.commit, entry.commit.substr(0, 8) + "-tag");
        }, gitpar.viewonly);
        self.addAction("Show all commits by " + entry.author.name, function() {
            mainView.historyView.showCommitsByAuthor(entry.author.name);
        }, false);

        gitpar.apiGet("/api/commits/" + entry.commit + "/is-ancestor", function(data) {
            if (data.is_ancestor) {
                self.addAction("Revert Changes in this Commit…", function() {
                    if (!window.confirm("Revert commit " + entry.commit.substr(0, 8) + "?")) {
                        return;
                    }
                    gitpar.git("revert --no-edit " + entry.commit, function() {
                        gitpar.showResult("Revert completed", "Reverted " + entry.commit.substr(0, 8));
                        mainView.historyView.update(gitpar.historyRef);
                    });
                }, gitpar.viewonly, "danger");
            } else {
                self.addAction("Cherry-pick Changes in this Commit…", function() {
                    gitpar.git("cherry-pick " + entry.commit, function() {
                        gitpar.showResult("Cherry-pick completed", "Cherry-picked " + entry.commit.substr(0, 8));
                        mainView.historyView.update(gitpar.historyRef);
                    });
                }, gitpar.viewonly);
            }
        });

        self.addAction("Copy commit hash", function() {
            gitpar.copyToClipboard(entry.commit, "Commit hash");
        }, !entry.commit);
    }

    self.show = function(anchor, entry) {
        self.entry = entry;
        self.render(entry);
        $(self.element).show().addClass("open");

        var rect = anchor.getBoundingClientRect();
        var top = rect.bottom + 8;
        var left = rect.left;
        var padding = 12;
        var menuWidth = self.element.offsetWidth;
        var menuHeight = self.element.offsetHeight;

        if (left + menuWidth > window.innerWidth - padding) {
            left = window.innerWidth - menuWidth - padding;
        }
        if (left < padding) {
            left = padding;
        }
        if (top + menuHeight > window.innerHeight - padding) {
            top = rect.top - menuHeight - 8;
        }
        if (top < padding) {
            top = padding;
        }

        self.element.style.top = top + "px";
        self.element.style.left = left + "px";
    }

    self.element = $(   '<div class="ref-action-menu">' +
                            '<div class="ref-action-menu-header">' +
                                '<div class="ref-action-menu-title"></div>' +
                                '<div class="ref-action-menu-subtitle"></div>' +
                            '</div>' +
                            '<div class="ref-action-menu-list"></div>' +
                        '</div>')[0];
    self.list = $(".ref-action-menu-list", self.element);
    $(document).on("click", function() {
        self.hide();
    });
    $(document).on("keydown", function(event) {
        if (event.key == "Escape") {
            self.hide();
        }
    });
    $(window).on("resize scroll", function() {
        self.hide();
    });
    $(self.element).on("click", function(event) {
        event.stopPropagation();
    });
    $("body").append(self.element);
    self.hide();
};

/*
 * == SearchOverlay =============================================================
 * The Ctrl+F "Search commits, branches or users" overlay.
 */
gitpar.SearchOverlay = function(mainView) {

    var self = this;

    self.hide = function() {
        $(self.element).removeClass("open").hide();
        $(".search-overlay-input", self.element).val("");
        self.applyFilter("");
    }

    self.show = function() {
        $(self.element).show().addClass("open");
        $(".search-overlay-input", self.element).val("").focus();
    }

    self.applyFilter = function(query) {
        query = (query || "").toLowerCase();
        $(".log-entry", document).each(function() {
            var haystack = $(this).text().toLowerCase() + " " + ($(".log-entry-avatar", this).attr("title") || "").toLowerCase();
            $(this).toggle(!query || haystack.indexOf(query) != -1);
        });
        $(".branches-row", document).each(function() {
            $(this).toggle(!query || $(this).text().toLowerCase().indexOf(query) != -1);
        });
    }

    self.onInput = function(event) {
        self.applyFilter(event.currentTarget.value);
    }

    self.element = $(   '<div class="search-overlay">' +
                            '<input type="text" class="search-overlay-input" placeholder="Search commits, branches or users">' +
                        '</div>')[0];
    $(".search-overlay-input", self.element).on("input", self.onInput);
    $(self.element).click(function(event) {
        if (event.target == self.element) {
            self.hide();
        }
    });
    $(document).on("keydown", function(event) {
        if (event.key == "Escape") {
            self.hide();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() == "f" && !gitpar.viewonly) {
            event.preventDefault();
            self.show();
        }
    });
    $("body").append(self.element);
    self.hide();
};

/*
 * == LogView =================================================================
 */
gitpar.LogView = function(historyView) {

    var self = this;

    // Bumped on every update() so a populate() response that arrives after
    // a newer update() has already reset the view (e.g. the stash-seed
    // refresh in Toolbar.loadBranches racing the initial render) can tell
    // it's stale and skip appending its rows onto the wrong generation.
    self.populateGeneration = 0;

    self.update = function(ref) {
        $(svg).empty();
        streams = []
        $(content).empty();
        currentSelection = null;
        self.ref = ref || null;
        self.nextSkip = 0;
        self.lastShownDate = null;
        self.populateGeneration++;
        self.populate();
    };

    self.populate = function(isRetry) {
        var generation = self.populateGeneration;
        var maxCount = 1000;
        if (content.childElementCount > 0) {
            // The last node is the 'Show more commits placeholder'. Remove it.
            content.removeChild(content.lastElementChild);
        }
        var startAt = content.childElementCount;
        // HEAD, not --all: the unfiltered "everything" view is still just
        // the checked-out branch's own history (what GitFiend and every
        // other git GUI show by default) - --all pulls in every other
        // local/remote branch and tag too, so any repo with more than
        // one active branch got their commits interleaved by date into
        // what looked like a single linear history, misrepresenting
        // ancestry that was never actually there (particularly visible
        // after a squash-merge, whose original commits live on only via
        // whatever branch made them, not as ancestors of the merge
        // commit on this branch).
        var refSpec = self.ref ? self.ref : "HEAD";
        // Seeded with the stash SHAs below regardless of refSpec, which
        // surfaces their raw internal commits (a stash's "index" and
        // "untracked" parents) as ordinary, unmarked rows unless hidden.
        // Only when showing everything: focusing one ref shouldn't drag
        // in stashes taken from somewhere else.
        self.stashCommits = {};
        self.hiddenCommits = {};
        var seededStash = false;
        // gitpar.stashes starts out (and briefly stays, on first load or
        // right after switching repos) empty before it's actually been
        // fetched for this repo - seeding from it then would silently skip
        // real stashes rather than draw them wrong, so wait for real data.
        self.stashSeedPending = !self.ref && !gitpar.branchesLoaded;
        if (!self.ref && gitpar.branchesLoaded) {
            (gitpar.stashes || []).forEach(function(stash) {
                self.stashCommits[stash.commit] = stash;
                refSpec += " " + stash.commit;
                seededStash = true;
                // Seeding the walk with a stash drags in the index and
                // untracked commits it records. They aren't history, and
                // they can't be excluded with --not without also
                // excluding the real commit the stash was taken from,
                // so they are dropped as the log is parsed.
                (stash.internal_parents || []).forEach(function(sha) {
                    self.hiddenCommits[sha] = true;
                });
            });
        }
        var authorSpec = gitpar.historyAuthorFilter ? " --author=" + JSON.stringify(gitpar.historyAuthorFilter) : "";
        gitpar.git("log --date-order --pretty=raw --decorate=full --skip=" + self.nextSkip + " --max-count=" + (maxCount + 1) + " " + refSpec + authorSpec + " --", function(data) {
            if (generation !== self.populateGeneration) {
                // A newer update() reset and repopulated the view while
                // this request was in flight - appending now would
                // duplicate rows onto content that's already current.
                return;
            }
            var start = 0;
            var count = 0;
            self.nextSkip = undefined;
            while (true) {
                var end = data.indexOf("\ncommit ", start);
                if (end != -1) {
                    var len = end - start;
                } else {
                    var len = undefined;
                }
                var entry = new Entry(self, data.substr(start, len));
                if (self.hiddenCommits[entry.commit]) {
                    // A stash's index/untracked commit - not history.
                    if (len == undefined) {
                        break;
                    }
                    start = end + 1;
                    continue;
                }
                if (count < maxCount) {
                    content.appendChild(entry.element);
                    if (!self.lineHeight) {
                        self.lineHeight = Math.ceil($(entry.element).outerHeight() / 2) * 2;
                    }
                    // min-height, not height: a selected row expands in
                    // place to show its commit card, and the graph is
                    // drawn from real row geometry to follow it.
                    entry.element.style.minHeight = self.lineHeight + "px";
                } else {
                    self.nextSkip = startAt + maxCount;
                    break;
                }
                if (len == undefined) {
                    break;
                }
                start = end + 1;
                ++count;
            }
            svg.setAttribute("height", $(content).outerHeight());
            if (self.nextSkip != undefined) {
                var moreTag = $('<a class="log-entry log-entry-more list-group-item">');
                $('<a class="list-group-item-text">Show previous commits</a>').appendTo(moreTag[0]);
                moreTag.click(self.populate);
                moreTag.appendTo(content);
            }

            self.updateGraph(startAt);
            historyView.positionRefChips();
        }, function(message) {
            // A stash dropped/cleared outside the app (or pruned by gc
            // after being dropped) leaves its commit unreachable, so the
            // walk seeded with the cached stash SHA fails outright and
            // the whole list goes blank. Resync the stash cache and
            // retry once rather than leaving the view stuck.
            if (isRetry !== true && seededStash && /bad object/.test(message)) {
                historyView.mainView.repoChrome.loadBranches(function() {
                    self.populate(true);
                });
                return true;
            }
        });
    };

    self.selectedEntry = function() {
        return currentSelection;
    }

    // Closes the open commit and drops the selection entirely, which
    // selecting another commit doesn't do - that just moves it.
    self.collapseSelection = function() {
        if (!currentSelection) {
            return;
        }
        $(currentSelection.element).removeClass("active");
        currentSelection.closeCard();
        currentSelection = null;
    }

    // Walks to the neighbouring commit row, skipping the "show previous
    // commits" link and anything else without a model. Returns null at
    // either end of the list.
    self.adjacentEntry = function(entry, delta) {
        if (!entry || !entry.element) {
            return null;
        }
        var children = content.children;
        var index = -1;
        for (var i = 0; i < children.length; ++i) {
            if (children[i] == entry.element) {
                index = i;
                break;
            }
        }
        if (index == -1) {
            return null;
        }
        for (var j = index + delta; j >= 0 && j < children.length; j += delta) {
            if (children[j].model) {
                return children[j].model;
            }
        }
        return null;
    }

    // Where each commit's row sits inside the scrolling content, so the
    // ref sidebar can line its chips up with the commits they point at.
    self.commitOffsets = function() {
        var offsets = {};
        var contentTop = content.getBoundingClientRect().top;
        for (var i = 0; i < content.children.length; ++i) {
            var element = content.children[i];
            if (!element.model) {
                continue;
            }
            var anchor = element.querySelector("header") || element;
            var rect = anchor.getBoundingClientRect();
            offsets[element.model.commit] = rect.top - contentTop;
        }
        return offsets;
    }

    self.contentHeight = function() {
        return content.offsetHeight;
    }

    self.scrollTop = function() {
        return self.element.scrollTop;
    }

    // Slides the SVG over the reserved gutter. The gutter's position is
    // whatever the row's flex layout settles on, so it's read back from
    // a real row rather than assumed.
    self.alignGraphGutter = function(graphWidth) {
        var gutter = content.querySelector(".log-entry-graph");
        if (!gutter) {
            return;
        }
        var gutterRect = gutter.getBoundingClientRect();
        var left = gutterRect.left - content.getBoundingClientRect().left;
        svg.style.left = left + "px";
        svg.setAttribute("width", graphWidth);

        // How much of the right-hand side the graph and the date occupy.
        // An expanded card is held back by this so it stops short of the
        // gutter instead of covering the lanes beside it.
        var header = gutter.parentElement;
        if (header) {
            var inset = Math.max(0, header.getBoundingClientRect().right - gutterRect.left);
            // Set on the history view, not the log list, so the
            // changes card above the list inherits it too - it has to
            // stop short of the same gutter to line up with an open
            // commit below it.
            self.element.style.setProperty("--log-graph-inset", inset + "px");
            if (historyView && historyView.element) {
                historyView.element.style.setProperty("--log-graph-inset", inset + "px");
            }
        }
    }

    // Expanding or collapsing a card moves every row below it, so the
    // whole graph has to be redrawn rather than appended to.
    self.redrawGraph = function() {
        $(svg).empty();
        streams = [];
        streamColor = 0;
        self.updateGraph(0);
        svg.setAttribute("height", $(content).outerHeight());
        historyView.positionRefChips();
    }

    // Rows are no longer a uniform height (a selected row expands to
    // show its commit card), so the graph can't derive Y from
    // index * lineHeight any more. Measure the real position of each
    // row's header line up front, in one read pass, then draw - reading
    // geometry inside the draw loop would thrash layout on long lists.
    self.measureRowCenters = function(startAt) {
        var centers = [];
        var contentTop = content.getBoundingClientRect().top;
        for (var i = startAt; i < content.children.length; ++i) {
            var element = content.children[i];
            if (!element.model) {
                centers[i] = null;
                continue;
            }
            // Anchor on the header strip, not the middle of the row, so
            // the node stays on the commit line when the card is open.
            var anchor = element.querySelector("header") || element;
            var rect = anchor.getBoundingClientRect();
            centers[i] = rect.top - contentTop + rect.height / 2;
        }
        return centers;
    }

    self.updateGraph = function(startAt) {
        // Draw the graph
        var rowCenters = self.measureRowCenters(startAt);
        var currentY = (startAt + 0.5) * self.lineHeight;
        var maxLeft = 0;
        var xOffset = 12;
        if (startAt == 0) {
            streamColor = 0;
        }

        var newStreamPath = function() {
            var svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            ++streamColor;
            if (streamColor == gitpar.COLORS.length) {
                streamColor = 0;
            }
            svgPath.setAttribute("style", "stroke:" + gitpar.COLORS[streamColor]);
            svg.appendChild(svgPath);
            return svgPath;
        };
        for (var i = startAt; i < content.children.length; ++i) {
            var entry = content.children[i].model;
            if (!entry) {
                continue;
            }
            if (rowCenters[i] != null) {
                currentY = rowCenters[i];
            }
            var index = 0;
            entry.element.gitparLeft = streams.length;

            // Find streams to join
            var childCount = 0;
            var removedStreams = 0;
            for (var j = 0; j < streams.length;) {
                var stream = streams[j];
                if (stream.sha1 == entry.commit) {
                    if (childCount == 0) {
                        // Replace the stream
                        stream.path.setAttribute("d", stream.path.cmds + currentY);
                        if (entry.parents.length == 0) {
                            streams.splice(j, 1);
                        } else {
                            stream.sha1 = entry.parents[0];
                        }
                        index = j;
                        ++j;
                    } else {
                        // Join the stream
                        var x = (index + 1) * xOffset;
                        stream.path.setAttribute("d", stream.path.cmds + (currentY - self.lineHeight / 2) + " L " + x + " " + currentY);
                        streams.splice(j, 1);
                        ++removedStreams;
                    }
                    ++childCount;
                } else {
                    if (removedStreams != 0) {
                        var x = (j + 1) * xOffset;
                        stream.path.setAttribute("d", stream.path.cmds + (currentY - self.lineHeight / 2) + " L " + x + " " + currentY);
                    }
                    ++j;
                }
            }

            // No open stream was waiting on this commit, so it is the tip
            // of a branch nothing in the list descends from. It needs a
            // lane of its own: falling through with index 0 used to drop
            // it onto whichever unrelated branch happened to hold lane 0,
            // drawing branches as if they converged on the newest commit.
            if (childCount == 0) {
                index = streams.length;
                if (entry.parents.length > 0) {
                    var tipX = (index + 1) * xOffset;
                    var tipPath = newStreamPath();
                    tipPath.cmds = "M " + tipX + " " + currentY + " L " + tipX + " ";
                    streams.splice(index, 0, { sha1: entry.parents[0], path: tipPath });
                }
            }

            // Extra parents of a merge each open a lane beside this one.
            // The first parent always continues the lane the commit is
            // already on - reassigned above when a stream matched, or
            // created just now for a tip.
            for (var j = 1; j < entry.parents.length; ++j) {
                var x = (index + j + 1) * xOffset;
                var svgPath = newStreamPath();
                var origX = (index + 1) * xOffset;
                svgPath.cmds = "M " + origX + " " + currentY + " L " + x + " " + (currentY + self.lineHeight / 2) + " L " + x + " ";
                streams.splice(index + j, 0, {
                    sha1: entry.parents[j],
                    path: svgPath,
                });
            }
            var j = entry.parents.length;
            for (var j = index + j; j < streams.length; ++j) {
                var stream = streams[j];
                var x = (j + 1) * xOffset;
                stream.path.cmds += (currentY - self.lineHeight / 2) + " L " + x + " " + currentY + " L " + x + " ";
            }

            var nodeStream = streams[index];
            var nodeColor = nodeStream && nodeStream.path.style.stroke;
            var nodeX = (index + 1) * xOffset;
            var svgNode;
            if (entry.stash) {
                // Stashes are squares rather than dots - they sit in the
                // graph but aren't part of the branch's history.
                svgNode = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                svgNode.setAttribute("x", nodeX - 3.5);
                svgNode.setAttribute("y", currentY - 3.5);
                svgNode.setAttribute("width", 7);
                svgNode.setAttribute("height", 7);
                svgNode.setAttribute("rx", 1);
                if (nodeColor) {
                    svgNode.setAttribute("style", "fill:" + nodeColor);
                }
            } else {
                svgNode = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                svgNode.setAttribute("cx", nodeX);
                svgNode.setAttribute("cy", currentY);
                svgNode.setAttribute("r", 4);
                if (entry.parents.length > 1 && nodeColor) {
                    // Hollow ring marks a merge commit.
                    svgNode.setAttribute("style", "fill:#fff;stroke:" + nodeColor + ";stroke-width:2");
                } else if (nodeColor) {
                    svgNode.setAttribute("style", "fill:" + nodeColor);
                }
            }
            svg.appendChild(svgNode);

            entry.element.gitparLeft = Math.max(entry.element.gitparLeft, streams.length);
            maxLeft = Math.max(maxLeft, entry.element.gitparLeft);
            // Debug log
            //console.log(entry.commit, entry.parents, $.extend(true, [], streams));

            // Fallback for rows that couldn't be measured (detached /
            // not yet laid out); measured rows overwrite this above.
            currentY += self.lineHeight;
        }
        // The graph sits in a gutter to the right of the commit
        // subject, so every row reserves the same width and the SVG is
        // parked over that column. A per-row width would make the lanes
        // zig-zag as the branch count changed.
        var graphWidth = (Math.max(maxLeft, 1) + 1) * xOffset;
        for (var i = startAt; i < content.children.length; ++i) {
            var element = content.children[i];
            if (element.model) {
                var gutter = element.querySelector(".log-entry-graph");
                if (gutter) {
                    gutter.style.width = graphWidth + "px";
                }
            }
        }
        self.alignGraphGutter(graphWidth);
        for (var i = 0; i < streams.length; ++i) {
            var stream = streams[i];
            stream.path.setAttribute("d", stream.path.cmds + currentY);
        }
    }

    function Person(data) {
        var nameEnd = data.indexOf("<");
        this.name = data.substr(0, nameEnd - 1);
        var emailEnd = data.indexOf(">", nameEnd);
        this.email = data.substr(nameEnd + 1, emailEnd - nameEnd - 1);
        var dateEnd = data.indexOf(" ", emailEnd + 2);
        var secs = data.substr(emailEnd + 2, dateEnd - emailEnd - 2);
        this.date = new Date(0);
        this.date.setUTCSeconds(parseInt(secs));
    };

    function Entry(logView, data) {
        var self = this;

        self.abbrevCommitHash = function() {
            return self.commit.substr(0, 7);
        };

        self.abbrevMessage = function() {
            var end = self.message.indexOf("\n");
            if (end == -1) {
                return self.message
            } else {
                return self.message.substr(0, end);
            }
        };

        // The row shows the subject and then as much of the body as
        // fits on the same line, muted. The row is already clipped with
        // an ellipsis, so the body costs nothing when it doesn't fit and
        // says what the commit did when it does.
        self.bodyPreview = function() {
            var end = self.message.indexOf("\n");
            if (end == -1) {
                return "";
            }
            return self.message.substr(end + 1).replace(/\s+/g, " ").trim();
        };

        self.createElement = function() {
            // A stash isn't authored work, so it gets a stash marker
            // rather than the author's initials - it reads as something
            // set aside rather than a commit.
            var marker = self.stash
                ? '<span class="log-entry-avatar log-entry-stash-mark" title="' + gitpar.escapeHtml(self.stash.ref || "stash") + '">&#9707;</span>'
                : '<span class="log-entry-avatar" style="background:' + gitpar.colorForAuthor(self.author.name, self.author.email) + '" title="' + gitpar.escapeHtml(self.author.name) + ' &lt;' + gitpar.escapeHtml(self.author.email) + '&gt;">' + gitpar.escapeHtml(gitpar.getInitials(self.author.name)) + '</span>';
            self.element = $('<a class="log-entry list-group-item">' +
                                '<header>' +
                                    marker +
                                    '<p class="list-group-item-text"></p>' +
                                    '<button type="button" class="log-entry-menu-btn" title="Show commit menu">&#8942;</button>' +
                                    '<span class="log-entry-unpushed" title="Not on any remote yet"></span>' +
                                    '<span class="log-entry-graph"></span>' +
                                    '<span class="log-entry-date" title="' + gitpar.escapeHtml(self.author.date.toLocaleString()) + '">' + gitpar.escapeHtml(self.relativeDate || "") + '</span>' +
                                '</header>' +
                             '</a>')[0];
            var subject = self.stash ? gitpar.formatStashSubject(self.stash.message) : self.abbrevMessage();
            $(self.element).toggleClass("log-entry-stash", !!self.stash);
            var text = $(".list-group-item-text", self.element);
            text[0].appendChild(document.createTextNode(subject));
            // Marks the commits Publish would send. Stashes are never
            // pushed, so they never carry the dot.
            $(self.element).toggleClass("log-entry-is-unpushed",
                !self.stash && !!gitpar.unpushedSet[self.commit]);
            var body = self.stash ? "" : self.bodyPreview();
            if (body) {
                text.append($('<span class="log-entry-body">').text(body));
            }
            $(".log-entry-menu-btn", self.element).click(function(event) {
                event.preventDefault();
                event.stopPropagation();
                historyView.mainView.commitActionMenu.show(event.currentTarget, self);
            });
            // Ref labels live in the left column, positioned at the
            // commit they point at - repeating them inline beside the
            // subject said the same thing twice and crowded the row.
            self.element.model = self;
            var model = self;
            $(self.element).click(function (event) {
                model.select();
            });
            return self.element;
        };

        self.select = function() {
            if (currentSelection != self) {
                if (currentSelection) {
                    $(currentSelection.element).removeClass("active");
                    currentSelection.closeCard();
                }
                $(self.element).addClass("active");
                currentSelection = self;
                self.openCard();
            }
        };

        // A selected commit opens inline - the row grows to hold its
        // message and file list - rather than in a permanently docked
        // side pane.
        self.openCard = function() {
            if (self.card) {
                return;
            }
            // The card carries the commit's identity - avatar, when, who,
            // hash - because the row above it is reduced to the date and
            // the graph while it is open. Repeating them in both places
            // showed the hash twice.
            self.card = $('<div class="log-entry-card">' +
                              '<div class="log-entry-card-header">' +
                                  '<span class="log-entry-card-avatar"></span>' +
                                  '<span class="log-entry-card-meta"></span>' +
                                  '<span class="log-entry-card-actions">' +
                                      '<button type="button" class="log-entry-card-btn log-entry-card-menu" title="Show commit menu">&#8942;</button>' +
                                      '<button type="button" class="log-entry-card-btn log-entry-card-expand" title="Expand this commit">&#8599;</button>' +
                                  '</span>' +
                              '</div>' +
                              '<pre class="log-entry-card-message"></pre>' +
                              '<div class="log-entry-card-files"></div>' +
                          '</div>');
            $(".log-entry-card-avatar", self.card)
                .text(gitpar.getInitials(self.author.name))
                .attr("style", "background:" + gitpar.colorForAuthor(self.author.name, self.author.email))
                .attr("title", self.author.name + " <" + self.author.email + ">");
            $(".log-entry-card-meta", self.card)
                .text(gitpar.formatCommitDate(self.author.date) + " by ")
                .append($('<span class="log-entry-card-author">').text(self.author.name))
                .append(document.createTextNode("  "))
                .append($('<button type="button" class="log-entry-card-hash">')
                    .text("(" + self.abbrevCommitHash() + ")")
                    .attr("title", self.commit)
                    .click(function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        gitpar.copyToClipboard(self.commit, "Commit hash");
                    }));
            $(".log-entry-card-message", self.card).text(self.message);
            $(".log-entry-card-menu", self.card).click(function(event) {
                event.preventDefault();
                event.stopPropagation();
                historyView.mainView.commitActionMenu.show(event.currentTarget, self);
            });
            $(".log-entry-card-expand", self.card).click(function(event) {
                event.preventDefault();
                event.stopPropagation();
                historyView.expandCommit(self);
            });
            self.card.click(function(event) {
                event.stopPropagation();
            });
            $(self.element).addClass("expanded").append(self.card);
            logView.redrawGraph();
            self.loadCardFiles();
        };

        self.loadCardFiles = function() {
            var fileBox = $(".log-entry-card-files", self.card);
            fileBox.text("Loading files…");
            // --root: without it, diff-tree silently produces nothing for
            // a commit with no parent (the repo's very first commit) -
            // it needs telling explicitly to diff a root commit against
            // the empty tree rather than against a (nonexistent) parent.
            gitpar.git("diff-tree --no-commit-id --name-status -r -m --first-parent --root " + self.commit, function(data) {
                if (!self.card) {
                    return;
                }
                fileBox.empty();
                var files = gitpar.parseNameStatus(data);
                if (files.length == 0) {
                    fileBox.append('<div class="log-entry-card-empty">No file changes in this commit.</div>');
                } else {
                    files.forEach(function(file) {
                        var row = $('<div class="log-entry-card-file">' +
                                        '<span class="log-entry-card-file-path"></span>' +
                                        '<span class="log-entry-card-file-status"></span>' +
                                    '</div>');
                        $(".log-entry-card-file-path", row).text(file.path);
                        $(".log-entry-card-file-status", row)
                            .text(file.status)
                            .addClass("log-entry-card-status-" + file.status.charAt(0));
                        // Opens the commit full-view on that file, rather
                        // than making you expand and then find it again.
                        row.attr("title", "Open " + file.path);
                        row.click(function(event) {
                            event.preventDefault();
                            event.stopPropagation();
                            historyView.expandCommit(self, file.path);
                        });
                        fileBox.append(row);
                    });
                }
                logView.redrawGraph();
            });
        };

        self.closeCard = function() {
            if (!self.card) {
                return;
            }
            self.card.remove();
            self.card = null;
            $(self.element).removeClass("expanded");
            logView.redrawGraph();
        };

        self.parents = [];
        self.message = ""

        data.split("\n").forEach(function(line) {
            if (line.indexOf("commit ") == 0) {
                self.commit = line.substr(7, 40);
                if (line.length > 47) {
                    self.refs = []
                    var s = line.lastIndexOf("(") + 1;
                    var e = line.lastIndexOf(")");
                    line.substr(s, e - s).split(", ").forEach(function(ref) {
                        self.refs.push(ref);
                    });
                }
            } else if (line.indexOf("parent ") == 0) {
                self.parents.push(line.substr(7));
            } else if (line.indexOf("tree ") == 0) {
                self.tree = line.substr(5);
            } else if (line.indexOf("author ") == 0) {
                self.author = new Person(line.substr(7));
            } else if (line.indexOf("committer ") == 0) {
                self.committer = new Person(line.substr(10));
            } else if (line.indexOf("    ") == 0) {
                self.message += line.substr(4) + "\n";
            }
        });

        self.message = self.message.trim();
        self.decoratedRefs = gitpar.parseDecoratedRefs(self.refs || [], self.commit);

        // A stash records its index (and any untracked files) as extra
        // parents. Those aren't history and would each open a lane, so
        // the graph follows only the commit the stash was taken from.
        self.stash = (logView.stashCommits || {})[self.commit];
        if (self.stash) {
            self.parents = self.parents.slice(0, 1);
        }

        // Only label the first commit in a run that shares the same
        // relative-time bucket ("2 days ago", ...) - repeating it on
        // every row is noise.
        var formatted = gitpar.formatRelativeTime(self.author.date);
        if (formatted != logView.lastShownDate) {
            self.relativeDate = formatted;
            logView.lastShownDate = formatted;
        }

        self.createElement();
    };

    self.historyView = historyView;
    self.element = $('<div id="log-view" class="list-group"><svg xmlns="http://www.w3.org/2000/svg"></svg><div></div></div>')[0];
    var svg = self.element.children[0];
    var content = self.element.children[1];
    var currentSelection = null;
    var lineHeight = null;
    var streams = [];
    var streamColor = 0;
};

/*
 * == DiffView ================================================================
 */
gitpar.DiffView = function(initialSideBySide, hunkSelectionAllowed, parent) {

    var self = this;
    self.sideBySide = initialSideBySide;
    
    var left, right, single, leftLines, rightLines, singleLines;

    self.update = function(cmd, diffOpts, file, mode) {
        gitApplyType = mode;
        $(".diff-stage", self.element).attr("style", "display:none");
        $(".diff-cancel", self.element).attr("style", "display:none");
        $(".diff-unstage", self.element).attr("style", "display:none");
        if (cmd) {
            self.gitCmd = cmd;
            self.gitDiffOpts = diffOpts;
            if (file != self.gitFile) {
                if (left) {
                    left.scrollTop = 0;
                    left.scrollLeft = 0;
                    left.gitparPrevScrollTop = 0;
                    left.gitparPrevScrollLeft = 0;
                }
                if (right) {
                    right.scrollTop = 0;
                    right.scrollLeft = 0;
                    right.gitparPrevScrollTop = 0;
                    right.gitparPrevScrollLeft = 0;
                }
            }
            self.gitFile = file;
        }
        if (self.gitCmd) {
            var fullCmd = self.gitCmd;
            if (self.complete) {
                fullCmd += " --unified=999999999";
            } else {
                fullCmd += " --unified=" + self.context.toString();
            }
            if (self.ignoreWhitespace) {
                fullCmd += " --ignore-all-space --ignore-blank-lines";
            }
            if (self.gitDiffOpts) {
                fullCmd += " " + self.gitDiffOpts.join(" ")
            }
            if (self.gitFile) {
                // The backend splits this with shlex, so an unquoted
                // path breaks on any file with a space in its name.
                fullCmd += " -- " + gitpar.quoteArg(self.gitFile);
            }
            gitpar.git(fullCmd, function(diff) {
                self.refresh(diff);
            });
        } else {
            self.refresh("");
        }
    };

    self.refresh = function(diff) {
        self.currentDiff = diff;
        self.diffHeader = "";
        $(".diff-tool-stepper-value", self.element).text(self.context);
        if (self.sideBySide) {
            var diffLines = diff.split("\n");
            self.updateSplitView(leftLines, diffLines, '-');
            self.updateSplitView(rightLines, diffLines, '+');
        } else {
            self.updateSimpleView(singleLines, diff);
        }
        if (parent && parent.onDiffRefreshed) {
            parent.onDiffRefreshed();
        }
    }

    self.updateSimpleView = function(view, diff) {
        $(view).empty();

        var context = { inHeader: true };
        var diffLines = diff.split("\n");
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            context = self.addDiffLine(view, line, context);
        }
    }

    self.updateSplitView = function(view, diffLines, operation) {
        $(view).empty();

        // Each side of a split view only ever shows one set of numbers:
        // the left pane is the old file, the right pane the new one.
        var context = { inHeader: true,
                        addedLines: [],
                        removedLines: [],
                        showOld: operation == '-',
                        showNew: operation == '+',
                      };
        for (var i = 0; i < diffLines.length; ++i) {
            var line = diffLines[i];
            var c = line[0];
            if (c == '+') {
                context.addedLines.push(line);
                if (context.inHeader) {
                    context.diffHeader += line + '\n';
                }
            } else if (c == '-') {
                context.removedLines.push(line);
                if (context.inHeader) {
                    context.diffHeader += line + '\n';
                }
            } else {
                context = self.flushAddedRemovedLines(view, operation, context);
                context.addedLines = [];
                context.removedLines = [];
                context = self.addDiffLine(view, line, context);
                if (c == 'd') {
                    context.diffHeader = '';
                }
            }
        }
        self.flushAddedRemovedLines(view, operation, context);
        view.parentElement.scrollTop = view.parentElement.gitparPrevScrollTop;
    }

    self.flushAddedRemovedLines = function(view, operation, context) {
        if (operation == '+') {
            var lines = context.addedLines;
            var offset = context.removedLines.length - context.addedLines.length;
        } else {
            var lines = context.removedLines;
            var offset = context.addedLines.length - context.removedLines.length;
        }
        lines.forEach(function(line) {
            context = self.addDiffLine(view, line, context);
        });
        if (offset > 0) {
            for (var i = 0; i < offset; ++i) {
                var pre = $('<pre class="diff-view-line diff-line-phantom">').appendTo(view)[0];
                pre.gitparLine = " ";
                if (hunkSelectionAllowed) {
                    $('<span class="diff-line-check diff-line-check-empty">').appendTo(pre);
                }
                if (context.showOld !== false) {
                    $('<span class="diff-line-num diff-line-num-old">').appendTo(pre);
                }
                if (context.showNew !== false) {
                    $('<span class="diff-line-num diff-line-num-new">').appendTo(pre);
                }
                $('<span class="diff-line-text">').text(" ").appendTo(pre);
            }
        }
        return context;
    }

    // Reconstructing a patch needs the original text of a line, which is
    // no longer the element's textContent now that gutters live inside
    // it. addDiffLine stashes the raw line here.
    self.lineText = function(element) {
        return element.gitparLine != undefined ? element.gitparLine : element.textContent;
    }

    self.addDiffLine = function(view, line, context) {
        var c = line[0];
        var pre = $('<pre class="diff-view-line">').appendTo(view)[0];
        pre.gitparLine = line;

        var hunk = gitpar.parseHunkHeader(line);
        if (hunk) {
            context.oldLine = hunk.oldStart;
            context.newLine = hunk.newStart;
            // Tagged so the toolbar's next/previous can step between
            // changes without re-parsing the rendered diff.
            $(pre).addClass("diff-view-hunk-start");
        }

        // Number the line before classifying it: a removal only consumes
        // an old line number, an addition only a new one, and context
        // consumes both.
        var oldNum = "";
        var newNum = "";
        if (!hunk && !context.inHeader && context.oldLine != undefined) {
            if (c == '+') {
                newNum = context.newLine++;
            } else if (c == '-') {
                oldNum = context.oldLine++;
            } else if (c != '\\') {
                oldNum = context.oldLine++;
                newNum = context.newLine++;
            }
        }

        // Staging checkbox, on changed lines and on the hunk header
        // (which toggles the whole hunk). Purely a rendering of the
        // line's selected state - the click still goes through
        // handleClick like clicking the line itself does.
        //
        // A hunk header uses `hunk` rather than `!context.inHeader`: the
        // very first hunk of a file is reached while context.inHeader is
        // still true from the diff/index/---/+++ preamble - it's only
        // cleared below, after this point - so gating on it here would
        // silently skip the checkbox (and, further down, the Discard
        // button) on that first hunk while later ones in the same diff
        // render fine.
        if (hunkSelectionAllowed && (hunk || (!context.inHeader && (c == '+' || c == '-')))) {
            $('<span class="diff-line-check">').appendTo(pre);
        } else if (hunkSelectionAllowed) {
            $('<span class="diff-line-check diff-line-check-empty">').appendTo(pre);
        }

        if (context.showOld !== false) {
            $('<span class="diff-line-num diff-line-num-old">').text(oldNum).appendTo(pre);
        }
        if (context.showNew !== false) {
            $('<span class="diff-line-num diff-line-num-new">').text(newNum).appendTo(pre);
        }
        $('<span class="diff-line-text">').text(line).appendTo(pre);

        // Per-hunk discard, sitting on the hunk header row. Uses `hunk`
        // for the same reason as the checkbox above.
        if (hunkSelectionAllowed && hunk && gitApplyType == "stage") {
            var discard = $('<button type="button" class="diff-hunk-discard">Discard</button>');
            discard.click(function(event) {
                event.preventDefault();
                event.stopPropagation();
                self.discardHunk(pre);
            });
            discard.appendTo(pre);
        }

        if (c == '+') {
            $(pre).addClass("diff-line-add");
        } else if (c == '-') {
            $(pre).addClass("diff-line-del");
        } else if (c == '@') {
            $(pre).addClass("diff-line-offset");
            pre.gitparActive = false;
            context.inHeader = false;
        } else if (c == 'd') {
            context.inHeader = true;
        }
        if (context.inHeader) {
            $(pre).addClass("diff-line-header");
            if (c == 'd') $(pre).addClass("diff-section-start");
        }
        return context;
    }

    self.createSelectionPatch = function (reverse) {
        if (!self.sideBySide) {
            return self.createUnifiedSelectionPatch(reverse);
        }
        var patch = "";
        // First create the header
        for (var l = 0; l < leftLines.childElementCount; ++l) {
            var line = self.lineText(leftLines.children[l]);
            if (line[0] == "@") {
                break;
            } else {
                patch += line + "\n";
            }
        }
        patch += self.lineText(rightLines.children[l - 1]) + "\n";
        // Then build the patch itself
        var refLineNo = 0;
        var patchOffset = 0;
        var hunkAddedLines = [];
        var hunkRemovedLines = [];
        for (; l < leftLines.childElementCount; ++l) {
            var leftElt = leftLines.children[l];
            var leftLine = self.lineText(leftElt);
            var leftCmd = leftLine[0];

            if (leftCmd == "@" || (leftCmd == " " && !$(leftElt).hasClass("diff-line-phantom"))) {
                if (hunkAddedLines.length != 0 || hunkRemovedLines.length != 0) {
                    patch += self.flushSelectionPatch(hunkAddedLines, hunkRemovedLines, refLineNo, patchOffset);
                    refLineNo += hunkRemovedLines.length
                    patchOffset += hunkAddedLines.length - hunkRemovedLines.length;
                    var hunkAddedLines = [];
                    var hunkRemovedLines = [];
                }
                if (leftCmd == "@") {
                    var splittedContext = leftLine.split(" ");
                    if (!reverse) {
                        refLineNo = Math.abs(splittedContext[1].split(",")[0]);
                    } else {
                        refLineNo = Math.abs(splittedContext[2].split(",")[0]);
                    }
                } else {
                    ++refLineNo;
                }
            } else if (leftCmd == "-" || $(leftElt).hasClass("diff-line-phantom")) {
                if (leftCmd == "-") {
                    if ($(leftElt).hasClass("active")) {
                        if (!reverse) {
                            hunkRemovedLines.push(leftLine);
                        } else {
                            hunkAddedLines.push(self.reverseLine(leftLine));
                        }
                    } else if (!reverse) {
                        ++refLineNo;
                    }
                }
                var rightElt = rightLines.children[l];
                if (!$(rightElt).hasClass("diff-line-phantom")) {
                    if ($(rightElt).hasClass("active")) {
                        if (!reverse) {
                            hunkAddedLines.push(self.lineText(rightElt));
                        } else {
                            hunkRemovedLines.push(self.reverseLine(self.lineText(rightElt)));
                        }
                    } else if (reverse) {
                        ++refLineNo;
                    }
                }
            }
        }
        if (hunkAddedLines.length != 0 || hunkRemovedLines.length != 0) {
            patch += self.flushSelectionPatch(hunkAddedLines, hunkRemovedLines, refLineNo, patchOffset);
        }
        return patch;
    }

    self.flushSelectionPatch = function(hunkAddedLines, hunkRemovedLines, refLineNo, patchOffset) {
        var patch = "@@ -" + refLineNo + "," + hunkRemovedLines.length +" +" + (refLineNo + patchOffset) + "," + hunkAddedLines.length + " @@\n";
        hunkRemovedLines.forEach(function (line) { patch += line + "\n" });
        hunkAddedLines.forEach(function (line) { patch += line + "\n" });
        return patch;
    }

    self.reverseLine = function(line) {
        switch (line[0]) {
            case '-':
                return '+' + line.substr(1);
            case '+':
                return '-' + line.substr(1);
                break;
            default:
                return line;
                break;
        }
    }

    self.diffViewScrolled = function(event) {
        if (event.target == left) {
            var current = left;
            var other = right;
        } else {
            var current = right;
            var other = left;
        }
        if (current.gitparPrevScrollTop != current.scrollTop) {
            // Vertical scrolling
            other.scrollTop = current.scrollTop;
            other.gitparPrevScrollTop = current.gitparPrevScrollTop = current.scrollTop;
        } else if (current.gitparPrevScrollLeft != current.scrollLeft) {
            // Horizontal scrolling
            other.scrollLeft = current.scrollLeft;
            other.gitparPrevScrollLeft = current.gitparPrevScrollLeft = current.scrollLeft;
        }
    }

    self.addContext = function() {
        self.context += 3;
        self.update();
    }

    self.removeContext = function() {
        if (self.context > 3) {
            self.context -= 3;
            self.update();
        }
    }

    self.allContext = function() {
        self.complete = !self.complete;
        self.update();
    }

    self.toggleIgnoreWhitespace = function() {
        self.ignoreWhitespace = !self.ignoreWhitespace;
        self.update();
    }

    self.handleClick = function(event) {
        var lineElt = event.target;
        while (lineElt && !$(lineElt).hasClass("diff-view-line")) {
            lineElt = lineElt.parentElement;
        }
        if (!lineElt) {
            return;
        }
        var diffLine = self.lineText(lineElt);
        var cmd = diffLine[0];
        if (cmd == "+" || cmd == "-") {
            $(lineElt).toggleClass("active");
        } else if (cmd == "@") {
            lineElt.gitparActive = !lineElt.gitparActive;
            for (var elt = lineElt.nextElementSibling; elt; elt = elt.nextElementSibling) {
                cmd = self.lineText(elt)[0];
                if (cmd == "+" || cmd == "-") {
                    $(elt).toggleClass("active", lineElt.gitparActive);
                } else if (cmd == "@") {
                    break;
                }
            }
        }

        var isActive = false
        var lineContainers = [leftLines, rightLines, singleLines];
        for (var i = 0; i < lineContainers.length; ++i) {
            var lineContainer = lineContainers[i];
            if (!lineContainer) continue;
            for (var j = 0; j < lineContainer.childElementCount; ++j) {
                var elt = lineContainer.children[j];
                if ($(elt).hasClass("active")) {
                    isActive = true;
                    break;
                }
            }
        }
        if (isActive) {
            if (gitApplyType == "stage") {
                $(".diff-stage", self.element).removeAttr("style");
                $(".diff-cancel", self.element).removeAttr("style");
                $(".diff-unstage", self.element).attr("style", "display:none");
            } else {
                $(".diff-stage", self.element).attr("style", "display:none");
                $(".diff-cancel", self.element).attr("style", "display:none");
                $(".diff-unstage", self.element).removeAttr("style");
            }
        } else {
            $(".diff-stage", self.element).attr("style", "display:none");
            $(".diff-cancel", self.element).attr("style", "display:none");
            $(".diff-unstage", self.element).attr("style", "display:none");
        }
    }

    // Selects exactly the changed lines of one hunk, then reverse-applies
    // them to the working tree - i.e. throws that hunk's changes away.
    self.discardHunk = function(hunkElement) {
        if (!window.confirm("Discard this hunk? The changes cannot be recovered.")) {
            return;
        }
        var container = hunkElement.parentElement;
        $(".diff-view-line", container).removeClass("active");
        for (var elt = hunkElement.nextElementSibling; elt; elt = elt.nextElementSibling) {
            var c = self.lineText(elt)[0];
            if (c == '@') {
                break;
            }
            if (c == '+' || c == '-') {
                $(elt).addClass("active");
            }
        }
        self.applySelection(true, false);
    }

    // Builds a patch from the selected lines of a unified diff.
    //
    // The old side must reproduce the file the patch is applied against,
    // so an unselected removal is re-emitted as context (that line is
    // still there) while an unselected addition is dropped entirely.
    // Files and hunks that end up with no selected change are skipped,
    // and each file carries its own header - a diff can span several.
    self.createUnifiedSelectionPatch = function(reverse) {
        var lines = singleLines ? singleLines.children : [];
        var out = "";
        var fileHeader = "";
        var fileBody = "";
        var pending = "";
        var oldCount = 0;
        var newCount = 0;
        var hunkStart = 0;
        var hunkHasChange = false;
        var inHunk = false;

        var flushHunk = function() {
            if (pending && hunkHasChange) {
                fileBody += "@@ -" + hunkStart + "," + oldCount +
                            " +" + hunkStart + "," + newCount + " @@\n" + pending;
            }
            pending = "";
            oldCount = 0;
            newCount = 0;
            hunkHasChange = false;
        };

        var flushFile = function() {
            flushHunk();
            if (fileBody) {
                out += fileHeader + fileBody;
            }
            fileHeader = "";
            fileBody = "";
        };

        for (var i = 0; i < lines.length; ++i) {
            var element = lines[i];
            var line = self.lineText(element);

            if (line.indexOf("diff --git ") == 0) {
                flushFile();
                fileHeader = line + "\n";
                inHunk = false;
                continue;
            }

            var hunk = gitpar.parseHunkHeader(line);
            if (hunk) {
                flushHunk();
                hunkStart = hunk.oldStart;
                inHunk = true;
                continue;
            }

            // Everything before the first hunk is file header - which
            // includes "--- a/x" and "+++ b/x", so this has to come
            // before any +/- classification or those get rewritten.
            if (!inHunk) {
                fileHeader += line + "\n";
                continue;
            }

            var c = line[0];
            var selected = $(element).hasClass("active");
            if (c == '+') {
                if (selected) {
                    pending += line + "\n";
                    ++newCount;
                    hunkHasChange = true;
                }
            } else if (c == '-') {
                if (selected) {
                    pending += line + "\n";
                    ++oldCount;
                    hunkHasChange = true;
                } else {
                    pending += " " + line.substr(1) + "\n";
                    ++oldCount;
                    ++newCount;
                }
            } else if (c == '\\') {
                pending += line + "\n";
            } else {
                pending += line + "\n";
                ++oldCount;
                ++newCount;
            }
        }
        flushFile();
        return out;
    }

    self.applySelection = function(reverse, cached) {
        // The unified builder always emits a forward patch and lets git
        // invert it with -R. Hand-reversing would have to rewrite the
        // "---"/"+++" header lines and swap every hunk range, which is
        // exactly the kind of thing git already does correctly.
        var unified = !self.sideBySide;
        var patch = unified ? self.createUnifiedSelectionPatch() : self.createSelectionPatch(reverse);
        if (!patch) {
            return;
        }
        var cmd = "apply --unidiff-zero";
        if (cached) {
            cmd += " --cached";
        }
        if (unified && reverse) {
            cmd += " -R";
        }
        gitpar.git(cmd, patch, function (data) {
            parent.update();
        });
    }

    self.switchToExploreView = function() {
        if (! self.currentDiff) {
            return;
        }
        var mainView = parent.historyView.mainView;
        var commitExplorerView = new gitpar.CommitExplorerView(mainView, self.currentDiff);
        commitExplorerView.show();
    };
    
    self.toggleSideBySide = function() {
        self.sideBySide = !self.sideBySide;
        self.buildDOM();
        if (self.currentDiff) {
            self.refresh(self.currentDiff);
        }
    };

    // Walks between changes in a long diff. Which hunk counts as
    // "current" is whichever one the scroll is sitting on, so stepping
    // works from wherever the reader has scrolled to rather than from
    // some remembered index that the last render invalidated.
    self.stepHunk = function(direction) {
        // The scroller is .diff-view, not the panel body - and in
        // side-by-side there is one per side, each with its own copy of
        // every hunk header. Stepping follows the first, and the sides
        // are already scroll-linked, so both move.
        var body = $(".diff-view", self.element)[0];
        if (!body) {
            return;
        }
        var hunks = $(".diff-view-hunk-start", body);
        if (hunks.length == 0) {
            return;
        }
        var bodyTop = body.getBoundingClientRect().top;
        var offsets = [];
        hunks.each(function() {
            offsets.push(this.getBoundingClientRect().top - bodyTop + body.scrollTop);
        });
        // A small tolerance so the hunk already pinned to the top is
        // treated as current rather than as the one just passed.
        var current = body.scrollTop + 2;
        var target = null;
        if (direction > 0) {
            for (var i = 0; i < offsets.length; ++i) {
                if (offsets[i] > current) {
                    target = offsets[i];
                    break;
                }
            }
        } else {
            for (var j = offsets.length - 1; j >= 0; --j) {
                if (offsets[j] < current - 4) {
                    target = offsets[j];
                    break;
                }
            }
        }
        if (target !== null) {
            body.scrollTop = target;
        }
    }

    self.buildDOM = function() {
        var html = '<div class="diff-view-container panel panel-default">';
        if (! (parent instanceof gitpar.CommitExplorerView)) {
            html +=
                '<div class="panel-heading diff-toolbar" role="toolbar">' +
                    '<button type="button" class="diff-tool-btn diff-ignore-whitespace' + (self.ignoreWhitespace ? ' on' : '') + '" aria-pressed="' + !!self.ignoreWhitespace + '">Ignore whitespace</button>' +
                    '<button type="button" class="diff-tool-btn diff-context-all' + (self.complete ? ' on' : '') + '" aria-pressed="' + !!self.complete + '">Complete file</button>' +
                    '<div class="diff-tool-stepper" title="Lines of context around each change">' +
                        '<button type="button" class="diff-tool-step diff-context-remove" aria-label="Less context">&minus;</button>' +
                        '<span class="diff-tool-stepper-value"></span>' +
                        '<button type="button" class="diff-tool-step diff-context-add" aria-label="More context">+</button>' +
                    '</div>' +
                    '<div class="diff-tool-group diff-selection-buttons">' +
                        '<button type="button" class="diff-tool-btn diff-stage" style="display:none">Stage</button>' +
                        '<button type="button" class="diff-tool-btn diff-cancel" style="display:none">Cancel</button>' +
                        '<button type="button" class="diff-tool-btn diff-unstage" style="display:none">Unstage</button>' +
                    '</div>' +
                    '<div class="diff-toolbar-spacer"></div>' +
                    '<div class="diff-tool-group diff-hunk-nav">' +
                        '<button type="button" class="diff-tool-step diff-hunk-prev" title="Previous change" aria-label="Previous change">&#8963;</button>' +
                        '<button type="button" class="diff-tool-step diff-hunk-next" title="Next change" aria-label="Next change">&#8964;</button>' +
                    '</div>' +
                    '<button type="button" class="diff-tool-btn diff-toggle-view' + (self.sideBySide ? ' on' : '') + '" aria-pressed="' + !!self.sideBySide + '">Side-by-side</button>' +
                    (!self.sideBySide ? '<button type="button" class="diff-tool-btn diff-explore">Explore</button>' : '') +
                '</div>';
        }
        html += '<div class="panel-body"></div></div>'
        var newElement = $(html)[0];
        var panelBody = $(".panel-body", newElement)[0];
        
        if (self.sideBySide) {
            left = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
            panelBody.appendChild(left);
            leftLines = left.firstChild;
            $(left).scroll(self.diffViewScrolled);
            left.gitparPrevScrollTop = 0;
            left.gitparPrevScrollLeft = 0;
            
            right = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
            panelBody.appendChild(right);
            rightLines = right.firstChild;
            $(right).scroll(self.diffViewScrolled);
            right.gitparPrevScrollTop = 0;
            right.gitparPrevScrollLeft = 0;
            
            if (hunkSelectionAllowed) {
                $(left).click(self.handleClick);
                $(right).click(self.handleClick);
            }
        } else {
            single = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
            panelBody.appendChild(single);
            singleLines = single.firstChild;

            if (hunkSelectionAllowed) {
                $(single).click(self.handleClick);
            }
        }

        $(".diff-context-remove", newElement).click(self.removeContext);
        $(".diff-context-add", newElement).click(self.addContext);
        $(".diff-context-all", newElement).click(self.allContext);
        $(".diff-ignore-whitespace", newElement).click(self.toggleIgnoreWhitespace);

        $(".diff-stage", newElement).click(function() { self.applySelection(false, true); });
        $(".diff-cancel", newElement).click(function() { self.applySelection(true, false); });
        $(".diff-unstage", newElement).click(function() { self.applySelection(true, true); });

        $(".diff-explore", newElement).click(function() { self.switchToExploreView(); });
        $(".diff-toggle-view", newElement).click(self.toggleSideBySide);
        $(".diff-hunk-prev", newElement).click(function() { self.stepHunk(-1); });
        $(".diff-hunk-next", newElement).click(function() { self.stepHunk(1); });
        
        if (self.element && self.element.parentNode) {
            self.element.parentNode.replaceChild(newElement, self.element);
        }
        self.element = newElement;
    };

    self.buildDOM();
    self.context = 3;
    self.complete = false;
    self.ignoreWhitespace = false;
    var gitApplyType = "stage";
}

/*
 * == TreeView ================================================================
 */
gitpar.TreeView = function(commitView) {

    var self = this;

    function Entry(line) {

        var self = this;

        self.formatedSize = function(size) {
            if (isNaN(self.size)) {
                return ["", ""]
            }
            if (self.size < 1024) {
                return [self.size.toString(), ""];
            } else if (self.size < 1024 * 1024) {
                return [(self.size / 1024).toFixed(2), "K"];
            } else if (self.size < 1024 * 1024 * 1024) {
                return [(self.size / 1024 * 1024).toFixed(2), "M"];
            } else {
                return [(self.size / 1024 * 1024 * 1024).toFixed(2), "G"];
            }
        };

        self.isSymbolicLink = function() {
            return (self.mode & 120000) == 120000; // S_IFLNK
        }

        var end = line.indexOf(" ");
        self.mode = parseInt(line.substr(0, end));
        var start = end + 1;
        var end = line.indexOf(" ", start);
        self.type = line.substr(start, end - start);
        start = end + 1;
        var end = line.indexOf(" ", start);
        self.object = line.substr(start, end - start);
        start = end + 1;
        var end = line.indexOf("\t", start);
        self.size = parseInt(line.substr(start, end - start).trim());
        start = end + 1;
        self.name = line.substr(start);
    }

    self.update = function(treeRef, commitRef) {
        self.stack = [ { name: gitpar.repo, object: treeRef } ];
        self.commitRef = commitRef;
        self.showTree();
    }

    self.getCurrentPath = function() {
        return self.stack.slice(1).map(function(entry) { return entry.name; }).join("/");
    }

    self.createBreadcrumb = function() {
        $(breadcrumb).empty();
        for (var i = 0; i < self.stack.length; ++i) {
            var last = i == self.stack.length - 1;
            var name = self.stack[i].name;
            if (!last) {
                name = '<a href="#">' + name + '</a>';
            }
            var li = $('<li>' + name + '</li>');
            li.appendTo(breadcrumb);
            if (!last) {
                li.click(self.breadcrumbClicked);
            } else {
                li.addClass("active");
            }
        }
    }

    self.breadcrumbClicked = function(event) {
        var to = gitpar.getNodeIndex(event.target.parentElement);
        self.stack = self.stack.slice(0, to + 1);
        self.showTree();
    }

    self.showTree = function() {
        $(self.element.lastElementChild).remove();
        var treeViewTreeContent = $('<div id="tree-view-tree-content" class="list-group">')[0];
        self.element.appendChild(treeViewTreeContent);
        self.createBreadcrumb();
        var treeRef = self.stack[self.stack.length - 1].object;
        var parentTreeRef = self.stack.length > 1 ? self.stack[self.stack.length - 2].object : undefined;
        gitpar.git("ls-tree -l " + treeRef, function(data) {
            var blobs = [];
            var trees = [];
            if (parentTreeRef) {
                var elt =   $('<a href="#" class="list-group-item">' +
                                '<span class="tree-item-tree">..</span> ' +
                                '<span></span> ' +
                                '<span></span> ' +
                            '</a>');
                elt.click(function() {
                    self.stack.pop();
                    self.showTree();
                });
                elt.appendTo(treeViewTreeContent);
            }
            gitpar.splitLines(data).forEach(function(line) {
                var entry = new Entry(line);
                var size = entry.formatedSize()
                var elt =   $('<a href="#" class="list-group-item">' +
                                '<span>' + entry.name + '</span> ' +
                                '<span>' + size[0] + '</span>&nbsp;' +
                                '<span>' + size[1] + '</span>' +
                            '</a>')[0];
                elt.model = entry;
                var nameElt = $("span", elt)[0];
                $(nameElt).addClass("tree-item-" + entry.type);
                if (entry.isSymbolicLink()) {
                    $(nameElt).addClass("tree-item-symlink");
                }
                if (entry.type == "tree") {
                    trees.push(elt);
                    $(elt).click(function() {
                        self.stack.push({ name: elt.model.name, object: elt.model.object});
                        self.showTree();
                    });
                } else {
                    blobs.push(elt);
                    $(elt).click(function() {
                        self.stack.push({ name: elt.model.name, object: elt.model.object});
                        self.showBlob();
                    });
                }
            });
            var compare = function(a, b) {
                return a.model.name.toLowerCase().localeCompare(b.model.name.toLowerCase());
            }
            blobs.sort(compare);
            trees.sort(compare);
            trees.forEach(function (elt) {
                treeViewTreeContent.appendChild(elt);
            });
            blobs.forEach(function (elt) {
                treeViewTreeContent.appendChild(elt);
            });
        });
    }

    self.showBlob = function(blobRef) {
        self.createBreadcrumb();
        $(self.element.lastElementChild).remove();
        var container = $(  '<div id="tree-view-blob-content">' +
                                '<div class="tree-blob-toolbar"><button type="button" class="btn btn-default btn-xs tree-blame-toggle">Blame</button></div>' +
                                '<div id="tree-view-blob-text"></div>' +
                            '</div>');
        container.appendTo(self.element);
        $(".tree-blame-toggle", container).click(self.toggleBlame);
        var textContainer = $("#tree-view-blob-text", container)[0];
        gitpar.git("cat-file -p " + self.stack[self.stack.length - 1].object, function(data) {
            // Drop the single trailing newline every file ends with -
            // keeping it would draw a phantom last line.
            var lines = data.split("\n");
            if (lines.length > 0 && lines[lines.length - 1] === "") {
                lines.pop();
            }
            lines.forEach(function(text, index) {
                var row = $('<div class="tree-blob-line"><span class="tree-blob-line-num"></span><span class="tree-blob-line-text"></span></div>');
                $(".tree-blob-line-num", row).text(index + 1);
                $(".tree-blob-line-text", row).text(text);
                textContainer.appendChild(row[0]);
            });
        });
    }

    self.toggleBlame = function() {
        var existing = $("#tree-view-blame-content", self.element);
        if (existing.length > 0) {
            existing.remove();
            $("#tree-view-blob-text", self.element).show();
            return;
        }
        var path = self.getCurrentPath();
        gitpar.apiGet(
            "/api/blame?path=" + encodeURIComponent(path) + "&rev=" + encodeURIComponent(self.commitRef || "HEAD"),
            function(data) {
                $("#tree-view-blob-text", self.element).hide();
                var blameContent = $('<div id="tree-view-blame-content"></div>');
                (data.lines || []).forEach(function(line) {
                    var row = $('<div class="blame-line"><span class="blame-line-meta"></span><span class="blame-line-text"></span></div>');
                    $(".blame-line-meta", row)
                        .text((line.commit || "").substr(0, 7) + " " + (line.author || ""))
                        .attr("title", line.summary || "");
                    $(".blame-line-text", row).text(line.text);
                    blameContent.append(row);
                });
                $("#tree-view-blob-content", self.element).append(blameContent);
            },
            function(xhr) {
                gitpar.showError(gitpar.parseApiError(xhr, "Unable to blame this file"));
            }
        );
    }

    self.element = $('<div id="tree-view">')[0];
    var breadcrumb = $('<ol class="breadcrumb">')[0];
    self.element.appendChild(breadcrumb);
    self.element.appendChild($('<div id="tree-view-tree-content">')[0]);
    var stack;
}

/*
 * == CommitExplorerView =============================================================
 */
gitpar.CommitExplorerView = function(mainView, diff) {

    var self = this;
    var diffLines = diff.split("\n");
    var diffHeaderLines = [];
    var diffSections = [];
    var currentSection, line, c, lineMatch;

    self.buildDiffSections = function(diff) {
        var visitorState = 'header';

        for (var i = 0; i < diffLines.length; i++) {
            line = diffLines[i];
            c = line[0];

            switch(visitorState) {
            case 'header':
                if (c == 'd') {
                    visitorState = 'sectionHeader';
                    i -= 1;
                } else {
                    diffHeaderLines.push(line)
                }
                break;
            case 'sectionHeader':
                lineMatch = line.match(/^diff --git a\/(.*) b\/(.*)$/)
                currentSection = {
                    leftName: lineMatch[1],
                    rightName: lineMatch[2],
                    lines: []
                };
                diffSections.push(currentSection);
                visitorState = 'sectionContent';
                break;
            case 'sectionContent':
                if (c == 'd') {
                    visitorState = 'sectionHeader';
                    i -= 1;
                } else {
                    currentSection.lines.push(line);
                }
            }
        }
    }

    self.show = function() {
        mainView.switchTo(self.element);
    };

    self.displayDiffForSection = function(idx) {
        self.diffView.refresh(diffSections[idx].lines.join("\n"));
    };

    self.element = $(    '<div id="commit-explorer-view">'+
                             '<div id="commit-explorer-diff-view"></div>'+
                             '<div id="commit-explorer-navigator-view"></div>'+
                         '</div>')[0];

    var commitExplorerDiffView = $('#commit-explorer-diff-view', self.element)[0];
    var commitExplorerNavigatorView = $('#commit-explorer-navigator-view', self.element)[0];

    self.buildDiffSections(diff);

    self.diffView = new gitpar.DiffView(true, false, self);
    self.fileListView = new gitpar.FileListView(self, diffSections);
    self.commitHeaderView = new gitpar.CommitHeaderView(self, diffHeaderLines.join("\n"));

    self.displayDiffForSection(0);

    commitExplorerDiffView.appendChild(self.diffView.element);
    commitExplorerNavigatorView.appendChild(self.fileListView.element);
    commitExplorerNavigatorView.appendChild(self.commitHeaderView.element);

}

gitpar.FileListView = function(commitExplorerView, files){
    var self = this;

    self.fileSelected = function(event) {
        var index = 0;
        var sibling = event.target.previousElementSibling;
        while (sibling) {
            sibling = sibling.previousElementSibling;
            ++index;
        }
        $(".active", rightContainer).removeClass("active");
        $(".active", leftContainer).removeClass("active");
        $(rightContainer.children[index]).toggleClass("active");
        $(leftContainer.children[index]).toggleClass("active");
        commitExplorerView.displayDiffForSection(index);
    };

    self.buildLine = function(label, parent) {
        var element = $('<a class="list-group-item">' + label + '</a>')[0];
        $(element).click(self.fileSelected)
        parent.appendChild(element);
    }

    self.viewScrolled = function(event) {
        if (event.target == rightScrollView) {
            var current = rightScrollView;
            var other = leftScrollView;
        } else {
            var current = leftScrollView;
            var other = rightScrollView;
        }
        other.scrollTop = current.scrollTop;
    }

    self.element = $(   '<div class="file-list-view panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5> Files </h5>' +
                            '</div>' +
                            '<div class="file-list-container">' +
                                '<div class="file-list-left-container">' +
                                    '<div class="list-group"></div>' +
                                '</div>' +
                                '<div class="file-list-right-container">' +
                                    '<div class="list-group"></div>' +
                                '</div>' +
                            '</div>' +
                         '</div>')[0];

    var rightScrollView = $(".file-list-right-container", self.element)[0];
    var rightContainer =  $(".list-group", rightScrollView)[0];
    var leftScrollView = $(".file-list-left-container", self.element)[0];
    var leftContainer =  $(".list-group", leftScrollView)[0];

    for (var i = 0; i < files.length; ++i) {
        var lineData = files[i];
        self.buildLine(lineData.rightName, rightContainer);
        self.buildLine(lineData.leftName, leftContainer);
    }
    $(rightScrollView).scroll(self.viewScrolled);
    $(leftScrollView).scroll(self.viewScrolled);
}

/*
 * == CommitHeaderView ==============================================================
 */
gitpar.CommitHeaderView = function(commitExplorerView, header) {
    var self = this;
    self.element = $('<div class="panel panel-default">' +
                         '<div class="panel-heading">' +
                             '<h5> Commit Details </h5>' +
                         '</div>' +
                         '<div class="panel-body">' + header.split("\n").join("<br>") + '</div>' +
                     '</div>')[0];
}

/*
 * == CommitView ==============================================================
 */
gitpar.CommitView = function(historyView) {

    var self = this;

    self.update = function(entry) {
        if (currentCommit == entry.commit) {
            // We already display the right data. No need to update.
            return;

        }
        currentCommit = entry.commit;
        self.showDiff();
        buttonBox.select(0);
        diffView.update("show", [entry.commit]);
        treeView.update(entry.tree, entry.commit);
    };

    self.showDiff = function() {
        gitpar.detachChildren(commitViewContent);
        commitViewContent.appendChild(diffView.element);
    };

    self.showTree = function() {
        gitpar.detachChildren(commitViewContent);
        commitViewContent.appendChild(treeView.element);
    };

    self.historyView = historyView;
    var currentCommit = null;
    self.element = $('<div id="commit-view">')[0];
    var commitViewHeader = $('<div id="commit-view-header">')[0];
    self.element.appendChild(commitViewHeader);
    var collapseButton = $('<button type="button" class="commit-view-collapse" title="Back to the commit list">&#8601; Back</button>');
    collapseButton.click(function() {
        historyView.collapseCommit();
    });
    commitViewHeader.appendChild(collapseButton[0]);
    var buttonBox = new gitpar.TabBox([["Commit", self.showDiff], ["Tree", self.showTree]]);
    commitViewHeader.appendChild(buttonBox.element);
    var commitViewContent = $('<div id="commit-view-content">')[0];
    self.element.appendChild(commitViewContent);
    var diffView = new gitpar.DiffView(false, false, self);
    var treeView = new gitpar.TreeView(self);
};

/*
 * == CommitDetailView ========================================================
 * The full-view a commit expands into: its message across the top, then
 * a filterable list of the files it touched beside that file's diff.
 */
gitpar.CommitDetailView = function(historyView) {

    var self = this;
    self.historyView = historyView;
    self.files = [];
    self.filterText = "";
    self.selectedPath = null;

    // selectPath opens straight to a particular file, for arriving from
    // the inline card by clicking one. Without it the first file is
    // selected, as when the commit is opened as a whole.
    self.update = function(entry, selectPath) {
        self.entry = entry;
        self.selectedPath = null;
        self.pendingPath = selectPath || null;
        self.filterText = "";
        $(".commit-detail-filter", self.element).val("");
        $(".commit-detail-avatar", self.element)
            .text(gitpar.getInitials(entry.author.name))
            .attr("style", "background:" + gitpar.colorForAuthor(entry.author.name, entry.author.email));
        $(".commit-detail-meta", self.element)
            .text(gitpar.formatCommitDate(entry.author.date) + " by ")
            .append($('<span class="log-entry-card-author">').text(entry.author.name))
            .append(document.createTextNode("  "))
            .append($('<button type="button" class="log-entry-card-hash">')
                .text("(" + entry.abbrevCommitHash() + ")")
                .attr("title", entry.commit)
                .click(function() {
                    gitpar.copyToClipboard(entry.commit, "Commit hash");
                }));
        $(".commit-detail-message", self.element).text(entry.message);
        self.refreshNav();
        self.loadFiles();
    };

    self.refreshNav = function() {
        var logView = historyView.logView;
        $(".commit-detail-prev", self.element).prop("disabled", !logView.adjacentEntry(self.entry, -1));
        $(".commit-detail-next", self.element).prop("disabled", !logView.adjacentEntry(self.entry, 1));
    };

    self.step = function(delta) {
        var next = historyView.logView.adjacentEntry(self.entry, delta);
        if (next) {
            next.select();
            self.update(next);
        }
    };

    self.loadFiles = function() {
        var list = $(".commit-detail-file-list", self.element);
        list.text("Loading files…");
        var commit = self.entry.commit;
        // --root: see the matching comment on the log card's loadCardFiles.
        gitpar.git("diff-tree --no-commit-id --name-status -r -m --first-parent --root " + commit, function(data) {
            if (!self.entry || self.entry.commit != commit) {
                return;
            }
            self.files = gitpar.parseNameStatus(data);
            self.renderFiles();
            if (self.files.length == 0) {
                self.diffView.refresh("");
                self.pendingPath = null;
                return;
            }
            // Fall back to the first file if the requested one isn't in
            // this commit - the two lists come from the same command, so
            // that means something moved under us rather than a bad path.
            var wanted = self.pendingPath;
            self.pendingPath = null;
            var match = wanted && self.files.filter(function(file) {
                return file.path == wanted;
            })[0];
            self.selectFile(match ? match.path : self.files[0].path);
        });
    };

    self.matchesFilter = function(file) {
        return !self.filterText || file.path.toLowerCase().indexOf(self.filterText) != -1;
    };

    self.renderFiles = function() {
        var list = $(".commit-detail-file-list", self.element);
        list.empty();
        var shown = 0;
        self.files.forEach(function(file) {
            if (!self.matchesFilter(file)) {
                return;
            }
            ++shown;
            var row = $('<div class="commit-detail-file">' +
                            '<span class="commit-detail-file-path"></span>' +
                            '<span class="commit-detail-file-status"></span>' +
                        '</div>');
            $(".commit-detail-file-path", row).text(file.path);
            $(".commit-detail-file-status", row)
                .text(file.status)
                .addClass("log-entry-card-status-" + file.status.charAt(0));
            if (file.path == self.selectedPath) {
                row.addClass("active");
            }
            row.click(function() {
                self.selectFile(file.path);
            });
            list.append(row);
        });
        if (shown == 0) {
            list.append('<div class="commit-detail-empty">' +
                (self.files.length == 0 ? "No file changes in this commit." : "No files match this filter.") +
                '</div>');
        }
    };

    self.selectFile = function(path) {
        self.selectedPath = path;
        self.renderFiles();
        // --format= drops the commit header from `git show`; the message
        // already sits above this pane, so repeating it here would just
        // push the actual hunks off screen.
        self.diffView.update("show", ["--format=", self.entry.commit], path);
    };

    self.onFilterInput = function(event) {
        self.filterText = event.currentTarget.value.toLowerCase();
        self.renderFiles();
    };

    self.element = $(   '<div id="commit-detail-view">' +
                            '<div class="commit-detail-header">' +
                                '<span class="commit-detail-avatar"></span>' +
                                '<span class="commit-detail-meta"></span>' +
                                '<span class="commit-detail-header-actions">' +
                                    '<button type="button" class="commit-detail-btn commit-detail-prev" title="Newer commit">&#9650;</button>' +
                                    '<button type="button" class="commit-detail-btn commit-detail-next" title="Older commit">&#9660;</button>' +
                                    '<button type="button" class="commit-detail-btn commit-detail-menu" title="Show commit menu">&#8942;</button>' +
                                    '<button type="button" class="commit-detail-btn commit-detail-tree" title="Browse the tree at this commit">Tree</button>' +
                                    '<button type="button" class="commit-detail-btn commit-detail-collapse" title="Back to the commit list">&#8601; Back</button>' +
                                '</span>' +
                            '</div>' +
                            '<pre class="commit-detail-message"></pre>' +
                            '<div class="commit-detail-body">' +
                                '<div class="commit-detail-files">' +
                                    '<input type="text" class="form-control input-sm commit-detail-filter" placeholder="Filter">' +
                                    '<div class="commit-detail-file-list"></div>' +
                                '</div>' +
                                '<div class="commit-detail-diff"></div>' +
                            '</div>' +
                        '</div>')[0];

    self.diffView = new gitpar.DiffView(false, false, self);
    $(".commit-detail-diff", self.element)[0].appendChild(self.diffView.element);
    $(".commit-detail-filter", self.element).on("input", self.onFilterInput);
    $(".commit-detail-prev", self.element).click(function() { self.step(-1); });
    $(".commit-detail-next", self.element).click(function() { self.step(1); });
    $(".commit-detail-collapse", self.element).click(function() { historyView.collapseCommit(); });
    // Tree browsing has no place in the file-list layout, so it keeps
    // an explicit way in from here rather than being dropped along with
    // the old Commit/Tree tab pair.
    $(".commit-detail-tree", self.element).click(function() { historyView.showTreeForCommit(self.entry); });
    $(".commit-detail-menu", self.element).click(function(event) {
        event.stopPropagation();
        historyView.mainView.commitActionMenu.show(event.currentTarget, self.entry);
    });
};

/*
 * == HistoryView =============================================================
 */
gitpar.HistoryView = function(mainView) {

    var self = this;
    // Which commits currently have their collapsed "+N" ref pill opened.
    self.expandedRefCommits = {};

    self.show = function() {
        mainView.switchTo(self.element);
    };

    self.refreshToolbar = function() {
        // The chip list below labels itself, so the header only speaks
        // up when a filter is narrowing what's shown - otherwise the
        // subtitle is filler competing with the actual content.
        var subtitle = "";
        if (gitpar.historyAuthorFilter) {
            subtitle = "Commits by " + gitpar.historyAuthorFilter;
        } else if (gitpar.historyRef) {
            subtitle = "Showing " + gitpar.historyRef + " only";
        }
        $(".history-view-title", self.element).text("Filtered");
        $(".history-view-subtitle", self.element).text(subtitle);
        $(".history-view-toolbar", self.element).toggle(!!subtitle);
        $(".history-view-reset", self.element).prop("disabled", !gitpar.historyRef && !gitpar.historyAuthorFilter);
        self.renderRefList();
    }

    self.renderRefList = function() {
        var container = $(".history-view-refs-layer", self.element);
        container.empty();
        self.refRows = [];
        if (!gitpar.branches || gitpar.branches.length == 0) {
            container.append('<div class="toolbar-menu-empty">No branches yet.</div>');
            return;
        }
        var groups = gitpar.groupRefsByCommit(gitpar.branches, gitpar.tags);
        groups.forEach(function(group) {
            var row = $('<div class="history-view-ref-row"></div>');
            var expanded = self.expandedRefCommits[group.commit];
            // Collapsed rows hold at most one chip plus its "+N" pill,
            // which must always stay on the same line - the chip shrinks
            // (ellipsis) rather than the pill wrapping below it. Expanded
            // rows can hold many chips and still wrap across lines.
            row.toggleClass("history-view-ref-row-expanded", !!expanded);

            var addChip = function(refInfo) {
                var chipClass = "ref-chip-remote";
                if (refInfo.kind == "tag") {
                    chipClass = "ref-chip-tag";
                } else if (refInfo.kind == "local") {
                    chipClass = "ref-chip-local";
                }
                var chip = $('<button type="button" class="ref-chip history-view-ref-chip"></button>')
                    .addClass(chipClass)
                    .text(refInfo.displayName);
                if (refInfo.kind == "tag") {
                    // A tag reads as a tag at a glance; annotated ones
                    // get a filled marker, lightweight an outline.
                    chip.prepend('<span class="ref-chip-tag-mark">' +
                        (refInfo.annotated ? "&#9679;" : "&#9675;") + '</span> ');
                    chip.attr("title", (refInfo.annotated ? "Annotated tag " : "Lightweight tag ") + refInfo.displayName);
                }
                if (refInfo.current) {
                    chip.prepend('<span class="ref-chip-current">&#10003;</span> ');
                    chip.addClass("history-view-ref-current");
                }
                chip.click(function(event) {
                    event.stopPropagation();
                    mainView.refActionMenu.show(chip[0], refInfo, { commit: group.commit || "" });
                });
                row.append(chip);
            };

            if (expanded) {
                group.refs.forEach(addChip);
            } else {
                addChip(group.refs[0]);
            }

            // Only the collapsed state needs an affordance: once open,
            // clicking anywhere off the chips closes it, so a dedicated
            // collapse pill would just be one more thing on the row.
            if (group.refs.length > 1 && !expanded) {
                var hidden = group.refs.slice(1);
                var pill = $('<button type="button" class="history-view-ref-extra"></button>')
                    .text("+" + hidden.length)
                    .attr("title", hidden.map(function(r) { return r.displayName; }).join(", "));
                pill.click(function(event) {
                    event.stopPropagation();
                    self.expandedRefCommits[group.commit] = true;
                    self.renderRefList();
                });
                row.append(pill);
            }

            container.append(row);
            self.refRows.push({ commit: group.commit, element: row });
        });
        self.positionRefChips();
    }

    // Each branch label sits beside the commit it points at rather
    // than in one list at the top, so a local branch and its upstream
    // visibly sit apart when one is ahead of the other. The
    // chips are absolutely positioned against the log's own geometry
    // and the column is scrolled in step with it.
    self.positionRefChips = function() {
        if (!self.refRows || !self.logView) {
            return;
        }
        var layer = $(".history-view-refs-layer", self.element);
        var refs = $(".history-view-refs", self.element)[0];
        var offsets = self.logView.commitOffsets();
        layer.height(self.logView.contentHeight());
        // The log doesn't start level with this column - the uncommitted
        // changes summary sits above it - so offsets measured against
        // the log's content have to be shifted by that gap. Both sides
        // scroll together, so this stays a constant.
        var delta = 0;
        if (refs) {
            delta = self.logView.element.getBoundingClientRect().top - refs.getBoundingClientRect().top;
        }
        self.refRows.forEach(function(row) {
            var top = offsets[row.commit];
            if (top != undefined) {
                top += delta;
            }
            if (top == undefined) {
                // Tip isn't in the loaded range (filtered out, or below
                // the "show previous commits" cut-off).
                row.element.hide();
            } else {
                row.element.show().css("top", top + "px");
            }
        });
        self.syncRefScroll();
    }

    // Closes any opened "+N" ref group. The chips themselves stop the
    // click from bubbling, so a click that lands on one won't collapse
    // the group it belongs to.
    self.collapseExpandedRefs = function() {
        var open = Object.keys(self.expandedRefCommits).some(function(commit) {
            return self.expandedRefCommits[commit];
        });
        if (!open) {
            return;
        }
        self.expandedRefCommits = {};
        self.renderRefList();
    }

    self.syncRefScroll = function() {
        var refs = $(".history-view-refs", self.element)[0];
        if (refs && self.logView) {
            refs.scrollTop = self.logView.scrollTop();
        }
    }

    self.resetFilter = function() {
        gitpar.historyRef = null;
        gitpar.historyAuthorFilter = null;
        if (mainView.repoChrome) {
            mainView.repoChrome.focusHistoryRef(null);
        } else {
            self.update(null);
        }
    }

    self.showCommitsByAuthor = function(authorName) {
        gitpar.historyAuthorFilter = authorName;
        self.update(gitpar.historyRef);
    }

    self.update = function(ref) {
        gitpar.historyRef = ref || null;
        self.show();
        self.refreshToolbar();
        self.logView.update(ref);
        if (!gitpar.viewonly) {
            self.uncommittedSummary.update();
        }
    };

    // The commit detail pane is no longer docked beside the list; it
    // takes over the view when a commit is explicitly expanded, and
    // hands back to the list on collapse.
    self.expandCommit = function(entry, selectPath) {
        self.commitDetailView.update(entry, selectPath);
        mainView.switchTo(self.commitDetailView.element);
    };

    self.showTreeForCommit = function(entry) {
        self.commitView.update(entry);
        self.commitView.showTree();
        mainView.switchTo(self.commitView.element);
    };

    self.collapseCommit = function() {
        mainView.switchTo(self.element);
        self.logView.redrawGraph();
        // The row's inline card is never closed by expanding it further -
        // expandCommit only changes what mainView shows, so the row is
        // still selected and its card still open underneath. But
        // switchTo detaches and reattaches #history-view, and a detached
        // element's scrollTop resets to 0 in the process, so without
        // this the list snaps back to its very top: the card the reader
        // was looking at is still there, just scrolled out of view on a
        // list of any real length.
        var selected = self.logView.selectedEntry();
        if (selected) {
            selected.element.scrollIntoView({ block: "center" });
        }
    };

    // True while a commit is showing full-view rather than the list.
    // switchTo mounts exactly one view, so being attached is the test -
    // this covers the expanded commit and the tree browser reached from
    // it, both of which step back to the list.
    self.isCommitViewOpen = function() {
        return !!((self.commitDetailView && self.commitDetailView.element.parentElement) ||
                  (self.commitView && self.commitView.element.parentElement));
    };

    // The ref column spans the full sidebar so a chip for the very first
    // commit isn't pushed under a header. The filter banner floats over
    // it and only appears while a filter is narrowing the list.
    self.element = $('<div id="history-view">' +
                         '<div class="history-view-sidebar">' +
                             '<div class="history-view-refs"><div class="history-view-refs-layer"></div></div>' +
                             '<div class="history-view-toolbar">' +
                                 '<div class="history-view-title"></div>' +
                                 '<div class="history-view-subtitle"></div>' +
                                 '<button type="button" class="btn btn-default btn-xs history-view-reset">All refs</button>' +
                             '</div>' +
                         '</div>' +
                         '<div class="history-view-main"></div>' +
                     '</div>')[0];
    $(".history-view-reset", self.element).click(self.resetFilter);
    var historyMain = $(".history-view-main", self.element)[0];
    self.uncommittedSummary = new gitpar.UncommittedSummaryView(mainView);
    historyMain.appendChild(self.uncommittedSummary.element);
    self.logView = new gitpar.LogView(self);
    historyMain.appendChild(self.logView.element);
    $(self.logView.element).scroll(self.syncRefScroll);

    // .history-view-refs has overflow:hidden - it mirrors the log's
    // scroll position (syncRefScroll above) rather than scrolling on its
    // own, since its chips are placed against row geometry that has to
    // stay in step with the log rather than drift independently. That
    // also means a wheel scroll starting over it had nowhere to go.
    // Forward it to the log's own scrollable element instead; scrolling
    // that already re-syncs this column through the listener above.
    $(".history-view-refs", self.element).on("wheel", function(event) {
        self.logView.element.scrollTop += event.originalEvent.deltaY;
        event.preventDefault();
    });

    // The graph is one SVG laid over the rows, so its left edge is a
    // pixel offset read from a real row's gutter - which moves whenever
    // the rows reflow. Nothing recomputed it after the first draw, so
    // narrowing the window left the SVG parked at its old offset, out
    // past the right edge of the list: the graph vanished and the list
    // grew a horizontal scrollbar. Redrawing realigns it, and also
    // repositions the ref chips, which are placed against row centres
    // for the same reason.
    //
    // A ResizeObserver rather than window.resize: the list also changes
    // width without the window doing so - the ref column, the tab bar
    // wrapping to a second row. Observing the element catches both.
    // Frame-coalesced so a drag-resize redraws once per frame.
    var reflowPending = false;
    var reflow = function() {
        if (reflowPending) {
            return;
        }
        reflowPending = true;
        requestAnimationFrame(function() {
            reflowPending = false;
            self.logView.redrawGraph();
        });
    };
    if (window.ResizeObserver) {
        new ResizeObserver(reflow).observe(self.logView.element);
    } else {
        $(window).resize(reflow);
    }
    $(document).on("click", self.collapseExpandedRefs);
    // Capture phase, so this sees the popovers before they close. They
    // hide themselves on Escape from the bubble phase, so by then the
    // "is a menu open" answer is always no and one press would both
    // close the menu and step back a view.
    document.addEventListener("keydown", function(event) {
        if (event.key != "Escape") {
            return;
        }
        // A popover owns the key while it is open.
        if ($(".ref-action-menu.open").length > 0) {
            return;
        }
        // Escape steps back one view rather than undoing everything: from
        // a commit opened full-view it returns to the list, leaving that
        // commit expanded there, the same as the Back control. Only once
        // the list is what's showing does it collapse anything.
        if (self.isCommitViewOpen()) {
            self.collapseCommit();
            return;
        }
        // The changes card is the same kind of thing as an open commit
        // and closes on the same key.
        if (self.uncommittedSummary && self.uncommittedSummary.expanded) {
            self.uncommittedSummary.toggleExpand();
            return;
        }
        self.collapseExpandedRefs();
        self.logView.collapseSelection();
    }, true);
    // Clicking off an open commit closes it. Scoped to this view rather
    // than the document so working the toolbar - fetching, switching
    // section - doesn't shut the commit you were reading. Clicks landing
    // on a commit row are left alone: that row's own handler selects it,
    // which moves the open card rather than closing it.
    $(self.element).on("click", function(event) {
        if ($(event.target).closest(".log-entry").length == 0) {
            self.logView.collapseSelection();
        }
    });
    self.commitView = new gitpar.CommitView(self);
    self.commitDetailView = new gitpar.CommitDetailView(self);
    self.mainView = mainView;
    self.refreshToolbar();
};

/*
 * == UncommittedSummaryView ===================================================
 * The "N changed files" card pinned above the commit list.
 */
gitpar.UncommittedSummaryView = function(mainView) {

    var self = this;
    self.expanded = false;
    self.files = [];

    self.toggleExpand = function() {
        self.expanded = !self.expanded;
        self.render();
    }

    self.conflicted = function() {
        return self.files.filter(function(file) { return file.conflicted; });
    }

    // What the header says. A merge that stopped is not "3 changed
    // files" - the files are changed because git could not decide, and
    // saying which branch it was merging into is what makes the state
    // recognisable when you come back to it later.
    self.summaryTitle = function() {
        var conflicted = self.conflicted();
        if (conflicted.length > 0) {
            var current = mainView.repoChrome ? mainView.repoChrome.currentBranch() : null;
            var into = current && current.display_name ? " when merging into " + current.display_name : "";
            return conflicted.length + " conflicting file" + (conflicted.length == 1 ? "" : "s") + " found" + into;
        }
        return self.files.length + " changed file" + (self.files.length == 1 ? "" : "s");
    }

    // Where a file in this list should take you: a conflict needs
    // deciding between two versions, anything else needs its diff.
    self.openFile = function(file) {
        if (file.conflicted) {
            mainView.conflictResolveView.update(file.path);
            return;
        }
        mainView.repoChrome.showWorkspace();
        mainView.workspaceView.selectPath(file.path);
    }

    self.openFullView = function(event) {
        if (event) {
            event.stopPropagation();
        }
        var conflicted = self.conflicted();
        if (conflicted.length > 0) {
            mainView.conflictResolveView.update(conflicted[0].path);
            return;
        }
        mainView.repoChrome.showWorkspace();
    }

    self.render = function() {
        if (mainView.repoChrome) {
            mainView.repoChrome.setChangesBadge(self.files.length, self.conflicted().length);
        }
        if (self.files.length == 0) {
            $(self.element).hide();
            return;
        }
        $(self.element).show();
        $(self.element).toggleClass("uncommitted-summary-expanded", self.expanded);
        $(self.element).toggleClass("uncommitted-summary-conflicted", self.conflicted().length > 0);
        $(".uncommitted-summary-count", self.element).text(self.summaryTitle());

        // The same counts a status column would give, folded onto one
        // line: what is waiting, and of what kind.
        var counts = $(".uncommitted-summary-counts", self.element);
        counts.empty();
        gitpar.summarizeStatusCounts(self.files).forEach(function(entry) {
            var statusClass = entry.status == "?" ? "untracked" : entry.status;
            counts.append($('<span class="uncommitted-summary-tally">')
                .append($('<span class="uncommitted-summary-tally-count">').text(entry.count))
                .append($('<span class="uncommitted-summary-tally-status">')
                    .text(entry.status).addClass("uncommitted-status-" + statusClass)));
        });

        var fileList = $(".uncommitted-summary-files", self.element);
        fileList.empty();
        fileList.toggle(self.expanded);
        self.files.forEach(function(file) {
            var row = $('<div class="uncommitted-summary-file"><span class="uncommitted-summary-file-path"></span><span class="uncommitted-summary-file-status"></span></div>');
            // The row clips long paths, so the whole path lives in the
            // tooltip - a truncated path is often the half that matters.
            row.attr("title", file.path);
            $(".uncommitted-summary-file-path", row).text(file.path);
            var statusClass = file.status == "?" ? "untracked" : file.status;
            $(".uncommitted-summary-file-status", row).text(file.status).addClass("uncommitted-status-" + statusClass);
            row.click(function(event) {
                event.stopPropagation();
                self.openFile(file);
            });
            fileList.append(row);
        });
    }

    self.update = function() {
        gitpar.git("status --porcelain", function(data) {
            self.files = gitpar.parseStatusLines(data);
            self.render();
        });
    }

    self.element = $(   '<div class="uncommitted-summary">' +
                            '<div class="uncommitted-summary-header">' +
                                '<span class="uncommitted-summary-dot"></span>' +
                                '<span class="uncommitted-summary-count"></span>' +
                                '<span class="uncommitted-summary-spacer"></span>' +
                                '<span class="uncommitted-summary-counts"></span>' +
                                '<button type="button" class="uncommitted-summary-menu-btn" title="Show changes menu">&#8942;</button>' +
                                '<button type="button" class="uncommitted-summary-expand" title="Open these changes">&#8599;</button>' +
                                '<div class="uncommitted-summary-menu toolbar-menu">' +
                                    '<button type="button" class="toolbar-menu-item" data-action="open-changes">Open Changes</button>' +
                                    '<div class="toolbar-menu-divider"></div>' +
                                    '<button type="button" class="toolbar-menu-item" data-action="summary-stash-all">Stash All Changes</button>' +
                                    '<button type="button" class="toolbar-menu-item" data-action="summary-discard-all">Discard All Changes</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="uncommitted-summary-files"></div>' +
                        '</div>')[0];
    $(".uncommitted-summary-header", self.element).click(self.toggleExpand);
    $(".uncommitted-summary-expand", self.element).click(self.openFullView);
    // The same actions the Changes toolbar offers, reachable without
    // going there first. Discard is routed through the workspace view's
    // own handler, which is the one that asks before throwing work away.
    $(".uncommitted-summary-menu-btn", self.element).click(function(event) {
        event.stopPropagation();
        $(".uncommitted-summary-menu", self.element).toggle();
    });
    $(".uncommitted-summary-menu", self.element).click(function(event) {
        event.stopPropagation();
    });
    $("[data-action='open-changes']", self.element).click(function() {
        $(".uncommitted-summary-menu", self.element).hide();
        self.openFullView();
    });
    $("[data-action='summary-stash-all']", self.element).click(function() {
        $(".uncommitted-summary-menu", self.element).hide();
        mainView.workspaceView.stashChanges(false);
    });
    $("[data-action='summary-discard-all']", self.element).click(function() {
        $(".uncommitted-summary-menu", self.element).hide();
        mainView.workspaceView.discardChanges(false);
    });
    $(document).on("click", function() {
        $(".uncommitted-summary-menu", self.element).hide();
    });
    $(self.element).hide();
};

/*
 * == ConflictBannerView ======================================================
 * Shown above the diff/file lists whenever a merge or rebase is in progress
 * with unresolved conflicts, with Accept Ours/Theirs per file and Abort.
 */
gitpar.ConflictBannerView = function(workspaceView) {

    var self = this;

    self.update = function() {
        gitpar.apiGet("/api/conflicts", function(data) {
            self.render(data);
        });
    }

    self.render = function(data) {
        self.lastStatus = data;
        if (!data.merging && !data.rebasing && data.conflicted_files.length == 0) {
            $(self.element).hide();
            return;
        }
        $(self.element).show();
        var kind = data.rebasing ? "Rebase" : "Merge";
        $(".conflict-banner-title", self.element).text(kind + " in progress" + (data.conflicted_files.length > 0 ? " — " + data.conflicted_files.length + " conflicted file" + (data.conflicted_files.length == 1 ? "" : "s") : ""));

        var list = $(".conflict-banner-files", self.element);
        list.empty();
        data.conflicted_files.forEach(function(path) {
            var row = $(  '<div class="conflict-banner-file">' +
                                '<span class="conflict-banner-file-path"></span>' +
                                '<button type="button" class="btn btn-default btn-xs conflict-resolve-open">Resolve&hellip;</button>' +
                                '<button type="button" class="btn btn-default btn-xs conflict-ours">Accept Ours</button>' +
                                '<button type="button" class="btn btn-default btn-xs conflict-theirs">Accept Theirs</button>' +
                            '</div>');
            $(".conflict-banner-file-path", row).text(path);
            // Accept Ours/Theirs take a whole file; Resolve opens the
            // three panes, for the files where the answer is some of
            // each.
            $(".conflict-resolve-open", row).click(function() {
                workspaceView.mainView.conflictResolveView.update(path);
            });
            $(".conflict-ours", row).click(function() { self.resolve(path, "ours"); });
            $(".conflict-theirs", row).click(function() { self.resolve(path, "theirs"); });
            list.append(row);
        });

        $(".conflict-continue", self.element).toggle(!!data.rebasing);
    }

    self.resolve = function(path, resolution) {
        gitpar.apiPost("/api/conflicts/resolve", {path: path, resolution: resolution}, function(data) {
            self.render(data);
            workspaceView.update("stage");
        }, function(xhr) {
            gitpar.showError(gitpar.parseApiError(xhr, "Unable to resolve conflict"));
        });
    }

    self.onAbort = function() {
        if (!window.confirm("Abort the in-progress merge/rebase?")) {
            return;
        }
        var cmd = self.lastStatus && self.lastStatus.rebasing ? "rebase --abort" : "merge --abort";
        gitpar.git(cmd, function() {
            self.update();
            workspaceView.update("stage");
        });
    }

    self.onContinue = function() {
        gitpar.git("rebase --continue", function() {
            self.update();
            workspaceView.update("stage");
        });
    }

    self.element = $(   '<div class="conflict-banner">' +
                            '<div class="conflict-banner-header">' +
                                '<span class="conflict-banner-title"></span>' +
                                '<button type="button" class="btn btn-default btn-xs conflict-continue">Continue</button>' +
                                '<button type="button" class="btn btn-danger btn-xs conflict-abort">Abort</button>' +
                            '</div>' +
                            '<div class="conflict-banner-files"></div>' +
                        '</div>')[0];
    $(".conflict-abort", self.element).click(self.onAbort);
    $(".conflict-continue", self.element).click(self.onContinue);
    $(self.element).hide();
};

// The resolved file, as lines tagged with where each came from.
// Context is taken verbatim; a disputed region contributes whichever
// sides are chosen, ours before theirs, so taking both is a concatenation
// rather than a special case. Taking neither drops the region - a real
// resolution, and the only way to delete a contested block.
gitpar.buildResolvedLines = function(segments, selection) {
    var lines = [];
    for (var i = 0; i < segments.length; ++i) {
        var segment = segments[i];
        if (segment.kind != "conflict") {
            var context = segment.lines || [];
            for (var c = 0; c < context.length; ++c) {
                lines.push({ text: context[c], origin: "context" });
            }
            continue;
        }
        var choice = (selection && selection[i]) || {};
        var sides = ["ours", "theirs"];
        for (var s = 0; s < sides.length; ++s) {
            if (!choice[sides[s]]) {
                continue;
            }
            var own = segment[sides[s]] || [];
            for (var n = 0; n < own.length; ++n) {
                lines.push({ text: own[n], origin: sides[s] });
            }
        }
    }
    return lines;
}

/*
 * == ConflictResolveView =====================================================
 */
// Three panes over one conflicted file: each side's version of the
// disputed lines, and the file that will be written. Git has already
// worked out which lines correspond - that is what the markers in the
// working copy record - so the two source panes can be laid out from
// the same list of segments and stay aligned line for line.
//
// Choosing is per conflict region, not per file: a region checked in a
// pane contributes its lines to the output, in pane order, so taking
// both sides is just checking both. Nothing is written until Save.
gitpar.ConflictResolveView = function(mainView) {

    var self = this;
    var segments = [];
    // selection[i] = { ours: bool, theirs: bool } for the i-th segment.
    // Context segments have no entry - they are never in dispute.
    var selection = [];
    var path = null;

    self.element = $('<div class="conflict-resolve">' +
                         '<div class="conflict-resolve-header">' +
                             '<span class="conflict-resolve-title"></span>' +
                             '<div class="conflict-resolve-actions">' +
                                 '<button type="button" class="btn btn-primary btn-sm conflict-resolve-save">Save file</button>' +
                                 '<button type="button" class="btn btn-default btn-sm conflict-resolve-close">Close</button>' +
                             '</div>' +
                         '</div>' +
                         '<div class="conflict-resolve-sources">' +
                             '<div class="conflict-pane" data-side="ours"></div>' +
                             '<div class="conflict-pane" data-side="theirs"></div>' +
                         '</div>' +
                         '<div class="conflict-pane conflict-pane-output" data-side="output"></div>' +
                     '</div>')[0];

    // Every conflict region, in file order. The panes and the counters
    // all index into this.
    self.conflictIndexes = function() {
        var indexes = [];
        for (var i = 0; i < segments.length; ++i) {
            if (segments[i].kind == "conflict") {
                indexes.push(i);
            }
        }
        return indexes;
    }

    self.chosenCount = function(side) {
        var indexes = self.conflictIndexes();
        var chosen = 0;
        for (var i = 0; i < indexes.length; ++i) {
            if (selection[indexes[i]] && selection[indexes[i]][side]) {
                ++chosen;
            }
        }
        return chosen;
    }

    // The file as it would be written: context verbatim, and each
    // disputed region replaced by whichever sides are checked. Taking
    // neither side drops the region, which is a legitimate resolution
    // and the only way to delete a contested block.
    self.outputLines = function() {
        return gitpar.buildResolvedLines(segments, selection);
    }

    self.outputText = function() {
        var lines = self.outputLines();
        var text = [];
        for (var i = 0; i < lines.length; ++i) {
            text.push(lines[i].text);
        }
        return text.join("\n");
    }

    // A pane's rows. Both source panes walk the same segment list, so a
    // region occupies the same row range in each - which is what keeps
    // them aligned. Where one side has fewer lines than the other the
    // shorter one is padded, so the next shared line still sits on the
    // same row in both panes.
    self.paneRows = function(side) {
        var rows = [];
        var lineNumber = 0;
        for (var i = 0; i < segments.length; ++i) {
            var segment = segments[i];
            if (segment.kind == "context") {
                for (var c = 0; c < segment.lines.length; ++c) {
                    rows.push({ kind: "context", number: ++lineNumber, text: segment.lines[c] });
                }
                continue;
            }
            var own = segment[side] || [];
            var other = segment[side == "ours" ? "theirs" : "ours"] || [];
            for (var n = 0; n < own.length; ++n) {
                rows.push({ kind: "conflict", segment: i, number: ++lineNumber,
                            text: own[n], first: n == 0 });
            }
            // Padding rows carry no line number: they are not lines in
            // this version of the file, they are the space where the
            // other version has more to say.
            for (var p = own.length; p < other.length; ++p) {
                rows.push({ kind: "filler", segment: i });
            }
        }
        return rows;
    }

    self.outputRows = function() {
        var lines = self.outputLines();
        var rows = [];
        for (var i = 0; i < lines.length; ++i) {
            rows.push({ kind: lines[i].origin == "context" ? "context" : "conflict",
                        origin: lines[i].origin, number: i + 1, text: lines[i].text });
        }
        return rows;
    }

    self.renderPane = function(side) {
        var pane = $(".conflict-pane[data-side='" + side + "']", self.element);
        var isOutput = side == "output";
        var rows = isOutput ? self.outputRows() : self.paneRows(side);
        var indexes = self.conflictIndexes();

        var label = isOutput ? "Output" : (side == "ours" ? "Ours" : "Theirs");
        var ref = "";
        if (!isOutput && indexes.length > 0) {
            ref = segments[indexes[0]][side + "_label"] || "";
        }

        var header = $('<div class="conflict-pane-header">' +
                           '<label class="conflict-pane-title">' +
                               (isOutput ? '' : '<input type="checkbox" class="conflict-pane-all">') +
                               '<span class="conflict-pane-name"></span>' +
                               '<span class="conflict-pane-ref"></span>' +
                           '</label>' +
                           '<span class="conflict-pane-count"></span>' +
                       '</div>');
        $(".conflict-pane-name", header).text(label);
        $(".conflict-pane-ref", header).text(ref);
        if (isOutput) {
            $(".conflict-pane-count", header).text(rows.length + (rows.length == 1 ? " line" : " lines"));
        } else {
            var chosen = self.chosenCount(side);
            $(".conflict-pane-count", header).text(chosen + "/" + indexes.length);
            var all = $(".conflict-pane-all", header)[0];
            all.checked = indexes.length > 0 && chosen == indexes.length;
            all.indeterminate = chosen > 0 && chosen < indexes.length;
            all.disabled = indexes.length == 0;
            $(all).change(function() {
                var take = this.checked;
                for (var i = 0; i < indexes.length; ++i) {
                    selection[indexes[i]][side] = take;
                }
                self.render();
            });
        }

        var body = $('<div class="conflict-pane-body">' +
                         '<div class="conflict-minimap"></div>' +
                         '<div class="conflict-pane-scroll"><div class="conflict-lines"></div></div>' +
                     '</div>');
        var lines = $(".conflict-lines", body);

        for (var r = 0; r < rows.length; ++r) {
            var row = rows[r];
            var element = $('<div class="conflict-line">' +
                                '<span class="conflict-line-pick"></span>' +
                                '<span class="conflict-line-number"></span>' +
                                '<span class="conflict-line-text"></span>' +
                            '</div>');
            element.addClass("conflict-line-" + row.kind);
            if (row.origin) {
                element.addClass("conflict-line-from-" + row.origin);
            }
            if (row.kind != "filler") {
                $(".conflict-line-number", element).text(row.number);
                $(".conflict-line-text", element).text(row.text);
            }
            if (row.kind == "conflict" && !isOutput) {
                element.addClass("conflict-line-" + side);
                var chosenHere = selection[row.segment] && selection[row.segment][side];
                element.toggleClass("conflict-line-chosen", !!chosenHere);
                // One checkbox per region, on its first line - a region
                // is taken or not taken as a whole, which is what the
                // markers describe.
                if (row.first) {
                    var box = $('<input type="checkbox" class="conflict-line-check">');
                    box[0].checked = !!chosenHere;
                    (function(segmentIndex) {
                        box.change(function() {
                            selection[segmentIndex][side] = this.checked;
                            self.render();
                        });
                    })(row.segment);
                    $(".conflict-line-pick", element).append(box);
                }
                // The whole region responds to a click, not just the
                // checkbox - the rows are small targets.
                (function(segmentIndex) {
                    element.click(function(event) {
                        if ($(event.target).is("input")) {
                            return;
                        }
                        selection[segmentIndex][side] = !selection[segmentIndex][side];
                        self.render();
                    });
                })(row.segment);
            }
            lines.append(element);
        }

        pane.empty().append(header).append(body);
        self.drawMinimap(pane, rows, side);
        return pane;
    }

    // A bar standing for the whole file, with a mark at each disputed
    // region and a window showing what is on screen. Marks are placed
    // by row index, and the panes share a row count, so a conflict sits
    // at the same height in all three - the bars read across as one
    // instrument rather than three separate scrollbars.
    self.drawMinimap = function(pane, rows, side) {
        var minimap = $(".conflict-minimap", pane);
        var scroll = $(".conflict-pane-scroll", pane)[0];
        if (rows.length == 0) {
            return;
        }
        var runs = [];
        var start = -1;
        for (var i = 0; i <= rows.length; ++i) {
            var isConflict = i < rows.length && rows[i].kind == "conflict";
            if (isConflict && start == -1) {
                start = i;
            } else if (!isConflict && start != -1) {
                runs.push({ from: start, to: i, origin: rows[start].origin });
                start = -1;
            }
        }
        for (var r = 0; r < runs.length; ++r) {
            var run = runs[r];
            var mark = $('<span class="conflict-minimap-mark">');
            // A single-line region would round to nothing, so every
            // mark is given a floor - the bar's job is to say "there is
            // something here", which a zero-height mark cannot do.
            mark.css({
                top: (100 * run.from / rows.length) + "%",
                height: "max(2px, " + (100 * (run.to - run.from) / rows.length) + "%)"
            });
            mark.addClass("conflict-minimap-mark-" + (run.origin || side));
            minimap.append(mark);
        }
        var viewport = $('<span class="conflict-minimap-viewport">');
        minimap.append(viewport);

        var sync = function() {
            var height = scroll.scrollHeight || 1;
            viewport.css({
                top: (100 * scroll.scrollTop / height) + "%",
                height: (100 * scroll.clientHeight / height) + "%"
            });
        };
        $(scroll).scroll(sync);
        // Laid out after the pane is in the document, so clientHeight
        // is real; until then every viewport would read full height.
        window.setTimeout(sync, 0);

        var scrollToPoint = function(event) {
            var box = minimap[0].getBoundingClientRect();
            var ratio = (event.clientY - box.top) / (box.height || 1);
            scroll.scrollTop = ratio * scroll.scrollHeight - scroll.clientHeight / 2;
        };
        minimap.mousedown(function(event) {
            event.preventDefault();
            scrollToPoint(event);
            var move = function(moveEvent) { scrollToPoint(moveEvent); };
            var up = function() {
                $(document).off("mousemove", move).off("mouseup", up);
            };
            $(document).on("mousemove", move).on("mouseup", up);
        });
    }

    // The two source panes are padded to a common row count precisely
    // so a conflict sits at the same height in both; letting them
    // scroll apart would throw that away. They move together, with a
    // guard so echoing each other's scroll events doesn't loop.
    self.linkSourceScrolling = function() {
        var panes = [];
        $(".conflict-resolve-sources .conflict-pane-scroll", self.element).each(function() {
            panes.push(this);
        });
        if (panes.length < 2) {
            return;
        }
        var syncing = false;
        for (var i = 0; i < panes.length; ++i) {
            (function(source) {
                $(source).scroll(function() {
                    if (syncing) {
                        return;
                    }
                    syncing = true;
                    for (var j = 0; j < panes.length; ++j) {
                        if (panes[j] !== source) {
                            panes[j].scrollTop = source.scrollTop;
                        }
                    }
                    syncing = false;
                });
            })(panes[i]);
        }
    }

    self.render = function() {
        // Scroll positions are restored so that choosing a side does
        // not throw away where the reader was in a long file.
        var offsets = {};
        $(".conflict-pane", self.element).each(function() {
            var scroll = $(".conflict-pane-scroll", this)[0];
            if (scroll) {
                offsets[$(this).attr("data-side")] = scroll.scrollTop;
            }
        });
        self.renderPane("ours");
        self.renderPane("theirs");
        self.renderPane("output");
        self.linkSourceScrolling();
        $(".conflict-pane", self.element).each(function() {
            var side = $(this).attr("data-side");
            var scroll = $(".conflict-pane-scroll", this)[0];
            if (scroll && offsets[side] !== undefined) {
                scroll.scrollTop = offsets[side];
            }
        });
        $(".conflict-resolve-title", self.element).text("Conflicts in " + path);
    }

    self.update = function(filePath) {
        path = filePath;
        gitpar.apiGet("/api/conflicts/file?path=" + encodeURIComponent(filePath), function(data) {
            segments = data.segments || [];
            selection = [];
            for (var i = 0; i < segments.length; ++i) {
                // Nothing is taken by default. A resolution should be
                // something the reader chose, not something they were
                // handed and had to notice was wrong.
                selection[i] = segments[i].kind == "conflict" ? { ours: false, theirs: false } : null;
            }
            self.render();
            mainView.switchTo(self.element);
        });
    }

    $(".conflict-resolve-save", self.element).click(function() {
        gitpar.apiPost("/api/conflicts/save",
                       { path: path, content: self.outputText(), stage: true },
                       function() {
                           mainView.repoChrome.showWorkspace();
                       });
    });

    $(".conflict-resolve-close", self.element).click(function() {
        mainView.repoChrome.showWorkspace();
    });
}

/*
 * == WorkspaceView ===========================================================
 */
gitpar.WorkspaceView = function(mainView) {

    var self = this;
    self.mainView = mainView;

    self.show = function() {
        mainView.switchTo(self.element);
    };

    // The main toolbar's hunk-step / options / focus cluster proxies to
    // whichever diff is currently loaded here - DiffView calls this after
    // every refresh (selecting a file, clearing the selection, changing
    // context lines, ...) so that cluster never goes stale or dangles on
    // a file that's no longer shown.
    self.onDiffRefreshed = function() {
        mainView.repoChrome.showDiffControls(self.diffView);
    };

    // Hides the sidebar (file list + message box) so the diff fills the
    // window width, for reading a large diff. Toggled from the same
    // toolbar cluster.
    self.toggleFocusMode = function() {
        return $(self.element).toggleClass("workspace-focus-mode").hasClass("workspace-focus-mode");
    };

    // Opens the Changes view on one particular file. The two lists are
    // rebuilt from a git call, so the selection is applied once they
    // have been - and a staged-only file is looked for in the second
    // list when the first does not hold it.
    self.selectPath = function(path) {
        self.show();
        // Either list may hold the path and both are rebuilt from their
        // own git call, so each tries as it finishes and the first to
        // find it wins - which works whichever order they return in.
        var found = false;
        var tryIn = function(view) {
            return function() {
                if (!found) {
                    found = view.selectPath(path);
                }
            };
        };
        self.workingCopyView.update(tryIn(self.workingCopyView));
        self.stagingAreaView.update(tryIn(self.stagingAreaView));
        self.commitMessageView.update();
        self.conflictBanner.update();
    }

    self.update = function(mode) {
        self.show();
        self.workingCopyView.update();
        self.stagingAreaView.update();
        self.commitMessageView.update();
        self.conflictBanner.update();
        if (self.workingCopyView.getSelectedItemsCount() + self.stagingAreaView.getSelectedItemsCount() == 0) {
            self.diffView.update(undefined, undefined, undefined, mode);
        } else {
            // A selection survived from before this view was last shown -
            // its diff never changed, so DiffView.refresh() (the usual
            // trigger for onDiffRefreshed) doesn't run again on its own.
            self.onDiffRefreshed();
        }
    };

    self.onFilterInput = function(event) {
        var query = event.currentTarget.value.toLowerCase();
        self.workingCopyView.applyFilter(query);
        self.stagingAreaView.applyFilter(query);
    }

    self.closeDropdowns = function() {
        $(".workspace-dropdown-menu", self.element).removeClass("open").hide();
    }

    self.toggleDropdown = function(name) {
        var menu = $(".workspace-dropdown-menu[data-dropdown='" + name + "']", self.element);
        var willOpen = !menu.hasClass("open");
        self.closeDropdowns();
        if (willOpen) {
            menu.addClass("open").show();
        }
    }

    self.stashChanges = function(selectedOnly) {
        var files = selectedOnly ? self.workingCopyView.getFileList() + self.stagingAreaView.getFileList() : "";
        var cmd = selectedOnly && files.trim().length > 0 ? "stash push -- " + files : "stash push";
        gitpar.git(cmd, function(data) {
            gitpar.showResult("Stash created", data || "Changes stashed");
            self.update("stage");
        });
    }

    self.discardChanges = function(selectedOnly) {
        if (!window.confirm(selectedOnly ? "Discard selected changes?" : "Discard all changes?")) {
            return;
        }
        if (selectedOnly) {
            self.workingCopyView.cancel();
            self.stagingAreaView.cancel();
        } else {
            gitpar.git("checkout -- .", function() {
                self.update("stage");
            });
        }
    }

    self.element = $(   '<div id="workspace-view">' +
                            '<div class="workspace-toolbar">' +
                                '<span class="workspace-changed-count"></span>' +
                                '<input type="text" class="form-control input-sm workspace-filter" placeholder="Filter">' +
                                '<div class="workspace-dropdown">' +
                                    '<button type="button" class="btn btn-default btn-sm workspace-dropdown-btn" data-dropdown="stash">Stash &#9662;</button>' +
                                    '<div class="workspace-dropdown-menu toolbar-menu" data-dropdown="stash">' +
                                        '<button type="button" class="toolbar-menu-item" data-action="stash-all">Stash All Changes</button>' +
                                        '<button type="button" class="toolbar-menu-item" data-action="stash-selected">Stash Selected Changes</button>' +
                                        '<div class="toolbar-menu-divider"></div>' +
                                        '<button type="button" class="toolbar-menu-item" data-action="view-stashes">View Stashes&hellip;</button>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="workspace-dropdown">' +
                                    '<button type="button" class="btn btn-default btn-sm workspace-dropdown-btn" data-dropdown="discard">Discard &#9662;</button>' +
                                    '<div class="workspace-dropdown-menu toolbar-menu" data-dropdown="discard">' +
                                        '<button type="button" class="toolbar-menu-item" data-action="discard-all">Discard All Changes</button>' +
                                        '<button type="button" class="toolbar-menu-item" data-action="discard-selected">Discard Selected Changes</button>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="conflict-banner"></div>' +
                            '<div id="workspace-body">' +
                                '<div id="workspace-sidebar">' +
                                    '<div id="workspace-file-lists"></div>' +
                                '</div>' +
                                '<div id="workspace-diff-view"></div>' +
                            '</div>' +
                        '</div>')[0];
    $(".workspace-filter", self.element).on("input", self.onFilterInput);
    $(".workspace-dropdown-btn", self.element).click(function(event) {
        event.stopPropagation();
        self.toggleDropdown(event.currentTarget.getAttribute("data-dropdown"));
    });
    $(".workspace-dropdown-menu", self.element).click(function(event) {
        event.stopPropagation();
    });
    $("[data-action='stash-all']", self.element).click(function() { self.closeDropdowns(); self.stashChanges(false); });
    $("[data-action='stash-selected']", self.element).click(function() { self.closeDropdowns(); self.stashChanges(true); });
    $("[data-action='discard-all']", self.element).click(function() { self.closeDropdowns(); self.discardChanges(false); });
    $("[data-action='discard-selected']", self.element).click(function() { self.closeDropdowns(); self.discardChanges(true); });
    $("[data-action='view-stashes']", self.element).click(function() { self.closeDropdowns(); mainView.stashesView.show(); });
    $(document).on("click", self.closeDropdowns);
    $(document).on("keydown", function(event) {
        if (event.key == "Escape") {
            self.closeDropdowns();
        }
    });

    self.conflictBanner = new gitpar.ConflictBannerView(self);
    $(".conflict-banner", self.element).replaceWith(self.conflictBanner.element);
    var workspaceDiffView = $("#workspace-diff-view", self.element)[0];
    self.diffView = new gitpar.DiffView(true, true, self);
    workspaceDiffView.appendChild(self.diffView.element);
    var workspaceSidebar = $("#workspace-sidebar", self.element)[0];
    var workspaceFileLists = $("#workspace-file-lists", self.element)[0];
    // Staged and unstaged live in the same scrollable sidebar column, one
    // above the other - closer to a single unified file list - but stay
    // two labeled, independently selectable sections rather than merging
    // into one list, since staging here is still an explicit multi-select
    // + Stage/Unstage action rather than a single stage-everything toggle.
    self.stagingAreaView = new gitpar.ChangedFilesView(self, "staging-area", "Staged Changes");
    workspaceFileLists.appendChild(self.stagingAreaView.element);
    self.workingCopyView = new gitpar.ChangedFilesView(self, "working-copy", "Changes");
    workspaceFileLists.appendChild(self.workingCopyView.element);
    self.commitMessageView = new gitpar.CommitMessageView(self);
    workspaceSidebar.appendChild(self.commitMessageView.element);

    // Only relevant once both lists exist - refreshCounter() (called by
    // each list after every update or selection change) drives this.
    self.refreshChangedCount = function() {
        var total = self.workingCopyView.filesCount + self.stagingAreaView.filesCount;
        $(".workspace-changed-count", self.element).text(
            total == 0 ? "No changes" : total + (total == 1 ? " changed file" : " changed files"));
    };
    self.refreshChangedCount();
};

/*
 * == ChangedFilesView ========================================================
 */
gitpar.ChangedFilesView = function(workspaceView, type, label) {

    var self = this;

    // Guards against two overlapping calls to update() - switching
    // repo tabs, a remote action's own refresh, and a second click can
    // each start one before the last has come back. status --porcelain
    // is async, so the request that answers second isn't necessarily
    // the one that was sent second; without this, whichever response
    // arrived would append its own full set of rows on top of
    // whatever the other one had already appended, since neither
    // response knows the other exists. Only the response matching the
    // generation current at the time it arrives is allowed to render -
    // an overtaken one is dropped instead of appended.
    self.updateGeneration = 0;

    self.update = function(onReady) {
        var generation = ++self.updateGeneration;
        $(fileList).empty()
        var col = type == "working-copy" ? 1 : 0;
        gitpar.git("status --porcelain", function(data) {
            if (generation != self.updateGeneration) {
                return;
            }
            self.filesCount = 0;
            gitpar.splitLines(data).forEach(function(line) {
                var status = line[col];
                if (col == 0 && status != " " && status != "?" || col == 1 && status != " ") {
                    ++self.filesCount;
                    var item = $('<a class="list-group-item"><span class="changed-file-check"></span><span class="changed-file-path"></span><span class="changed-file-status"></span></a>').appendTo(fileList)[0];
                    item.status = status;
                    line = line.substr(3);
                    var splitted = line.split(" -> ");
                    if (splitted.length > 1) {
                        item.model = splitted[1];
                    } else {
                        item.model = line
                    }
                    $(".changed-file-path", item).text(line);
                    var statusClass = status == "?" ? "untracked" : status;
                    $(".changed-file-status", item).text(status).addClass("uncommitted-status-" + statusClass);
                    if (status == "?") {
                        var ignoreBtn = $('<button type="button" class="btn btn-link btn-xs changed-file-ignore" title="Add to .gitignore">ignore</button>');
                        var ignoreModel = item.model;
                        ignoreBtn.click(function(event) {
                            event.stopPropagation();
                            gitpar.apiPost("/api/gitignore/add", {pattern: ignoreModel}, function(data) {
                                gitpar.showResult("Updated .gitignore", data.message);
                                workspaceView.update("stage");
                            }, function(xhr) {
                                gitpar.showError(gitpar.parseApiError(xhr, "Unable to update .gitignore"));
                            });
                        });
                        ignoreBtn.appendTo(item);
                    }
                    $(item).click(self.select);
                    $(item).dblclick(self.process);
                }
            });
            if (selectedIndex !== null && selectedIndex >= fileList.childElementCount) {
                selectedIndex = fileList.childElementCount - 1;
                if (selectedIndex == -1) {
                    selectedIndex = null;
                }
            }
            if (selectedIndex !== null) {
                var selectedNode = fileList.children[selectedIndex];
                $(selectedNode).addClass("active");
                self.refreshDiff(selectedNode);
            }
            fileListContainer.scrollTop = prevScrollTop;
            self.refreshCounter();
            if (onReady) {
                onReady();
            }
        });
    };

    // Selects the row for a path, if this list holds it. Used when
    // arriving from somewhere that already knows which file it wants -
    // clicking one in the changes card, say.
    self.selectPath = function(path) {
        for (var i = 0; i < fileList.children.length; ++i) {
            var item = fileList.children[i];
            if (item.model == path) {
                $(item).click();
                item.scrollIntoView({ block: "nearest" });
                return true;
            }
        }
        return false;
    }

    self.select = function(event) {
        var clicked = event.target;

        if (event.shiftKey && selectedIndex !== null) {
            var clickedIndex = gitpar.getNodeIndex(clicked);
            if (clickedIndex < selectedIndex) {
                var from = clickedIndex;
                var to = selectedIndex;
            } else {
                var from = selectedIndex;
                var to = clickedIndex;
            }
            for (var i = from; i <= to; ++i) {
                $(fileList.children[i]).addClass("active");
            }
            selectedIndex = clickedIndex;
        } else if (event.ctrlKey) {
            $(clicked).toggleClass("active");
            selectedIndex = gitpar.getNodeIndex(clicked);
        } else {
            for (var i = 0; i < fileList.childElementCount; ++i) {
                $(fileList.children[i]).removeClass("active");
            }
            $(clicked).addClass("active");
            selectedIndex = gitpar.getNodeIndex(clicked);
        }
        if (type == "working-copy") {
            workspaceView.stagingAreaView.unselect();
        } else {
            workspaceView.workingCopyView.unselect();
        }
        self.refreshCounter();
        self.refreshDiff(clicked);
    };

    self.refreshDiff = function(element) {
        var gitOpts = [];
        if (type == "staging-area") {
            gitOpts.push("--cached");
        }
        workspaceView.diffView.update("diff", gitOpts, element.model, type == "working-copy" ? "stage" : "unstage");
    };

    self.unselect = function() {
        if (selectedIndex !== null) {
            $(fileList.children[selectedIndex]).removeClass("active");
            selectedIndex = null;
        }
        self.refreshCounter();
    };

    self.getFileList = function(including, excluding) {
        var files = "";
        for (var i = 0; i < fileList.childElementCount; ++i) {
            var child = fileList.children[i];
            var included = including == undefined || including.indexOf(child.status) != -1;
            var excluded = excluding != undefined && excluding.indexOf(child.status) != -1;
            if ($(child).hasClass("active") && included && !excluded) {
                files += '"' + (child.model) + '" ';
            }
        }
        return files;
    }

    self.process = function() {
        prevScrollTop = fileListContainer.scrollTop;
        var files = self.getFileList(undefined, "D");
        var rmFiles = self.getFileList("D");
        if (files.length != 0) {
            var cmd = type == "working-copy" ? "add" : "reset";
            gitpar.git(cmd + " -- " + files, function(data) {
                if (rmFiles.length != 0) {
                    gitpar.git("rm -- " + rmFiles, function(data) {
                        workspaceView.update(type == "working-copy" ? "stage" : "unstage");
                    });
                } else {
                    workspaceView.update(type == "working-copy" ? "stage" : "unstage");
                }
            });
        } else if (rmFiles.length != 0) {
            var cmd = type == "working-copy" ? "rm" : "reset";
            gitpar.git(cmd + " -- " + rmFiles, function(data) {
                workspaceView.update(type == "working-copy" ? "stage" : "unstage");
            });
        }
    };

    self.cancel = function() {
        prevScrollTop = fileListContainer.scrollTop;
        var files = self.getFileList();
        if (files.length != 0) {
            gitpar.git("checkout -- " + files, function(data) {
                workspaceView.update("stage");
            });
        }
    }

    self.getSelectedItemsCount = function() {
        return $(".active", fileList).length;
    }

    // "N/M" next to a tick heading the file list, doubling as a click
    // target that selects or clears the whole list at once.
    self.refreshCounter = function() {
        var total = fileList.childElementCount;
        var selected = self.getSelectedItemsCount();
        $(".changed-files-count", self.element).text(selected + "/" + total);
        $(".changed-files-toggle", self.element).toggle(total > 0);
        $(".changed-files-check", self.element).toggleClass("checked", total > 0 && selected == total);
        // Staged and unstaged share one sidebar column now - an empty
        // section (usually "Staged Changes", before anything is staged)
        // would otherwise sit there as dead space, so it only takes up
        // room once it actually has something to show.
        $(self.element).toggle(total > 0);
        if (workspaceView.refreshChangedCount) {
            workspaceView.refreshChangedCount();
        }
    }

    self.toggleAll = function() {
        var total = fileList.childElementCount;
        var selectAll = self.getSelectedItemsCount() < total;
        for (var i = 0; i < total; ++i) {
            $(fileList.children[i]).toggleClass("active", selectAll);
        }
        selectedIndex = selectAll && total > 0 ? total - 1 : null;
        if (selectAll && total > 0) {
            self.refreshDiff(fileList.children[total - 1]);
        }
        self.refreshCounter();
    }

    self.applyFilter = function(query) {
        for (var i = 0; i < fileList.childElementCount; ++i) {
            var child = fileList.children[i];
            $(child).toggle(!query || child.model.toLowerCase().indexOf(query) != -1);
        }
    }

    self.element = $(   '<div id="' + type + '-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<button type="button" class="changed-files-toggle" title="Select or clear every file">' +
                                    '<span class="changed-files-check"></span>' +
                                    '<span class="changed-files-count"></span>' +
                                '</button>' +
                                '<h5>'+ label + '</h5>' +
                                '<div class="btn-group btn-group-sm"></div>' +
                            '</div>' +
                            '<div class="file-list-container">' +
                                '<div class="list-group"></div>' +
                            '</div>' +
                        '</div>')[0];
    if (type == "working-copy") {
        var buttons = [{ name: "Stage", callback: self.process }, { name: "Cancel", callback: self.cancel }];
    } else {
        var buttons = [{ name: "Unstage", callback: self.process }];
    }
    var btnGroup = $(".btn-group", self.element);
    buttons.forEach(function (btnData) {
        var btn = $('<button type="button" class="btn btn-default">' + btnData.name + '</button>')
        btn.appendTo(btnGroup);
        btn.click(btnData.callback);
    });
    var fileListContainer = $(".file-list-container", self.element)[0];
    var prevScrollTop = fileListContainer.scrollTop;
    var fileList = $(".list-group", fileListContainer)[0];
    var selectedIndex = null;

    $(".changed-files-toggle", self.element).click(self.toggleAll);
    self.filesCount = 0;
    self.refreshCounter();
};

/*
 * == CommitMessageView =======================================================
 */
gitpar.CommitMessageView = function(workspaceView) {

    var self = this;

    self.onAmend = function() {
        if (!amend.hasClass("active") && textArea.value.length == 0) {
            gitpar.git("log --pretty=format:%B -n 1", function(data) {
                textArea.value = data;
            });
        }
    };

    self.onCommit = function() {
        if (workspaceView.stagingAreaView.filesCount == 0 && !amend.hasClass("active")) {
            gitpar.showError("No files staged for commit");
        } else if (textArea.value.length == 0) {
            gitpar.showError("Enter a commit message first");
        } else {
            var cmd = "commit ";
            if (amend.hasClass("active")) {
                cmd += "--amend ";
            }
            cmd += "--file=-";
            gitpar.git(cmd, textArea.value, function(data) {
                textArea.value = "";
                workspaceView.update("stage");
                amend.removeClass("active");
            });
        }
    }

    self.update = function() {
        if (gitpar.gitUserName) {
            $(".commit-message-commit", self.element).text("Commit as " + gitpar.gitUserName);
            return;
        }
        gitpar.git("config user.name", function(data) {
            gitpar.gitUserName = data.trim() || "you";
            $(".commit-message-commit", self.element).text("Commit as " + gitpar.gitUserName);
        });
    }

    self.element = $(   '<div id="commit-message-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5>Message</h5>' +
                                '<div class="btn-group btn-group-sm">' +
                                    '<button type="button" class="btn btn-default commit-message-amend" data-toggle="button">Amend</button>' +
                                '</div>' +
                            '</div>' +
                            '<textarea placeholder="Message (Ctrl + Enter to commit)"></textarea>' +
                            '<button type="button" class="btn btn-primary commit-message-commit">Commit</button>' +
                        '</div>')[0];
    var textArea = $("textarea", self.element)[0];
    var amend = $(".commit-message-amend", self.element);
    amend.click(self.onAmend);
    $(".commit-message-commit", self.element).click(self.onCommit);
    $(textArea).on("keydown", function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key == "Enter") {
            event.preventDefault();
            self.onCommit();
        }
    });
};

/*
 * == BranchesView =============================================================
 * A dedicated Local / Remote branch list.
 */
gitpar.BranchesView = function(mainView) {

    var self = this;
    self.branches = [];
    self.filterText = "";

    self.show = function() {
        mainView.switchTo(self.element);
    }

    self.buildRefInfo = function(branch) {
        if (branch.local_name) {
            return {
                kind: "local",
                fullName: "refs/heads/" + branch.local_name,
                displayName: branch.local_name,
                gitRef: branch.local_name,
                commit: branch.commit,
            };
        }
        return {
            kind: "remote",
            fullName: "refs/remotes/" + branch.remote_name,
            displayName: branch.remote_name,
            gitRef: branch.remote_name,
            commit: branch.commit,
        };
    }

    self.onRowClick = function(event) {
        // RefActionMenu closes itself on any document click, so this
        // click must not bubble - otherwise it would close the menu
        // this very handler is opening.
        event.stopPropagation();
        var row = event.currentTarget;
        var branch = self.branches[parseInt(row.getAttribute("data-index"), 10)];
        var refInfo = self.buildRefInfo(branch);
        mainView.refActionMenu.show(row, refInfo, { commit: branch.commit || "" });
    }

    self.matchesFilter = function(branch) {
        if (!self.filterText) {
            return true;
        }
        var haystack = (branch.display_name || "") + " " + (branch.local_name || "") + " " + (branch.remote_name || "");
        return haystack.toLowerCase().indexOf(self.filterText) != -1;
    }

    self.render = function() {
        var list = $(".branches-list", self.element);
        list.empty();

        self.branches.forEach(function(branch, index) {
            if (!self.matchesFilter(branch)) {
                return;
            }
            var barClass = "branches-row-bar-remote";
            if (branch.current) {
                barClass = "branches-row-bar-current";
            } else if (branch.local_name) {
                barClass = "branches-row-bar-local";
            }

            var leftLabel = "";
            if (branch.current) {
                leftLabel = "Current Branch";
            } else if (branch.ahead > 0 || branch.behind > 0) {
                leftLabel = branch.ahead + " Ahead, " + branch.behind + " Behind";
            }

            var row = $(  '<div class="branches-row" data-index="' + index + '">' +
                                '<div class="branches-row-label"></div>' +
                                '<div class="branches-row-bar ' + barClass + '">' +
                                    '<span class="branches-row-local"></span>' +
                                    '<span class="branches-row-remote"></span>' +
                                '</div>' +
                                '<div class="branches-row-date"></div>' +
                            '</div>');
            $(".branches-row-label", row).text(leftLabel);
            $(".branches-row-local", row).text((branch.current ? "✓ " : "") + (branch.local_name || ""));
            $(".branches-row-remote", row).text(branch.remote_name || "");
            $(".branches-row-date", row).text(branch.last_updated || "");
            row.click(self.onRowClick);
            list.append(row);
        });

        if (list.children().length == 0) {
            list.append('<div class="branches-empty">No branches match this filter.</div>');
        }
    }

    self.update = function() {
        self.show();
        gitpar.apiGet("/api/branches", function(data) {
            self.branches = data.branches || [];
            self.render();
        });
    }

    self.onFilterInput = function(event) {
        self.filterText = event.currentTarget.value.toLowerCase();
        self.render();
    }

    self.element = $(   '<div id="branches-view">' +
                            '<div class="branches-toolbar">' +
                                '<input type="text" class="form-control input-sm branches-filter" placeholder="Find a branch">' +
                            '</div>' +
                            '<div class="branches-header">' +
                                '<div class="branches-header-local">Local</div>' +
                                '<div class="branches-header-remote">Remote</div>' +
                            '</div>' +
                            '<div class="branches-list"></div>' +
                        '</div>')[0];
    $(".branches-filter", self.element).on("input", self.onFilterInput);
};

/*
 *  == Initialization =========================================================
 */
function MainUi() {

    var self = this;

    self.switchTo = function(element) {
        gitpar.detachChildren(self.mainView);
        self.mainView.appendChild(element);
    }

    self.bootstrap = function(context) {
        var postAction = sessionStorage.getItem("gitpar-post-action");
        if (postAction) {
            sessionStorage.removeItem("gitpar-post-action");
        }
        var flashMessage = gitpar.consumeFlashMessage();

        gitpar.repo = context.repo_name || "/";
        gitpar.repoPath = context.repo_path;
        gitpar.recentRepos = context.recent_repos || [];
        gitpar.activeRepoId = context.repo_id || null;
        gitpar.openRepos = context.open_repos || [];
        gitpar.workspacePath = context.workspace_path;
        gitpar.recentWorkspaces = context.recent_workspaces || [];
        gitpar.workspaceRepos = context.workspace_repos || [];
        gitpar.viewonly = context.view_only;
        gitpar.platform = context.platform || "";
        gitpar.adoptTheme(context.theme);
        gitpar.adoptPullStrategy(context.pull_strategy);
        gitpar.adoptAutoFetchPreference(context.auto_fetch);

        var title = $("title")[0];
        title.textContent = context.has_repo ? "Git - " + gitpar.repo : "GitPar";

        var body = $("body")[0];
        $('<div id="message-box">').appendTo(body);

        self.repoPicker = new gitpar.RepoPicker(self);
        body.appendChild(self.repoPicker.element);
        self.refActionMenu = new gitpar.RefActionMenu(self);
        self.commitActionMenu = new gitpar.CommitActionMenu(self);
        self.searchOverlay = new gitpar.SearchOverlay(self);
        self.configureRemotesView = new gitpar.ConfigureRemotesView();
        self.credentialsView = new gitpar.CredentialsView();
        self.worktreesView = new gitpar.WorktreesView(self);
        self.stashesView = new gitpar.StashesView(self);
        self.reflogView = new gitpar.ReflogView(self);
        self.submodulesView = new gitpar.SubmodulesView(self);
        self.interactiveRebaseView = new gitpar.InteractiveRebaseView(self);

        self.repoChrome = new gitpar.Toolbar(self);
        body.appendChild(self.repoChrome.element);
        self.repoChrome.update();

        var globalContainer = $('<div id="global-container">').appendTo(body)[0];
        self.mainView = $('<div id="main-view">')[0];
        globalContainer.appendChild(self.mainView);

        if (context.has_repo) {
            self.historyView = new gitpar.HistoryView(self);
            self.branchesView = new gitpar.BranchesView(self);
            if (!gitpar.viewonly) {
                self.workspaceView = new gitpar.WorkspaceView(self);
                self.conflictResolveView = new gitpar.ConflictResolveView(self);
            }
            if (postAction == "workspace" && self.workspaceView) {
                self.workspaceView.update("stage");
                self.repoChrome.activateSection("workspace");
            } else if (postAction == "history") {
                self.historyView.update(gitpar.historyRef);
                self.repoChrome.activateSection("history");
            } else {
                self.historyView.update(gitpar.historyRef);
            }
        } else {
            self.switchTo(new gitpar.NoRepoView(self).element);
        }

        if (flashMessage) {
            gitpar.showModal(
                flashMessage.title || (flashMessage.type == "error" ? "Error" : "Result"),
                flashMessage.message || "",
                flashMessage.type == "error" ? "error" : "info"
            );
        }
    }

    gitpar.apiGet("/api/context", self.bootstrap);
}

$(document).ready(function () {
    new MainUi()
});
