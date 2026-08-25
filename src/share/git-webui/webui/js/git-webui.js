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

var webui = webui || {};

webui.repo = "/";
webui.repoPath = null;
webui.recentRepos = [];
webui.activeRepoId = null;
webui.openRepos = [];
webui.workspacePath = null;
webui.recentWorkspaces = [];
webui.workspaceRepos = [];
webui.branches = [];
webui.viewonly = false;
webui.historyRef = null;

webui.COLORS = ["#ffab1d", "#fd8c25", "#f36e4a", "#fc6148", "#d75ab6", "#b25ade", "#6575ff", "#7b77e9", "#4ea8ec", "#00d0f5", "#4eb94e", "#51af23", "#8b9f1c", "#d0b02f", "#d0853a", "#a4a4a4",
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


webui.showModal = function(title, message, type) {
    var body = $("#error-modal .alert");
    $("#error-modal .modal-title").text(title);
    body.removeClass("alert-danger alert-info");
    body.addClass(type == "info" ? "alert-info" : "alert-danger");
    body.text(message);
    $("#error-modal").modal('show');
}

webui.showError = function(message) {
    webui.showModal("Error", message, "error");
}

webui.showResult = function(title, message) {
    webui.showModal(title, message, "info");
}

webui.showWarning = function(message) {
    var messageBox = $("#message-box");
    messageBox.empty();
    $(  '<div class="alert alert-warning alert-dismissible" role="alert">' +
            '<button type="button" class="close" data-dismiss="alert">' +
                '<span aria-hidden="true">&times;</span>' +
                '<span class="sr-only">Close</span>' +
            '</button>' +
            message +
        '</div>').appendTo(messageBox);
}

webui.parseApiError = function(xhr, fallbackMessage) {
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

webui.withRepoParam = function(url) {
    if (!webui.activeRepoId) {
        return url;
    }
    var separator = url.indexOf("?") == -1 ? "?" : "&";
    return url + separator + "repo=" + encodeURIComponent(webui.activeRepoId);
}

webui.apiGet = function(url, callback) {
    $.getJSON(webui.withRepoParam(url))
    .done(callback)
    .fail(function(xhr) {
        webui.showError(webui.parseApiError(xhr, "Git webui server not running"));
    });
}

webui.apiPost = function(url, payload, callback, errorCallback) {
    $.ajax({
        url: webui.withRepoParam(url),
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
            webui.showError(webui.parseApiError(xhr, "Request failed"));
        }
    });
}

webui.escapeHtml = function(text) {
    return $("<div>").text(text || "").html();
}

webui.reloadApp = function() {
    document.location.reload();
}

webui.reloadWithPostAction = function(viewName) {
    if (viewName) {
        sessionStorage.setItem("git-webui-post-action", viewName);
    }
    webui.reloadApp();
}

// Applies a /api/repos/{select,open,clone,create} response (a full repo
// context payload) without a full page reload, so opening a repo while
// others are already open just adds/focuses a tab. The one exception is
// going from zero open repos to the first one: the view instances
// (historyView, workspaceView, ...) don't exist yet in that case, so a
// full bootstrap (page reload) is simplest and only happens once per
// session.
webui.applyOpenedRepoContext = function(mainView, context) {
    webui.recentRepos = context.recent_repos || webui.recentRepos;
    webui.openRepos = context.open_repos || [];
    if (!mainView.historyView) {
        webui.reloadApp();
        return;
    }
    mainView.repoChrome.switchActiveRepo(context.repo_id);
}

webui.setFlashMessage = function(title, message, type) {
    sessionStorage.setItem("git-webui-flash", JSON.stringify({
        title: title,
        message: message,
        type: type || "info"
    }));
}

webui.consumeFlashMessage = function() {
    var payload = sessionStorage.getItem("git-webui-flash");
    if (!payload) {
        return null;
    }
    sessionStorage.removeItem("git-webui-flash");
    try {
        return JSON.parse(payload);
    } catch (error) {
        return null;
    }
}

webui.formatRepoCounts = function(repo) {
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

webui.formatRepoTracking = function(repo) {
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

webui.formatBranchTracking = function(branch) {
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

webui.shortRefName = function(refName) {
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

webui.parseDecoratedRefs = function(refs, commitHash) {
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
            gitRef: gitRef || webui.shortRefName(fullName),
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
            pushRef("local", ref, webui.shortRefName(ref), webui.shortRefName(ref));
        } else if (ref.indexOf("refs/remotes/") == 0) {
            pushRef("remote", ref, webui.shortRefName(ref), webui.shortRefName(ref));
        } else if (ref.indexOf("tag: refs/tags/") == 0) {
            var fullTag = ref.substr(5);
            pushRef("tag", fullTag, webui.shortRefName(fullTag), webui.shortRefName(fullTag));
        } else if (ref.indexOf("refs/tags/") == 0) {
            pushRef("tag", ref, webui.shortRefName(ref), webui.shortRefName(ref));
        } else {
            pushRef("other", ref, webui.shortRefName(ref), ref);
        }
    });

    return items;
}

webui.getInitials = function(name) {
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

webui.hashString = function(str) {
    var hash = 0;
    for (var i = 0; i < str.length; ++i) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

webui.colorForAuthor = function(name) {
    if (!name) {
        return webui.COLORS[0];
    }
    return webui.COLORS[webui.hashString(name) % webui.COLORS.length];
}

webui.historyAuthorFilter = null;

webui.refChipFilterName = null;

webui.setRefChipFilter = function(displayName) {
    webui.refChipFilterName = displayName || null;
    $(".log-entry-ref").each(function() {
        var name = $(this).attr("data-ref-name");
        $(this).toggle(!webui.refChipFilterName || name == webui.refChipFilterName);
    });
}

webui.getCurrentBranch = function() {
    return webui.branches.filter(function(branch) {
        return branch.current;
    })[0] || null;
}

webui.findBranchByRef = function(refInfo) {
    if (!refInfo) {
        return null;
    }
    if (refInfo.kind == "head") {
        return webui.getCurrentBranch();
    }
    return webui.branches.filter(function(branch) {
        if (refInfo.kind == "local") {
            return branch.local_name == refInfo.gitRef;
        }
        if (refInfo.kind == "remote") {
            return branch.remote_name == refInfo.gitRef;
        }
        return false;
    })[0] || null;
}

webui.copyToClipboard = function(text, label) {
    if (!text) {
        return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
        .then(function() {
            webui.showResult("Copied", (label || "Value") + " copied to clipboard.");
        })
        .catch(function() {
            webui.showResult("Copy", text);
        });
    } else {
        webui.showResult("Copy", text);
    }
}

webui.git = function(cmd, arg1, arg2) {
    // cmd = git command line arguments
    // other arguments = optional stdin content and a callback function:
    // ex:
    // git("log", mycallback)
    // git("commit -F -", "my commit message", mycallback)
    if (typeof(arg1) == "function") {
        var callback = arg1;
    } else {
        // Convention : first line = git arguments, rest = process stdin
        cmd += "\n" + arg1;
        var callback = arg2;
    }
    $.post(webui.withRepoParam("git"), cmd, function(data, status, xhr) {
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
                // Return code is 0 but there is stderr output: this is a warning message
                if (message.length > 0) {
                    console.log(message);
                    webui.showWarning(message);
                }
            } else {
                console.log(message);
                webui.showError(message);
            }
        } else {
            console.log(data);
            webui.showError(data);
        }
    }, "text")
    .fail(function(xhr, status, error) {
        webui.showError("Git webui server not running");
    });
};

webui.detachChildren = function(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

webui.splitLines = function(data) {
    return data.split("\n").filter(function(s) { return s.length > 0; });
};

webui.getNodeIndex = function(element) {
    var index = 0;
    while (element.previousElementSibling) {
        element = element.previousElementSibling;
        ++index;
    }
    return index;
}

webui.RepoPicker = function(mainView) {

    var self = this;
    self.mode = "repo";

    self.getPickerTitle = function() {
        return self.mode == "workspace" ? "Select Folder Of Repositories" : "Select Git Repository";
    }

    self.selectWorkspace = function(path) {
        webui.apiPost("/api/workspaces/select", {path: path}, webui.reloadApp);
    }

    self.selectRepo = function(path) {
        webui.apiPost("/api/repos/select", {path: path}, function(context) {
            webui.applyOpenedRepoContext(mainView, context);
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
        webui.apiPost("/api/fs/pick-directory", {
            path: path || webui.repoPath || null,
            title: self.getPickerTitle(),
        }, function(data) {
            if (data.unsupported) {
                webui.showWarning((data.error || "Native folder picker unavailable.") + " Falling back to the built-in browser.");
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
            webui.showWarning(webui.parseApiError(xhr, "Native folder picker unavailable.") + " Falling back to the built-in browser.");
            self.open(path, self.mode);
        });
    }

    self.loadPath = function(path) {
        var requestPath = path ? "?path=" + encodeURIComponent(path) : "";
        webui.apiGet("/api/fs/list" + requestPath, function(data) {
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
                ? "Choose a parent directory and git-webui will surface each repo as a workspace rail."
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
        self.loadPath(path || webui.repoPath || null);
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

webui.PULL_STRATEGY_KEY = "git-webui-pull-strategy";
webui.AUTO_FETCH_KEY = "git-webui-auto-fetch";

webui.getPullStrategy = function() {
    return localStorage.getItem(webui.PULL_STRATEGY_KEY) || "ff";
}

webui.isAutoFetchEnabled = function() {
    return localStorage.getItem(webui.AUTO_FETCH_KEY) == "1";
}

webui.Toolbar = function(mainView) {

    var self = this;
    self.expandedDrawer = null;
    self.openMenuName = null;

    // -- data / branch helpers (unchanged behavior from the former RepoChrome) --

    self.currentBranch = function() {
        for (var i = 0; i < webui.branches.length; ++i) {
            if (webui.branches[i].current) {
                return webui.branches[i];
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

    self.loadBranches = function() {
        if (!webui.repoPath) {
            webui.branches = [];
            self.updateStatusMeta();
            return;
        }
        webui.apiGet("/api/branches", function(data) {
            webui.branches = data.branches || [];
            self.updateStatusMeta();
            if (mainView.historyView) {
                mainView.historyView.refreshToolbar();
            }
        });
    }

    self.updateStatusMeta = function() {
        $(".toolbar-repo-value", self.element).text(webui.repo || "No Repository");
        $(".toolbar-branch-value", self.element).text(self.branchSummary());
        $(".app-titlebar-path", self.element).text("git-webui" + (webui.repoPath ? " - " + webui.repoPath : ""));
        $("title")[0].textContent = webui.repoPath ? "Git - " + webui.repo : "Git WebUI";
    }

    self.openPicker = function() {
        mainView.repoPicker.openNative(webui.repoPath, "repo");
    }

    self.openWorkspacePicker = function() {
        mainView.repoPicker.openNative(webui.workspacePath || webui.repoPath, "workspace");
    }

    self.selectRecentRepo = function(event) {
        var path = event.currentTarget.getAttribute("data-path");
        if (path) {
            mainView.repoPicker.selectRepo(path);
        }
    }

    self.focusHistoryRef = function(refName) {
        webui.historyRef = refName || null;
        self.activateSection("history");
        if (mainView.historyView) {
            mainView.historyView.update(webui.historyRef);
        }
    }

    self.compareRef = function(sourceRef) {
        var current = self.currentBranch();
        var targetRef = current && current.local_name ? current.local_name : null;
        webui.apiPost("/api/branches/compare", {
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
        webui.apiPost("/api/branches/checkout", {
            local_name: localName || null,
            remote_name: remoteName || null,
        }, webui.reloadApp);
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
        webui.apiPost(squash ? "/api/branches/squash-merge" : "/api/branches/merge", {
            source_ref: sourceRef,
            target_ref: targetRef,
        }, function(data) {
            webui.setFlashMessage(
                actionLabel + " completed",
                data.message || ((squash ? "Squashed " : "Merged ") + sourceRef + " into " + targetRef),
                "info"
            );
            webui.reloadWithPostAction(squash ? "workspace" : "history");
        }, function(xhr) {
            webui.setFlashMessage(
                actionLabel + " needs attention",
                webui.parseApiError(xhr, actionLabel + " failed"),
                "error"
            );
            webui.reloadWithPostAction("workspace");
        });
    }

    self.removeBranch = function(localName) {
        if (!localName) {
            return;
        }
        if (!window.confirm("Delete branch '" + localName + "'?")) {
            return;
        }
        webui.apiPost("/api/branches/delete", {local_name: localName}, webui.reloadApp);
    }

    self.createBranchAtRef = function(startPoint, suggestedName) {
        var branchName = window.prompt("New branch name", suggestedName || "");
        if (!branchName) {
            return;
        }
        webui.apiPost("/api/branches/create", {
            name: branchName,
            start_point: startPoint,
            checkout: true,
        }, webui.reloadApp);
    }

    self.createTagAtRef = function(startPoint, suggestedName) {
        var tagName = window.prompt("New tag name", suggestedName || "");
        if (!tagName) {
            return;
        }
        webui.git("tag " + tagName + (startPoint ? " " + startPoint : ""), function() {
            webui.showResult("Tag created", "Created tag " + tagName);
        });
    }

    // -- section / tab switching (replaces the former SideBarView) --

    self.activeSectionName = "history";

    self.activateSection = function(sectionName) {
        self.activeSectionName = sectionName;
        $(".toolbar-tab", self.element).removeClass("active");
        $(".toolbar-tab[data-section='" + sectionName + "']", self.element).addClass("active");
    }

    self.showWorkspace = function() {
        self.activateSection("workspace");
        mainView.workspaceView.update("stage");
    }

    self.showHistory = function() {
        self.activateSection("history");
        mainView.historyView.update(webui.historyRef);
    }

    self.showBranches = function() {
        self.activateSection("branches");
        mainView.branchesView.update();
    }

    self.refreshActiveSection = function() {
        if (self.activeSectionName == "workspace" && !webui.viewonly) {
            mainView.workspaceView.update("stage");
        } else if (self.activeSectionName == "branches") {
            mainView.branchesView.update();
        } else {
            mainView.historyView.update(webui.historyRef);
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

    self.renderAppMenu = function() {
        var menu = $(".toolbar-menu[data-menu='app']", self.element);
        menu.empty();
        menu.append('<button type="button" class="toolbar-menu-item" data-action="open-local">Open Local Repo&hellip;<span class="toolbar-menu-shortcut">Ctrl+O</span></button>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="open-workspace">Open Repo Folder&hellip;</button>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="clone-repo">Clone Repo&hellip;<span class="toolbar-menu-shortcut">Ctrl+N</span></button>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="create-repo">Create Repo&hellip;<span class="toolbar-menu-shortcut">Ctrl+Shift+N</span></button>');
        menu.append('<div class="toolbar-menu-divider"></div>');
        menu.append('<div class="toolbar-menu-heading">View</div>');
        menu.append('<button type="button" class="toolbar-menu-item' + ($("body").hasClass("dark-mode") ? " checked" : "") + '" data-action="toggle-theme">Dark Theme</button>');
        menu.append('<div class="toolbar-menu-divider"></div>');
        menu.append('<button type="button" class="toolbar-menu-item" data-action="help">Help / About</button>');
        $(".toolbar-menu-item[data-action]", menu).click(self.onAppMenuAction);
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
        $("body").toggleClass("dark-mode");
        localStorage.setItem("theme", $("body").hasClass("dark-mode") ? "dark" : "light");
    }

    // -- repo dropdown --

    self.renderRepoMenu = function() {
        var menu = $(".toolbar-menu[data-menu='repo']", self.element);
        menu.empty();
        var list = $('<div class="toolbar-repo-list"></div>');
        if (webui.recentRepos.length == 0) {
            list.append('<div class="toolbar-menu-empty">No recent repositories yet.</div>');
        } else {
            webui.recentRepos.forEach(function(repo) {
                var item = $('<button type="button" class="toolbar-menu-item toolbar-repo-item" data-path="' + webui.escapeHtml(repo.path) + '"></button>');
                if (repo.active) {
                    item.addClass("checked");
                }
                item.append('<span class="repo-chip-name">' + webui.escapeHtml(repo.name) + '</span>');
                item.append('<span class="repo-chip-path">' + webui.escapeHtml(repo.path) + '</span>');
                item.click(self.selectRecentRepo);
                list.append(item);
            });
        }
        menu.append(list);

        if (webui.workspacePath) {
            menu.append('<div class="toolbar-menu-divider"></div>');
            menu.append('<div class="toolbar-menu-heading">Folder of Repos: ' + webui.escapeHtml(webui.workspacePath) + '</div>');
            if (webui.workspaceRepos.length == 0) {
                menu.append('<div class="toolbar-menu-empty">No git repos found in this folder.</div>');
            } else {
                webui.workspaceRepos.forEach(function(repo) {
                    var item = $('<button type="button" class="toolbar-menu-item toolbar-repo-item"></button>');
                    if (repo.active) {
                        item.addClass("checked");
                    }
                    item.append('<span class="repo-chip-name">' + webui.escapeHtml(repo.name) + ' <span class="ref-chip-extra">[' + webui.escapeHtml(repo.branch) + ']</span></span>');
                    item.append('<span class="repo-chip-path">' + webui.escapeHtml(webui.formatRepoCounts(repo)) + '</span>');
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
        if (!webui.viewonly) {
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
        webui.apiPost("/api/fs/pick-directory", {
            path: webui.workspacePath || webui.repoPath || null,
            title: "Choose destination folder",
        }, function(data) {
            if (data.unsupported) {
                webui.showWarning(data.error || "Native folder picker unavailable.");
                return;
            }
            if (data.cancelled) {
                return;
            }
            webui.apiPost("/api/repos/clone", {url: url, destination: data.path}, function(context) {
                webui.applyOpenedRepoContext(mainView, context);
            }, function(xhr) {
                webui.showError(webui.parseApiError(xhr, "Clone failed"));
            });
        });
    }

    self.createRepoFlow = function() {
        var name = window.prompt("New repository folder name");
        if (!name) {
            return;
        }
        webui.apiPost("/api/fs/pick-directory", {
            path: webui.workspacePath || webui.repoPath || null,
            title: "Choose parent folder",
        }, function(data) {
            if (data.unsupported) {
                webui.showWarning(data.error || "Native folder picker unavailable.");
                return;
            }
            if (data.cancelled) {
                return;
            }
            webui.apiPost("/api/repos/create", {destination: data.path, directory_name: name}, function(context) {
                webui.applyOpenedRepoContext(mainView, context);
            }, function(xhr) {
                webui.showError(webui.parseApiError(xhr, "Create repo failed"));
            });
        });
    }

    // -- Pull / Push / Fetch : left click executes, right click opens options --

    self.onPull = function(event) {
        event.preventDefault();
        var strategy = webui.getPullStrategy();
        var args = strategy == "rebase" ? "pull --rebase" : "pull";
        webui.git(args, function(data) {
            webui.showResult("Pull completed", data);
            self.loadBranches();
            if (mainView.workspaceView) {
                mainView.workspaceView.update("stage");
            }
        });
    }

    self.onPush = function(event) {
        event.preventDefault();
        webui.git("push", function(data) {
            webui.showResult("Push completed", data);
            self.loadBranches();
        });
    }

    self.onForcePush = function() {
        if (!window.confirm("Force push may overwrite remote history. Continue?")) {
            return;
        }
        webui.git("push --force", function(data) {
            webui.showResult("Force push completed", data);
            self.loadBranches();
        });
    }

    self.onFetch = function(event) {
        if (event) {
            event.preventDefault();
        }
        webui.git("fetch", function(data) {
            webui.showResult("Fetch completed", data);
            self.loadBranches();
        });
    }

    self.toggleAutoFetch = function() {
        var enabled = !webui.isAutoFetchEnabled();
        localStorage.setItem(webui.AUTO_FETCH_KEY, enabled ? "1" : "0");
        self.applyAutoFetch();
    }

    self.applyAutoFetch = function() {
        if (self.autoFetchTimer) {
            clearInterval(self.autoFetchTimer);
            self.autoFetchTimer = null;
        }
        if (webui.isAutoFetchEnabled()) {
            self.autoFetchTimer = setInterval(self.onFetch, 5 * 60 * 1000);
        }
    }

    self.setPullStrategy = function(strategy) {
        localStorage.setItem(webui.PULL_STRATEGY_KEY, strategy);
    }

    self.renderRemoteMenu = function(kind) {
        var menu = $(".toolbar-menu[data-menu='" + kind + "']", self.element);
        menu.empty();
        if (kind == "pull") {
            var strategy = webui.getPullStrategy();
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
            var autoItem = $('<button type="button" class="toolbar-menu-item' + (webui.isAutoFetchEnabled() ? " checked" : "") + '">Auto fetch</button>');
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
        if (webui.openRepos.length == 0) {
            return;
        }
        webui.openRepos.forEach(function(repo) {
            var tab = $('<div class="repo-tab"><span class="repo-tab-name"></span><button type="button" class="repo-tab-close" title="Close">&times;</button></div>');
            if (repo.path == webui.activeRepoId) {
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
            strip.append(tab);
        });
        var addButton = $('<button type="button" class="repo-tab-add" title="Open another repo">+</button>');
        addButton.click(self.openPicker);
        strip.append(addButton);
    }

    self.switchActiveRepo = function(repoId) {
        if (!repoId || repoId == webui.activeRepoId) {
            return;
        }
        var entry = webui.openRepos.filter(function(repo) { return repo.path == repoId; })[0];
        webui.activeRepoId = repoId;
        webui.repoPath = repoId;
        webui.repo = entry ? entry.name : repoId;
        webui.historyRef = null;
        webui.historyAuthorFilter = null;
        webui.refChipFilterName = null;
        self.renderRepoTabs();
        self.update();
        self.refreshActiveSection();
    }

    self.closeRepoTab = function(repoId) {
        webui.apiPost("/api/repos/close", {repo_id: repoId}, function(context) {
            webui.openRepos = context.open_repos || [];
            self.renderRepoTabs();
            if (!context.has_repo) {
                webui.activeRepoId = null;
                webui.repoPath = null;
                mainView.switchTo(new webui.NoRepoView(mainView).element);
                return;
            }
            if (context.repo_id != webui.activeRepoId) {
                webui.activeRepoId = context.repo_id;
                webui.repoPath = context.repo_path;
                webui.repo = context.repo_name;
                webui.historyRef = null;
                webui.historyAuthorFilter = null;
                webui.refChipFilterName = null;
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
                            '<div id="app-titlebar"><span class="app-titlebar-path"></span>' +
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

                                '<div class="toolbar-label" id="toolbar-branch-label">' +
                                    '<div class="toolbar-label-value toolbar-branch-value"></div>' +
                                    '<div class="toolbar-label-caption">Branch</div>' +
                                '</div>' +

                                '<div class="toolbar-tabs">' +
                                    '<button type="button" class="toolbar-tab" data-section="workspace">' +
                                        '<span class="toolbar-tab-icon">&#9776;</span>' +
                                        '<span class="toolbar-tab-text">Changes</span>' +
                                    '</button>' +
                                    '<button type="button" class="toolbar-tab" data-section="history">' +
                                        '<span class="toolbar-tab-icon">&#9776;</span>' +
                                        '<span class="toolbar-tab-text">Commits</span>' +
                                    '</button>' +
                                    '<button type="button" class="toolbar-tab" data-section="branches">' +
                                        '<span class="toolbar-tab-icon">&#8942;</span>' +
                                        '<span class="toolbar-tab-text">Branches</span>' +
                                    '</button>' +
                                    '<button type="button" class="toolbar-tab" id="toolbar-search-button">' +
                                        '<span class="toolbar-tab-icon">&#128269;</span>' +
                                        '<span class="toolbar-tab-text">Search</span>' +
                                    '</button>' +
                                '</div>' +

                                '<div class="toolbar-spacer"></div>' +

                                '<div class="toolbar-remote-actions">' +
                                    '<button type="button" class="toolbar-remote-btn" id="toolbar-pull" title="Left-click to pull, right-click for options">' +
                                        '<span class="toolbar-remote-btn-icon">&#8595;</span><span>Pull</span>' +
                                    '</button>' +
                                    '<div class="toolbar-menu" data-menu="pull"></div>' +
                                    '<button type="button" class="toolbar-remote-btn" id="toolbar-push" title="Left-click to push, right-click for options">' +
                                        '<span class="toolbar-remote-btn-icon">&#8593;</span><span>Push</span>' +
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

    $("#app-menu-button", self.element).click(function(event) {
        event.stopPropagation();
        self.renderAppMenu();
        self.toggleMenu("app", event.currentTarget);
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

    if (webui.viewonly) {
        $("#toolbar-push, #toolbar-pull, #app-menu-button", self.element).prop("disabled", true);
    } else {
        $(".toolbar-tab[data-section='workspace']", self.element).click(self.showWorkspace);
    }
    $(".toolbar-tab[data-section='history']", self.element).click(self.showHistory);
    $(".toolbar-tab[data-section='branches']", self.element).click(self.showBranches);
    $("#toolbar-search-button", self.element).click(function() {
        mainView.searchOverlay.show();
    });

    if (localStorage.getItem("theme") === "dark") {
        $("body").addClass("dark-mode");
    }
    self.applyAutoFetch();

    $("body").append(self.compareModal);
    self.activateSection("history");
};

webui.ConfigureRemotesView = function() {

    var self = this;

    self.refresh = function() {
        webui.apiGet("/api/remotes", function(data) {
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
                webui.apiPost("/api/remotes/remove", {name: remote.name}, function(data) {
                    self.render(data.remotes || []);
                }, function(xhr) {
                    webui.showError(webui.parseApiError(xhr, "Unable to remove remote"));
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
        webui.apiPost("/api/remotes/add", {name: name, url: url}, function(data) {
            $(".configure-remotes-add-name, .configure-remotes-add-url", self.element).val("");
            self.render(data.remotes || []);
        }, function(xhr) {
            webui.showError(webui.parseApiError(xhr, "Unable to add remote"));
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

/*
 * == WorktreesView =============================================================
 */
webui.WorktreesView = function(mainView) {

    var self = this;

    self.refresh = function() {
        webui.apiGet("/api/worktrees", function(data) {
            self.render(data.worktrees || []);
        });
    }

    self.render = function(worktrees) {
        var list = $(".worktrees-list", self.element);
        list.empty();
        if (worktrees.length == 0) {
            list.append('<div class="toolbar-menu-empty">No worktrees.</div>');
        }
        worktrees.forEach(function(worktree) {
            var row = $(  '<div class="worktrees-row">' +
                                '<div class="worktrees-row-path"></div>' +
                                '<div class="worktrees-row-branch"></div>' +
                                '<button type="button" class="btn btn-danger btn-xs worktrees-remove">Remove</button>' +
                            '</div>');
            $(".worktrees-row-path", row).text(worktree.path);
            $(".worktrees-row-branch", row).text(worktree.detached ? "(detached)" : (worktree.branch || ""));
            $(".worktrees-remove", row).prop("disabled", worktree.path == webui.repoPath);
            $(".worktrees-remove", row).click(function() {
                if (!window.confirm("Remove worktree at '" + worktree.path + "'?")) {
                    return;
                }
                webui.apiPost("/api/worktrees/remove", {path: worktree.path, force: true}, function(data) {
                    self.render(data.worktrees || []);
                }, function(xhr) {
                    webui.showError(webui.parseApiError(xhr, "Unable to remove worktree"));
                });
            });
            list.append(row);
        });
    }

    self.onAdd = function() {
        var path = $(".worktrees-add-path", self.element).val();
        var branch = $(".worktrees-add-branch", self.element).val();
        var createBranch = $(".worktrees-add-create", self.element).is(":checked");
        if (!path || !branch) {
            return;
        }
        webui.apiPost("/api/worktrees/add", {
            path: path,
            branch: branch,
            create_branch: createBranch,
            start_point: webui.historyRef || "HEAD",
        }, function(data) {
            $(".worktrees-add-path, .worktrees-add-branch", self.element).val("");
            self.render(data.worktrees || []);
        }, function(xhr) {
            webui.showError(webui.parseApiError(xhr, "Unable to add worktree"));
        });
    }

    self.show = function() {
        self.refresh();
        $(self.element).modal("show");
    }

    self.element = $(   '<div class="modal fade" id="worktrees-modal" tabindex="-1" role="dialog">' +
                            '<div class="modal-dialog" role="document">' +
                                '<div class="modal-content">' +
                                    '<div class="modal-header">' +
                                        '<button type="button" class="close" data-dismiss="modal"><span>&times;</span><span class="sr-only">Close</span></button>' +
                                        '<div class="repo-picker-eyebrow">Worktrees</div>' +
                                        '<h4 class="modal-title">Manage Worktrees</h4>' +
                                    '</div>' +
                                    '<div class="modal-body">' +
                                        '<div class="worktrees-list"></div>' +
                                        '<div class="worktrees-add">' +
                                            '<input type="text" class="form-control input-sm worktrees-add-path" placeholder="new worktree path">' +
                                            '<input type="text" class="form-control input-sm worktrees-add-branch" placeholder="branch name">' +
                                            '<label class="worktrees-add-create-label"><input type="checkbox" class="worktrees-add-create" checked> new branch</label>' +
                                            '<button type="button" class="btn btn-primary btn-sm worktrees-add-button">Add</button>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $(".worktrees-add-button", self.element).click(self.onAdd);
    $("body").append(self.element);
};

/*
 * == StashesView ================================================================
 */
webui.StashesView = function(mainView) {

    var self = this;

    self.refresh = function() {
        webui.apiGet("/api/stashes", function(data) {
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
                webui.apiPost("/api/stashes/drop", {ref: stash.ref}, function(data) {
                    self.render(data.stashes || []);
                }, function(xhr) {
                    webui.showError(webui.parseApiError(xhr, "Unable to drop stash"));
                });
            });
            list.append(row);
        });
    }

    self.apply = function(ref, pop) {
        webui.apiPost("/api/stashes/apply", {ref: ref, pop: pop}, function(data) {
            webui.showResult(pop ? "Stash popped" : "Stash applied", data.message || "");
            $(self.element).modal("hide");
            if (mainView.workspaceView) {
                mainView.workspaceView.update("stage");
            }
        }, function(xhr) {
            webui.showError(webui.parseApiError(xhr, "Unable to apply stash"));
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
webui.ReflogView = function(mainView) {

    var self = this;

    self.refresh = function() {
        webui.apiGet("/api/reflog", function(data) {
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
                webui.git("reset --hard " + entry.commit, function() {
                    webui.showResult("Reset complete", "Reset to " + entry.selector);
                    $(self.element).modal("hide");
                    webui.reloadWithPostAction("history");
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
webui.SubmodulesView = function(mainView) {

    var self = this;

    self.refresh = function() {
        webui.apiGet("/api/submodules", function(data) {
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
        webui.apiPost("/api/submodules/update", {init: true}, function(data) {
            webui.showResult("Submodules updated", "Ran submodule update --init --recursive");
            self.render(data.submodules || []);
        }, function(xhr) {
            webui.showError(webui.parseApiError(xhr, "Unable to update submodules"));
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
webui.InteractiveRebaseView = function(mainView) {

    var self = this;

    self.show = function(base) {
        self.base = base;
        webui.git("log --format=%H%x09%s --date-order " + base + "..HEAD --", function(data) {
            var commits = webui.splitLines(data).filter(function(line) { return line.length > 0; }).map(function(line) {
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
            list.append('<div class="toolbar-menu-empty">HEAD is already up to date with ' + webui.escapeHtml(self.base) + '.</div>');
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
        webui.apiPost("/api/rebase/plan", {base: self.base, actions: actions}, function(data) {
            webui.showResult("Rebase completed", data.message || "");
            $(self.element).modal("hide");
            webui.reloadWithPostAction("history");
        }, function(xhr) {
            webui.showError(webui.parseApiError(xhr, "Rebase failed"));
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

webui.NoRepoView = function(mainView) {

    var self = this;

    self.element = $(   '<div id="no-repo-view" class="jumbotron">' +
                            '<div class="no-repo-kicker">Local Git Dashboard</div>' +
                            '<h1>Choose a repository</h1>' +
                            '<p>Start from recent repositories, or open a folder of repos to build a multi-repo workspace without restarting git-webui.</p>' +
                            '<p><button type="button" class="btn btn-primary btn-lg no-repo-browse">Browse Repo</button> <button type="button" class="btn btn-default btn-lg no-repo-workspace">Open Repo Folder</button></p>' +
                        '</div>')[0];

    $(".no-repo-browse", self.element).click(function() {
        mainView.repoPicker.openNative(null, "repo");
    });
    $(".no-repo-workspace", self.element).click(function() {
        mainView.repoPicker.openNative(null, "workspace");
    });
};

webui.TabBox = function(buttons) {

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
webui.RefActionMenu = function(mainView) {

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
        var branch = webui.findBranchByRef(refInfo);
        var current = webui.getCurrentBranch();
        var isCurrentLocal = branch && branch.current && branch.local_name;
        var mergeDisabled = webui.viewonly || !current || !current.local_name || isCurrentLocal;

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
            }, webui.viewonly || isCurrentLocal);
        } else if (refInfo.kind == "remote") {
            self.addAction("Checkout tracking branch", function() {
                mainView.repoChrome.checkoutRef(null, refInfo.gitRef);
            }, webui.viewonly);
        }

        self.addAction("Create branch here", function() {
            mainView.repoChrome.createBranchAtRef(refInfo.gitRef || entry.commit, refInfo.displayName + "-copy");
        }, webui.viewonly);
        self.addAction("Create tag here", function() {
            mainView.repoChrome.createTagAtRef(refInfo.gitRef || entry.commit, refInfo.displayName + "-tag");
        }, webui.viewonly);

        self.addAction("Hide other branches", function() {
            webui.setRefChipFilter(refInfo.displayName);
        }, !refInfo.displayName);
        self.addAction("Show All Branches", function() {
            webui.setRefChipFilter(null);
        }, !webui.refChipFilterName);

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
            }, webui.viewonly || !branch || !branch.can_delete, "danger");
        }

        if (refInfo.kind == "local" || refInfo.kind == "remote") {
            self.addAction("Interactive Rebase onto here&hellip;", function() {
                mainView.interactiveRebaseView.show(refInfo.gitRef);
            }, webui.viewonly);
        }

        self.addAction("Copy ref name", function() {
            webui.copyToClipboard(refInfo.gitRef || refInfo.fullName, "Ref name");
        }, !(refInfo.gitRef || refInfo.fullName));
        self.addAction("Copy commit hash", function() {
            webui.copyToClipboard(entry.commit, "Commit hash");
        }, !entry.commit);
        self.addAction("Configure Remotes", function() {
            mainView.configureRemotesView.show();
        }, webui.viewonly);
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
webui.CommitActionMenu = function(mainView) {

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

    self.render = function(entry) {
        $(".ref-action-menu-title", self.element).text(entry.abbrevMessage());
        $(".ref-action-menu-subtitle", self.element).text(entry.commit.substr(0, 12));
        self.list.empty();

        self.addAction("Create Branch Here…", function() {
            mainView.repoChrome.createBranchAtRef(entry.commit, entry.commit.substr(0, 8) + "-branch");
        }, webui.viewonly);
        self.addAction("Create Tag Here…", function() {
            mainView.repoChrome.createTagAtRef(entry.commit, entry.commit.substr(0, 8) + "-tag");
        }, webui.viewonly);
        self.addAction("Show all commits by " + entry.author.name, function() {
            mainView.historyView.showCommitsByAuthor(entry.author.name);
        }, false);

        webui.apiGet("/api/commits/" + entry.commit + "/is-ancestor", function(data) {
            if (data.is_ancestor) {
                self.addAction("Revert Changes in this Commit…", function() {
                    if (!window.confirm("Revert commit " + entry.commit.substr(0, 8) + "?")) {
                        return;
                    }
                    webui.git("revert --no-edit " + entry.commit, function() {
                        webui.showResult("Revert completed", "Reverted " + entry.commit.substr(0, 8));
                        mainView.historyView.update(webui.historyRef);
                    });
                }, webui.viewonly, "danger");
            } else {
                self.addAction("Cherry-pick Changes in this Commit…", function() {
                    webui.git("cherry-pick " + entry.commit, function() {
                        webui.showResult("Cherry-pick completed", "Cherry-picked " + entry.commit.substr(0, 8));
                        mainView.historyView.update(webui.historyRef);
                    });
                }, webui.viewonly);
            }
        });

        self.addAction("Copy commit hash", function() {
            webui.copyToClipboard(entry.commit, "Commit hash");
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
webui.SearchOverlay = function(mainView) {

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
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() == "f" && !webui.viewonly) {
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
webui.LogView = function(historyView) {

    var self = this;

    self.update = function(ref) {
        $(svg).empty();
        streams = []
        $(content).empty();
        currentSelection = null;
        self.ref = ref || null;
        self.nextSkip = 0;
        self.populate();
    };

    self.populate = function() {
        var maxCount = 1000;
        if (content.childElementCount > 0) {
            // The last node is the 'Show more commits placeholder'. Remove it.
            content.removeChild(content.lastElementChild);
        }
        var startAt = content.childElementCount;
        var refSpec = self.ref ? self.ref : "--all";
        var authorSpec = webui.historyAuthorFilter ? " --author=" + JSON.stringify(webui.historyAuthorFilter) : "";
        webui.git("log --date-order --pretty=raw --decorate=full --skip=" + self.nextSkip + " --max-count=" + (maxCount + 1) + " " + refSpec + authorSpec + " --", function(data) {
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
                if (count < maxCount) {
                    content.appendChild(entry.element);
                    if (!self.lineHeight) {
                        self.lineHeight = Math.ceil($(entry.element).outerHeight() / 2) * 2;
                    }
                    entry.element.setAttribute("style", "height:" + self.lineHeight + "px");
                    if (!currentSelection) {
                        entry.select();
                    }
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
            svg.setAttribute("width", $(content).outerWidth());
            if (self.nextSkip != undefined) {
                var moreTag = $('<a class="log-entry log-entry-more list-group-item">');
                $('<a class="list-group-item-text">Show previous commits</a>').appendTo(moreTag[0]);
                moreTag.click(self.populate);
                moreTag.appendTo(content);
            }

            self.updateGraph(startAt);
        });
    };

    self.updateGraph = function(startAt) {
        // Draw the graph
        var currentY = (startAt + 0.5) * self.lineHeight;
        var maxLeft = 0;
        if (startAt == 0) {
            streamColor = 0;
        }
        for (var i = startAt; i < content.children.length; ++i) {
            var entry = content.children[i].model;
            if (!entry) {
                break;
            }
            var index = 0;
            entry.element.webuiLeft = streams.length;

            // Find streams to join
            var childCount = 0;
            var xOffset = 12;
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

            // Add new streams
            for (var j = 0; j < entry.parents.length; ++j) {
                var parent = entry.parents[j];
                var x = (index + j + 1) * xOffset;
                if (j != 0 || streams.length == 0) {
                    var svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    ++streamColor
                    if (streamColor == webui.COLORS.length) {
                        streamColor = 0;
                    }
                    svgPath.setAttribute("style", "stroke:" + webui.COLORS[streamColor]);
                    var origX = (index + 1) * xOffset;
                    svgPath.cmds = "M " + origX + " " + currentY + " L " + x + " " + (currentY + self.lineHeight / 2) + " L " + x + " ";
                    svg.appendChild(svgPath);
                    var obj = {
                        sha1: parent,
                        path: svgPath,
                    };
                    streams.splice(index + j, 0, obj);
                }
            }
            for (var j = index + j; j < streams.length; ++j) {
                var stream = streams[j];
                var x = (j + 1) * xOffset;
                stream.path.cmds += (currentY - self.lineHeight / 2) + " L " + x + " " + currentY + " L " + x + " ";
            }

            var svgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            svgCircle.setAttribute("cx", (index + 1) * xOffset);
            svgCircle.setAttribute("cy", currentY);
            svgCircle.setAttribute("r", 4);
            var nodeStream = streams[index];
            var nodeColor = nodeStream && nodeStream.path.style.stroke;
            if (entry.parents.length > 1 && nodeColor) {
                // Hollow ring for merge commits, matching GitFiend's graph style.
                svgCircle.setAttribute("style", "fill:#fff;stroke:" + nodeColor + ";stroke-width:2");
            } else if (nodeColor) {
                svgCircle.setAttribute("style", "fill:" + nodeColor);
            }
            svg.appendChild(svgCircle);

            entry.element.webuiLeft = Math.max(entry.element.webuiLeft, streams.length);
            maxLeft = Math.max(maxLeft, entry.element.webuiLeft);
            // Debug log
            //console.log(entry.commit, entry.parents, $.extend(true, [], streams));

            currentY += self.lineHeight;
        }
        for (var i = startAt; i < content.children.length; ++i) {
            var element = content.children[i];
            if (element.model) {
                var minLeft = Math.min(maxLeft, 3);
                var left = element ? Math.max(minLeft, element.webuiLeft) : minLeft;
                element.setAttribute("style", element.getAttribute("style") + ";padding-left:" + (left + 1) * xOffset + "px");
            }
        }
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

        self.createElement = function() {
            self.element = $('<a class="log-entry list-group-item">' +
                                '<header>' +
                                    '<span class="log-entry-avatar" style="background:' + webui.colorForAuthor(self.author.name) + '" title="' + webui.escapeHtml(self.author.name) + ' &lt;' + webui.escapeHtml(self.author.email) + '&gt;">' + webui.escapeHtml(webui.getInitials(self.author.name)) + '</span>' +
                                    '<div class="log-entry-refs"></div>' +
                                    '<p class="list-group-item-text"></p>' +
                                    '<button type="button" class="log-entry-menu-btn" title="Show commit menu">&#8942;</button>' +
                                    '<span class="log-entry-date">' + self.author.date.toLocaleString() + '</span>' +
                                    '<span class="badge log-entry-hash">' + self.abbrevCommitHash() + '</span>' +
                                '</header>' +
                             '</a>')[0];
            $(".list-group-item-text", self.element)[0].appendChild(document.createTextNode(self.abbrevMessage()));
            $(".log-entry-menu-btn", self.element).click(function(event) {
                event.preventDefault();
                event.stopPropagation();
                historyView.mainView.commitActionMenu.show(event.currentTarget, self);
            });
            if (self.decoratedRefs.length > 0) {
                var refBox = $(".log-entry-refs", self.element);
                self.decoratedRefs.forEach(function(refInfo) {
                    var chipClass = "ref-chip-local";
                    if (refInfo.kind == "remote") {
                        chipClass = "ref-chip-remote";
                    } else if (refInfo.kind == "tag") {
                        chipClass = "ref-chip-tag";
                    } else if (refInfo.kind == "head") {
                        chipClass = "ref-chip-local";
                    }
                    var label = $('<button type="button" class="ref-chip ' + chipClass + ' log-entry-ref" data-ref-name="' + webui.escapeHtml(refInfo.displayName) + '">' + webui.escapeHtml(refInfo.displayName) + '</button>');
                    label.click(function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        historyView.mainView.refActionMenu.show(label[0], refInfo, self);
                    });
                    if (webui.refChipFilterName && refInfo.displayName != webui.refChipFilterName) {
                        label.hide();
                    }
                    refBox.append(label);
                });
            }
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
                }
                $(self.element).addClass("active");
                currentSelection = self;
                logView.historyView.commitView.update(self);
            }
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
        self.decoratedRefs = webui.parseDecoratedRefs(self.refs || [], self.commit);

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
webui.DiffView = function(initialSideBySide, hunkSelectionAllowed, parent) {

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
                    left.webuiPrevScrollTop = 0;
                    left.webuiPrevScrollLeft = 0;
                }
                if (right) {
                    right.scrollTop = 0;
                    right.scrollLeft = 0;
                    right.webuiPrevScrollTop = 0;
                    right.webuiPrevScrollLeft = 0;
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
                fullCmd += " -- " + self.gitFile;
            }
            webui.git(fullCmd, function(diff) {
                self.refresh(diff);
            });
        } else {
            self.refresh("");
        }
    };

    self.refresh = function(diff) {
        self.currentDiff = diff;
        self.diffHeader = "";
        $("span", self.element).text('Context: ' + self.context);
        if (self.sideBySide) {
            var diffLines = diff.split("\n");
            self.updateSplitView(leftLines, diffLines, '-');
            self.updateSplitView(rightLines, diffLines, '+');
        } else {
            self.updateSimpleView(singleLines, diff);
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

        var context = { inHeader: true,
                        addedLines: [],
                        removedLines: [],
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
        view.parentElement.scrollTop = view.parentElement.webuiPrevScrollTop;
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
                pre.appendChild(document.createTextNode(" "));
            }
        }
        return context;
    }

    self.addDiffLine = function(view, line, context) {
        var c = line[0];
        var pre = $('<pre class="diff-view-line">').appendTo(view)[0];
        pre.appendChild(document.createTextNode(line));
        if (c == '+') {
            $(pre).addClass("diff-line-add");
        } else if (c == '-') {
            $(pre).addClass("diff-line-del");
        } else if (c == '@') {
            $(pre).addClass("diff-line-offset");
            pre.webuiActive = false;
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
        var patch = "";
        // First create the header
        for (var l = 0; l < leftLines.childElementCount; ++l) {
            var line = leftLines.children[l].textContent;
            if (line[0] == "@") {
                break;
            } else {
                patch += line + "\n";
            }
        }
        patch += rightLines.children[l - 1].textContent + "\n";
        // Then build the patch itself
        var refLineNo = 0;
        var patchOffset = 0;
        var hunkAddedLines = [];
        var hunkRemovedLines = [];
        for (; l < leftLines.childElementCount; ++l) {
            var leftElt = leftLines.children[l];
            var leftLine = leftElt.textContent;
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
                            hunkAddedLines.push(rightElt.textContent);
                        } else {
                            hunkRemovedLines.push(self.reverseLine(rightElt.textContent));
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
        if (current.webuiPrevScrollTop != current.scrollTop) {
            // Vertical scrolling
            other.scrollTop = current.scrollTop;
            other.webuiPrevScrollTop = current.webuiPrevScrollTop = current.scrollTop;
        } else if (current.webuiPrevScrollLeft != current.scrollLeft) {
            // Horizontal scrolling
            other.scrollLeft = current.scrollLeft;
            other.webuiPrevScrollLeft = current.webuiPrevScrollLeft = current.scrollLeft;
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
        var diffLine = lineElt.textContent;
        var cmd = diffLine[0];
        if (cmd == "+" || cmd == "-") {
            $(lineElt).toggleClass("active");
        } else if (cmd == "@") {
            lineElt.webuiActive = !lineElt.webuiActive;
            for (var elt = lineElt.nextElementSibling; elt; elt = elt.nextElementSibling) {
                cmd = elt.textContent[0];
                if (cmd == "+" || cmd == "-") {
                    $(elt).toggleClass("active", lineElt.webuiActive);
                } else if (cmd == "@") {
                    break;
                }
            }
        }

        var isActive = false
        var lineContainers = [leftLines, rightLines];
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

    self.applySelection = function(reverse, cached) {
        var patch = self.createSelectionPatch(reverse);
        var cmd = "apply --unidiff-zero";
        if (cached) {
            cmd += " --cached";
        }
        webui.git(cmd, patch, function (data) {
            parent.update();
        });
    }

    self.switchToExploreView = function() {
        if (! self.currentDiff) {
            return;
        }
        var mainView = parent.historyView.mainView;
        var commitExplorerView = new webui.CommitExplorerView(mainView, self.currentDiff);
        commitExplorerView.show();
    };
    
    self.toggleSideBySide = function() {
        self.sideBySide = !self.sideBySide;
        self.buildDOM();
        if (self.currentDiff) {
            self.refresh(self.currentDiff);
        }
    };

    self.buildDOM = function() {
        var html = '<div class="diff-view-container panel panel-default">';
        if (! (parent instanceof webui.CommitExplorerView)) {
            html +=
                '<div class="panel-heading btn-toolbar" role="toolbar">' +
                    '<button type="button" class="btn btn-sm btn-default diff-ignore-whitespace" data-toggle="button">Ignore Whitespace</button>' +
                    '<button type="button" class="btn btn-sm btn-default diff-context-all" data-toggle="button">Complete file</button>' +
                    '<div class="btn-group btn-group-sm">' +
                        '<span></span>&nbsp;' +
                        '<button type="button" class="btn btn-default diff-context-remove">-</button>' +
                        '<button type="button" class="btn btn-default diff-context-add">+</button>' +
                    '</div>' +
                    '<div class="btn-group btn-group-sm diff-selection-buttons">' +
                        '<button type="button" class="btn btn-default diff-stage" style="display:none">Stage</button>' +
                        '<button type="button" class="btn btn-default diff-cancel" style="display:none">Cancel</button>' +
                        '<button type="button" class="btn btn-default diff-unstage" style="display:none">Unstage</button>' +
                    '</div>' +
                    '<div class="btn-group btn-group-sm pull-right">' +
                        '<button type="button" class="btn btn-default diff-toggle-view">Toggle Side-by-Side</button>' +
                    '</div>' +
                    (!self.sideBySide ? '<button type="button"  class="btn btn-sm btn-default diff-explore">Explore</button>' : '') +
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
            left.webuiPrevScrollTop = 0;
            left.webuiPrevScrollLeft = 0;
            
            right = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
            panelBody.appendChild(right);
            rightLines = right.firstChild;
            $(right).scroll(self.diffViewScrolled);
            right.webuiPrevScrollTop = 0;
            right.webuiPrevScrollLeft = 0;
            
            if (hunkSelectionAllowed) {
                $(left).click(self.handleClick);
                $(right).click(self.handleClick);
            }
        } else {
            single = $('<div class="diff-view"><div class="diff-view-lines"></div></div>')[0];
            panelBody.appendChild(single);
            singleLines = single.firstChild;
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
webui.TreeView = function(commitView) {

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
        self.stack = [ { name: webui.repo, object: treeRef } ];
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
        var to = webui.getNodeIndex(event.target.parentElement);
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
        webui.git("ls-tree -l " + treeRef, function(data) {
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
            webui.splitLines(data).forEach(function(line) {
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
                                '<iframe src="' + webui.withRepoParam("/git/cat-file/" + self.stack[self.stack.length - 1].object) + '"></iframe>' +
                            '</div>');
        container.appendTo(self.element);
        $(".tree-blame-toggle", container).click(self.toggleBlame);
    }

    self.toggleBlame = function() {
        var existing = $("#tree-view-blame-content", self.element);
        if (existing.length > 0) {
            existing.remove();
            $("#tree-view-blob-content iframe", self.element).show();
            return;
        }
        var path = self.getCurrentPath();
        webui.apiGet(
            "/api/blame?path=" + encodeURIComponent(path) + "&rev=" + encodeURIComponent(self.commitRef || "HEAD"),
            function(data) {
                $("#tree-view-blob-content iframe", self.element).hide();
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
                webui.showError(webui.parseApiError(xhr, "Unable to blame this file"));
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
webui.CommitExplorerView = function(mainView, diff) {

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

    self.diffView = new webui.DiffView(true, false, self);
    self.fileListView = new webui.FileListView(self, diffSections);
    self.commitHeaderView = new webui.CommitHeaderView(self, diffHeaderLines.join("\n"));

    self.displayDiffForSection(0);

    commitExplorerDiffView.appendChild(self.diffView.element);
    commitExplorerNavigatorView.appendChild(self.fileListView.element);
    commitExplorerNavigatorView.appendChild(self.commitHeaderView.element);

}

webui.FileListView = function(commitExplorerView, files){
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
webui.CommitHeaderView = function(commitExplorerView, header) {
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
webui.CommitView = function(historyView) {

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
        webui.detachChildren(commitViewContent);
        commitViewContent.appendChild(diffView.element);
    };

    self.showTree = function() {
        webui.detachChildren(commitViewContent);
        commitViewContent.appendChild(treeView.element);
    };

    self.historyView = historyView;
    var currentCommit = null;
    self.element = $('<div id="commit-view">')[0];
    var commitViewHeader = $('<div id="commit-view-header">')[0];
    self.element.appendChild(commitViewHeader);
    var buttonBox = new webui.TabBox([["Commit", self.showDiff], ["Tree", self.showTree]]);
    commitViewHeader.appendChild(buttonBox.element);
    var commitViewContent = $('<div id="commit-view-content">')[0];
    self.element.appendChild(commitViewContent);
    var diffView = new webui.DiffView(false, false, self);
    var treeView = new webui.TreeView(self);
};

/*
 * == HistoryView =============================================================
 */
webui.HistoryView = function(mainView) {

    var self = this;

    self.show = function() {
        mainView.switchTo(self.element);
    };

    self.refreshToolbar = function() {
        var currentBranch = webui.getCurrentBranch();
        var title = webui.historyRef ? "History: " + webui.historyRef : "History: All refs";
        var subtitle = webui.historyRef ? "Focused graph view" : "Merged local branches, remotes, and tags";
        if (webui.historyAuthorFilter) {
            subtitle = "Commits by " + webui.historyAuthorFilter;
        }
        if (currentBranch && currentBranch.local_name) {
            subtitle += " • current: " + currentBranch.local_name;
        }
        $(".history-view-title", self.element).text(title);
        $(".history-view-subtitle", self.element).text(subtitle);
        $(".history-view-reset", self.element).prop("disabled", !webui.historyRef && !webui.historyAuthorFilter);
        self.renderRefList();
    }

    self.renderRefList = function() {
        var container = $(".history-view-refs", self.element);
        container.empty();
        if (!webui.branches || webui.branches.length == 0) {
            container.append('<div class="toolbar-menu-empty">No branches yet.</div>');
            return;
        }
        webui.branches.forEach(function(branch) {
            var refInfo = branch.local_name ? {
                kind: "local",
                fullName: "refs/heads/" + branch.local_name,
                displayName: branch.local_name,
                gitRef: branch.local_name,
                commit: branch.commit,
            } : {
                kind: "remote",
                fullName: "refs/remotes/" + branch.remote_name,
                displayName: branch.remote_name,
                gitRef: branch.remote_name,
                commit: branch.commit,
            };
            var chipClass = refInfo.kind == "local" ? "ref-chip-local" : "ref-chip-remote";
            var chip = $('<button type="button" class="ref-chip ' + chipClass + ' history-view-ref-chip"></button>');
            chip.text(refInfo.displayName);
            if (branch.current) {
                chip.prepend('<span class="ref-chip-current">&#10003;</span> ');
                chip.addClass("history-view-ref-current");
            }
            chip.click(function(event) {
                event.stopPropagation();
                mainView.refActionMenu.show(chip[0], refInfo, { commit: branch.commit || "" });
            });
            container.append(chip);
        });
    }

    self.resetFilter = function() {
        webui.historyRef = null;
        webui.historyAuthorFilter = null;
        if (mainView.repoChrome) {
            mainView.repoChrome.focusHistoryRef(null);
        } else {
            self.update(null);
        }
    }

    self.showCommitsByAuthor = function(authorName) {
        webui.historyAuthorFilter = authorName;
        self.update(webui.historyRef);
    }

    self.update = function(ref) {
        webui.historyRef = ref || null;
        self.show();
        self.refreshToolbar();
        self.logView.update(ref);
        if (!webui.viewonly) {
            self.uncommittedSummary.update();
        }
    };

    self.element = $('<div id="history-view"><div class="history-view-sidebar"><div class="history-view-toolbar"><div class="history-view-title"></div><div class="history-view-subtitle"></div><button type="button" class="btn btn-default btn-xs history-view-reset">All refs</button></div><div class="history-view-refs"></div></div><div class="history-view-main"></div></div>')[0];
    $(".history-view-reset", self.element).click(self.resetFilter);
    var historyMain = $(".history-view-main", self.element)[0];
    self.uncommittedSummary = new webui.UncommittedSummaryView(mainView);
    historyMain.appendChild(self.uncommittedSummary.element);
    self.logView = new webui.LogView(self);
    historyMain.appendChild(self.logView.element);
    self.commitView = new webui.CommitView(self);
    self.element.appendChild(self.commitView.element);
    self.mainView = mainView;
    self.refreshToolbar();
};

/*
 * == UncommittedSummaryView ===================================================
 * The "N changed files" card pinned above the commit list, matching
 * GitFiend's Commits tab.
 */
webui.UncommittedSummaryView = function(mainView) {

    var self = this;
    self.expanded = false;
    self.files = [];

    self.toggleExpand = function() {
        self.expanded = !self.expanded;
        self.render();
    }

    self.render = function() {
        if (self.files.length == 0) {
            $(self.element).hide();
            return;
        }
        $(self.element).show();
        $(".uncommitted-summary-count", self.element).text(self.files.length + " changed file" + (self.files.length == 1 ? "" : "s"));
        var fileList = $(".uncommitted-summary-files", self.element);
        fileList.empty();
        fileList.toggle(self.expanded);
        self.files.forEach(function(file) {
            var row = $('<div class="uncommitted-summary-file"><span class="uncommitted-summary-file-path"></span><span class="uncommitted-summary-file-status"></span></div>');
            $(".uncommitted-summary-file-path", row).text(file.path);
            var statusClass = file.status == "?" ? "untracked" : file.status;
            $(".uncommitted-summary-file-status", row).text(file.status).addClass("uncommitted-status-" + statusClass);
            fileList.append(row);
        });
    }

    self.update = function() {
        webui.git("status --porcelain", function(data) {
            self.files = [];
            webui.splitLines(data).forEach(function(line) {
                if (!line) {
                    return;
                }
                var indexStatus = line[0];
                var workTreeStatus = line[1];
                var status = indexStatus != " " && indexStatus != "?" ? indexStatus : workTreeStatus;
                self.files.push({ path: line.substr(3), status: status });
            });
            self.render();
        });
    }

    self.element = $(   '<div class="uncommitted-summary">' +
                            '<div class="uncommitted-summary-header">' +
                                '<span class="uncommitted-summary-dot"></span>' +
                                '<span class="uncommitted-summary-count"></span>' +
                                '<span class="uncommitted-summary-spacer"></span>' +
                            '</div>' +
                            '<div class="uncommitted-summary-files"></div>' +
                        '</div>')[0];
    $(".uncommitted-summary-header", self.element).click(self.toggleExpand);
    $(self.element).hide();
};

/*
 * == ConflictBannerView ======================================================
 * Shown above the diff/file lists whenever a merge or rebase is in progress
 * with unresolved conflicts, with Accept Ours/Theirs per file and Abort.
 */
webui.ConflictBannerView = function(workspaceView) {

    var self = this;

    self.update = function() {
        webui.apiGet("/api/conflicts", function(data) {
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
                                '<button type="button" class="btn btn-default btn-xs conflict-ours">Accept Ours</button>' +
                                '<button type="button" class="btn btn-default btn-xs conflict-theirs">Accept Theirs</button>' +
                            '</div>');
            $(".conflict-banner-file-path", row).text(path);
            $(".conflict-ours", row).click(function() { self.resolve(path, "ours"); });
            $(".conflict-theirs", row).click(function() { self.resolve(path, "theirs"); });
            list.append(row);
        });

        $(".conflict-continue", self.element).toggle(!!data.rebasing);
    }

    self.resolve = function(path, resolution) {
        webui.apiPost("/api/conflicts/resolve", {path: path, resolution: resolution}, function(data) {
            self.render(data);
            workspaceView.update("stage");
        }, function(xhr) {
            webui.showError(webui.parseApiError(xhr, "Unable to resolve conflict"));
        });
    }

    self.onAbort = function() {
        if (!window.confirm("Abort the in-progress merge/rebase?")) {
            return;
        }
        var cmd = self.lastStatus && self.lastStatus.rebasing ? "rebase --abort" : "merge --abort";
        webui.git(cmd, function() {
            self.update();
            workspaceView.update("stage");
        });
    }

    self.onContinue = function() {
        webui.git("rebase --continue", function() {
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

/*
 * == WorkspaceView ===========================================================
 */
webui.WorkspaceView = function(mainView) {

    var self = this;

    self.show = function() {
        mainView.switchTo(self.element);
    };

    self.update = function(mode) {
        self.show();
        self.workingCopyView.update();
        self.stagingAreaView.update();
        self.commitMessageView.update();
        self.conflictBanner.update();
        if (self.workingCopyView.getSelectedItemsCount() + self.stagingAreaView.getSelectedItemsCount() == 0) {
            self.diffView.update(undefined, undefined, undefined, mode);
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
        webui.git(cmd, function(data) {
            webui.showResult("Stash created", data || "Changes stashed");
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
            webui.git("checkout -- .", function() {
                self.update("stage");
            });
        }
    }

    self.element = $(   '<div id="workspace-view">' +
                            '<div class="workspace-toolbar">' +
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
                            '<div id="workspace-diff-view"></div>' +
                            '<div id="workspace-editor"></div>' +
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

    self.conflictBanner = new webui.ConflictBannerView(self);
    $(".conflict-banner", self.element).replaceWith(self.conflictBanner.element);
    var workspaceDiffView = $("#workspace-diff-view", self.element)[0];
    self.diffView = new webui.DiffView(true, true, self);
    workspaceDiffView.appendChild(self.diffView.element);
    var workspaceEditor = $("#workspace-editor", self.element)[0];
    self.workingCopyView = new webui.ChangedFilesView(self, "working-copy", "Working Copy");
    workspaceEditor.appendChild(self.workingCopyView.element);
    self.commitMessageView = new webui.CommitMessageView(self);
    workspaceEditor.appendChild(self.commitMessageView.element);
    self.stagingAreaView = new webui.ChangedFilesView(self, "staging-area", "Staging Area");
    workspaceEditor.appendChild(self.stagingAreaView.element);
};

/*
 * == ChangedFilesView ========================================================
 */
webui.ChangedFilesView = function(workspaceView, type, label) {

    var self = this;

    self.update = function() {
        $(fileList).empty()
        var col = type == "working-copy" ? 1 : 0;
        webui.git("status --porcelain", function(data) {
            self.filesCount = 0;
            webui.splitLines(data).forEach(function(line) {
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
                            webui.apiPost("/api/gitignore/add", {pattern: ignoreModel}, function(data) {
                                webui.showResult("Updated .gitignore", data.message);
                                workspaceView.update("stage");
                            }, function(xhr) {
                                webui.showError(webui.parseApiError(xhr, "Unable to update .gitignore"));
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
        });
    };

    self.select = function(event) {
        var clicked = event.target;

        if (event.shiftKey && selectedIndex !== null) {
            var clickedIndex = webui.getNodeIndex(clicked);
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
            selectedIndex = webui.getNodeIndex(clicked);
        } else {
            for (var i = 0; i < fileList.childElementCount; ++i) {
                $(fileList.children[i]).removeClass("active");
            }
            $(clicked).addClass("active");
            selectedIndex = webui.getNodeIndex(clicked);
        }
        if (type == "working-copy") {
            workspaceView.stagingAreaView.unselect();
        } else {
            workspaceView.workingCopyView.unselect();
        }
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
            webui.git(cmd + " -- " + files, function(data) {
                if (rmFiles.length != 0) {
                    webui.git("rm -- " + rmFiles, function(data) {
                        workspaceView.update(type == "working-copy" ? "stage" : "unstage");
                    });
                } else {
                    workspaceView.update(type == "working-copy" ? "stage" : "unstage");
                }
            });
        } else if (rmFiles.length != 0) {
            var cmd = type == "working-copy" ? "rm" : "reset";
            webui.git(cmd + " -- " + rmFiles, function(data) {
                workspaceView.update(type == "working-copy" ? "stage" : "unstage");
            });
        }
    };

    self.cancel = function() {
        prevScrollTop = fileListContainer.scrollTop;
        var files = self.getFileList();
        if (files.length != 0) {
            webui.git("checkout -- " + files, function(data) {
                workspaceView.update("stage");
            });
        }
    }

    self.getSelectedItemsCount = function() {
        return $(".active", fileList).length;
    }

    self.applyFilter = function(query) {
        for (var i = 0; i < fileList.childElementCount; ++i) {
            var child = fileList.children[i];
            $(child).toggle(!query || child.model.toLowerCase().indexOf(query) != -1);
        }
    }

    self.element = $(   '<div id="' + type + '-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
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

    self.filesCount = 0;
};

/*
 * == CommitMessageView =======================================================
 */
webui.CommitMessageView = function(workspaceView) {

    var self = this;

    self.onAmend = function() {
        if (!amend.hasClass("active") && textArea.value.length == 0) {
            webui.git("log --pretty=format:%B -n 1", function(data) {
                textArea.value = data;
            });
        }
    };

    self.onCommit = function() {
        if (workspaceView.stagingAreaView.filesCount == 0 && !amend.hasClass("active")) {
            webui.showError("No files staged for commit");
        } else if (textArea.value.length == 0) {
            webui.showError("Enter a commit message first");
        } else {
            var cmd = "commit ";
            if (amend.hasClass("active")) {
                cmd += "--amend ";
            }
            cmd += "--file=-";
            webui.git(cmd, textArea.value, function(data) {
                textArea.value = "";
                workspaceView.update("stage");
                amend.removeClass("active");
            });
        }
    }

    self.update = function() {
        if (webui.gitUserName) {
            $(".commit-message-commit", self.element).text("Commit as " + webui.gitUserName);
            return;
        }
        webui.git("config user.name", function(data) {
            webui.gitUserName = data.trim() || "you";
            $(".commit-message-commit", self.element).text("Commit as " + webui.gitUserName);
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
 * A dedicated Local / Remote branch list, similar to GitFiend's Branches tab.
 */
webui.BranchesView = function(mainView) {

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
        webui.apiGet("/api/branches", function(data) {
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
        webui.detachChildren(self.mainView);
        self.mainView.appendChild(element);
    }

    self.bootstrap = function(context) {
        var postAction = sessionStorage.getItem("git-webui-post-action");
        if (postAction) {
            sessionStorage.removeItem("git-webui-post-action");
        }
        var flashMessage = webui.consumeFlashMessage();

        webui.repo = context.repo_name || "/";
        webui.repoPath = context.repo_path;
        webui.recentRepos = context.recent_repos || [];
        webui.activeRepoId = context.repo_id || null;
        webui.openRepos = context.open_repos || [];
        webui.workspacePath = context.workspace_path;
        webui.recentWorkspaces = context.recent_workspaces || [];
        webui.workspaceRepos = context.workspace_repos || [];
        webui.viewonly = context.view_only;

        var title = $("title")[0];
        title.textContent = context.has_repo ? "Git - " + webui.repo : "Git WebUI";

        var body = $("body")[0];
        $('<div id="message-box">').appendTo(body);

        self.repoPicker = new webui.RepoPicker(self);
        body.appendChild(self.repoPicker.element);
        self.refActionMenu = new webui.RefActionMenu(self);
        self.commitActionMenu = new webui.CommitActionMenu(self);
        self.searchOverlay = new webui.SearchOverlay(self);
        self.configureRemotesView = new webui.ConfigureRemotesView();
        self.worktreesView = new webui.WorktreesView(self);
        self.stashesView = new webui.StashesView(self);
        self.reflogView = new webui.ReflogView(self);
        self.submodulesView = new webui.SubmodulesView(self);
        self.interactiveRebaseView = new webui.InteractiveRebaseView(self);

        self.repoChrome = new webui.Toolbar(self);
        body.appendChild(self.repoChrome.element);
        self.repoChrome.update();

        var globalContainer = $('<div id="global-container">').appendTo(body)[0];
        self.mainView = $('<div id="main-view">')[0];
        globalContainer.appendChild(self.mainView);

        if (context.has_repo) {
            self.historyView = new webui.HistoryView(self);
            self.branchesView = new webui.BranchesView(self);
            if (!webui.viewonly) {
                self.workspaceView = new webui.WorkspaceView(self);
            }
            if (postAction == "workspace" && self.workspaceView) {
                self.workspaceView.update("stage");
                self.repoChrome.activateSection("workspace");
            } else if (postAction == "history") {
                self.historyView.update(webui.historyRef);
                self.repoChrome.activateSection("history");
            } else {
                self.historyView.update(webui.historyRef);
            }
        } else {
            self.switchTo(new webui.NoRepoView(self).element);
        }

        if (flashMessage) {
            webui.showModal(
                flashMessage.title || (flashMessage.type == "error" ? "Error" : "Result"),
                flashMessage.message || "",
                flashMessage.type == "error" ? "error" : "info"
            );
        }
    }

    webui.apiGet("/api/context", self.bootstrap);
}

$(document).ready(function () {
    new MainUi()
});
