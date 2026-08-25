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
webui.workspacePath = null;
webui.recentWorkspaces = [];
webui.workspaceRepos = [];
webui.branches = [];
webui.hostname = "localhost";
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

webui.apiGet = function(url, callback) {
    $.getJSON(url)
    .done(callback)
    .fail(function(xhr) {
        webui.showError(webui.parseApiError(xhr, "Git webui server not running"));
    });
}

webui.apiPost = function(url, payload, callback, errorCallback) {
    $.ajax({
        url: url,
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
    $.post("git", cmd, function(data, status, xhr) {
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

webui.RepoPicker = function() {

    var self = this;
    self.mode = "repo";

    self.getPickerTitle = function() {
        return self.mode == "workspace" ? "Select Folder Of Repositories" : "Select Git Repository";
    }

    self.selectWorkspace = function(path) {
        webui.apiPost("/api/workspaces/select", {path: path}, webui.reloadApp);
    }

    self.selectRepo = function(path) {
        webui.apiPost("/api/repos/select", {path: path}, webui.reloadApp);
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

webui.RepoChrome = function(mainView) {

    var self = this;
    self.expandedDrawer = null;

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

    self.updateStatusMeta = function() {
        $(".repo-chrome-branch-value", self.element).text(self.branchSummary());
        $(".repo-chrome-workspace-value", self.element).text(webui.workspacePath || "No workspace folder");
        $(".repo-chrome-recents-value", self.element).text(webui.recentRepos.length + " repos / " + webui.recentWorkspaces.length + " folders");
    }

    self.setDrawerState = function(drawerName) {
        self.expandedDrawer = drawerName;
        var sections = ["repos", "workspaces"];
        sections.forEach(function(name) {
            var isOpen = name == drawerName;
            $(".repo-chrome-drawer-button[data-drawer='" + name + "']", self.element).toggleClass("active", isOpen);
            $(".repo-chrome-drawer-section[data-drawer='" + name + "']", self.element).toggle(isOpen);
        });
    }

    self.toggleDrawer = function(event) {
        var drawerName = event.currentTarget.getAttribute("data-drawer");
        self.setDrawerState(self.expandedDrawer == drawerName ? null : drawerName);
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

    self.selectRecentWorkspace = function(event) {
        var path = event.currentTarget.getAttribute("data-path");
        if (path) {
            mainView.repoPicker.selectWorkspace(path);
        }
    }

    self.selectWorkspaceRepo = function(event) {
        var path = event.currentTarget.value || event.currentTarget.getAttribute("data-path");
        if (path) {
            mainView.repoPicker.selectRepo(path);
        }
    }

    self.focusHistoryRef = function(refName) {
        webui.historyRef = refName || null;
        if (mainView.sideBarView) {
            mainView.sideBarView.activateSection("history");
        }
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

    self.viewBranch = function(event) {
        var refName = event.currentTarget.getAttribute("data-ref");
        if (refName) {
            self.focusHistoryRef(refName);
        }
    }

    self.checkoutBranch = function(event) {
        self.checkoutRef(
            event.currentTarget.getAttribute("data-local") || null,
            event.currentTarget.getAttribute("data-remote") || null
        );
    }

    self.compareBranch = function(event) {
        self.compareRef(event.currentTarget.getAttribute("data-ref") || null);
    }

    self.mergeBranch = function(event) {
        self.mergeRef(event.currentTarget.getAttribute("data-ref") || null, false);
    }

    self.squashBranch = function(event) {
        self.mergeRef(event.currentTarget.getAttribute("data-ref") || null, true);
    }

    self.deleteBranch = function(event) {
        self.removeBranch(event.currentTarget.getAttribute("data-local"));
    }

    self.populateWorkspaceSwitcher = function() {
        var select = $(".repo-chrome-workspace-switcher", self.element);
        select.empty();
        if (!webui.workspacePath) {
            $("<option>")
                .text("No workspace folder selected")
                .prop("disabled", true)
                .prop("selected", true)
                .appendTo(select);
            select.prop("disabled", true);
            return;
        }

        if (webui.workspaceRepos.length == 0) {
            $("<option>")
                .text("No git repos found in workspace")
                .prop("disabled", true)
                .prop("selected", true)
                .appendTo(select);
            select.prop("disabled", true);
            return;
        }

        var hasActiveRepo = webui.workspaceRepos.some(function(repo) {
            return repo.active;
        });
        if (!hasActiveRepo) {
            $("<option>")
                .text("Current repo is outside this workspace")
                .prop("disabled", true)
                .prop("selected", true)
                .appendTo(select);
            select.prop("disabled", true);
            return;
        }

        webui.workspaceRepos.forEach(function(repo) {
            var label = repo.name + "  [" + repo.branch + "]  " + webui.formatRepoCounts(repo);
            $("<option>")
                .val(repo.path)
                .text(label)
                .prop("selected", repo.active)
                .appendTo(select);
        });
        select.prop("disabled", false);
    }

    self.update = function() {
        $(".repo-chrome-name", self.element).text(webui.repo || "No Repository Selected");
        $(".repo-chrome-path", self.element).text(webui.repoPath || "Choose a repository from recent history or browse the local filesystem.");
        $(".repo-chrome-browse", self.element).prop("disabled", webui.viewonly);
        $(".repo-chrome-open-workspace", self.element).prop("disabled", webui.viewonly);
        $(".repo-chrome-workspace-path", self.element).text(webui.workspacePath || "No folder-of-repos selected yet.");

        var recentWorkspaceList = $(".repo-chrome-workspace-recents", self.element);
        recentWorkspaceList.empty();
        if (webui.recentWorkspaces.length == 0) {
            $('<span class="repo-chrome-empty">No recent repo folders yet.</span>').appendTo(recentWorkspaceList);
        } else {
            webui.recentWorkspaces.forEach(function(workspace) {
                var button = $('<button type="button" class="btn btn-default repo-chip repo-workspace-chip">')[0];
                button.setAttribute("data-path", workspace.path);
                $(button).append('<span class="repo-chip-name">' + webui.escapeHtml(workspace.name) + '</span>');
                $(button).append('<span class="repo-chip-path">' + webui.escapeHtml(workspace.path) + '</span>');
                if (workspace.active) {
                    $(button).addClass("active");
                }
                $(button).click(self.selectRecentWorkspace);
                recentWorkspaceList.append(button);
            });
        }

        var recentList = $(".repo-chrome-repo-recents", self.element);
        recentList.empty();
        if (webui.recentRepos.length == 0) {
            $('<span class="repo-chrome-empty">No recent repositories yet.</span>').appendTo(recentList);
        } else {
            webui.recentRepos.forEach(function(repo) {
                var button = $('<button type="button" class="btn btn-default repo-chip">')[0];
                button.setAttribute("data-path", repo.path);
                $(button).append('<span class="repo-chip-name">' + webui.escapeHtml(repo.name) + '</span>');
                $(button).append('<span class="repo-chip-path">' + webui.escapeHtml(repo.path) + '</span>');
                if (repo.active) {
                    $(button).addClass("active");
                }
                $(button).click(self.selectRecentRepo);
                recentList.append(button);
            });
        }

        $(".repo-chrome-drawer-button[data-drawer='repos'] .repo-chrome-drawer-count", self.element).text(webui.recentRepos.length);
        $(".repo-chrome-drawer-button[data-drawer='workspaces'] .repo-chrome-drawer-count", self.element).text(webui.recentWorkspaces.length);
        self.updateStatusMeta();
        self.setDrawerState(self.expandedDrawer);

        self.populateWorkspaceSwitcher();
        self.loadBranches();
    }

    self.element = $(   '<div id="repo-chrome">' +
                            '<div class="repo-chrome-header">' +
                                '<div class="repo-chrome-copy">' +
                                    '<div class="repo-chrome-eyebrow">Repository Control</div>' +
                                    '<div class="repo-chrome-name"></div>' +
                                    '<div class="repo-chrome-path"></div>' +
                                    '<div class="repo-chrome-status">' +
                                        '<span class="repo-chrome-status-item"><span class="repo-chrome-status-label">Branch</span><span class="repo-chrome-status-value repo-chrome-branch-value"></span></span>' +
                                        '<span class="repo-chrome-status-item"><span class="repo-chrome-status-label">Workspace</span><span class="repo-chrome-status-value repo-chrome-workspace-value"></span></span>' +
                                        '<span class="repo-chrome-status-item"><span class="repo-chrome-status-label">Recent</span><span class="repo-chrome-status-value repo-chrome-recents-value"></span></span>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="repo-chrome-actions">' +
                                    '<button type="button" class="btn btn-primary btn-sm repo-chrome-browse">Browse Repo</button>' +
                                    '<button type="button" class="btn btn-default btn-sm repo-chrome-open-workspace">Open Repo Folder</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="repo-chrome-drawers">' +
                                '<button type="button" class="btn btn-default btn-sm repo-chrome-drawer-button" data-drawer="repos">Recent Repositories <span class="badge repo-chrome-drawer-count"></span></button>' +
                                '<button type="button" class="btn btn-default btn-sm repo-chrome-drawer-button" data-drawer="workspaces">Recent Repo Folders <span class="badge repo-chrome-drawer-count"></span></button>' +
                            '</div>' +
                            '<div class="repo-chrome-drawer-section" data-drawer="workspaces">' +
                                '<div class="repo-chrome-recent-title">Recent Repo Folders</div>' +
                                '<div class="repo-chrome-recent-list repo-chrome-workspace-recents"></div>' +
                            '</div>' +
                             '<div class="repo-chrome-drawer-section" data-drawer="repos">' +
                                 '<div class="repo-chrome-recent-title">Recent Repositories</div>' +
                                 '<div class="repo-chrome-recent-list repo-chrome-repo-recents"></div>' +
                             '</div>' +
                             '<div class="repo-chrome-compactbar">' +
                                 '<div class="repo-chrome-switcher">' +
                                     '<div class="repo-chrome-recent-title">Workspace Repo</div>' +
                                     '<select class="form-control input-sm repo-chrome-workspace-switcher"></select>' +
                                 '</div>' +
                                 '<div class="repo-chrome-switcher repo-chrome-history-switcher">' +
                                     '<div class="repo-chrome-recent-title">History</div>' +
                                     '<div class="repo-chrome-history-hint">Merged local and remote refs. Click a ref label in the graph for actions.</div>' +
                                     '<div class="repo-chrome-workspace-path"></div>' +
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

    $(".repo-chrome-browse", self.element).click(self.openPicker);
    $(".repo-chrome-open-workspace", self.element).click(self.openWorkspacePicker);
    $(".repo-chrome-drawer-button", self.element).click(self.toggleDrawer);
    $(".repo-chrome-workspace-switcher", self.element).change(self.selectWorkspaceRepo);
    $("body").append(self.compareModal);
    self.setDrawerState(null);
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
 * == SideBarView =============================================================
 */
webui.SideBarView = function(mainView) {

    var self = this;

    self.activateSection = function(sectionName) {
        $(".sidebar-nav-button", self.element).removeClass("active");
        $(".sidebar-nav-button[data-section='" + sectionName + "']", self.element).addClass("active");
    }

    self.selectRef = function(refName) {
        webui.historyRef = refName || null;
        self.activateSection("history");
        self.mainView.historyView.update(refName);
    };

    self.showWorkspace = function() {
        self.activateSection("workspace");
        self.mainView.workspaceView.update("stage");
    }

    self.showHistory = function() {
        self.activateSection("history");
        self.mainView.historyView.update(webui.historyRef);
    }

    self.showRemote = function() {
        self.activateSection("remote");
        self.mainView.remoteView.update();
    }

    self.mainView = mainView;
    self.element = $(   '<div id="sidebar">' +
                            '<a href="#" data-toggle="modal" data-target="#help-modal"><img id="sidebar-logo" src="/img/git-logo.png"></a>' +
                            '<div id="sidebar-content">' +
                                '<div class="sidebar-nav">' +
                                    '<button type="button" class="btn btn-default sidebar-nav-button" data-section="history">History</button>' +
                                    (webui.viewonly ? '' : '<button type="button" class="btn btn-default sidebar-nav-button" data-section="workspace">Workspace</button>') +
                                    '<button type="button" class="btn btn-default sidebar-nav-button" data-section="remote">Remote</button>' +
                                '</div>' +
                                '<div class="sidebar-hint">All refs are now in the commit graph. Use the labels on commits for branch and tag actions.</div>' +
                                '<div class="sidebar-theme-wrap">' +
                                    '<button class="btn btn-sm btn-default" id="theme-toggle">Toggle Dark Mode</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
                        
    $("#theme-toggle", self.element).click(function() {
        $("body").toggleClass("dark-mode");
        var isDarkMode = $("body").hasClass("dark-mode");
        if (isDarkMode) {
            localStorage.setItem("theme", "dark");
        } else {
            localStorage.setItem("theme", "light");
        }
    });
    
    if (localStorage.getItem("theme") === "dark") {
        $("body").addClass("dark-mode");
    }

    if (webui.viewonly) {
        $(".sidebar-nav-button[data-section='workspace']", self.element).remove();
    } else {
        $(".sidebar-nav-button[data-section='workspace']", self.element).click(self.showWorkspace);
    }

    $(".sidebar-nav-button[data-section='history']", self.element).click(self.showHistory);
    $(".sidebar-nav-button[data-section='remote']", self.element).click(self.showRemote);
    self.activateSection("history");
};

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

        self.addAction("Create branch from here", function() {
            mainView.repoChrome.createBranchAtRef(refInfo.gitRef || entry.commit, refInfo.displayName + "-copy");
        }, webui.viewonly);

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

        self.addAction("Copy ref name", function() {
            webui.copyToClipboard(refInfo.gitRef || refInfo.fullName, "Ref name");
        }, !(refInfo.gitRef || refInfo.fullName));
        self.addAction("Copy commit hash", function() {
            webui.copyToClipboard(entry.commit, "Commit hash");
        }, !entry.commit);
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
 * == LogView =================================================================
 */
webui.LogView = function(historyView) {

    var self = this;

    self.update = function(ref) {
        $(svg).empty();
        streams = []
        $(content).empty();
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
        webui.git("log --date-order --pretty=raw --decorate=full --skip=" + self.nextSkip + " --max-count=" + (maxCount + 1) + " " + refSpec + " --", function(data) {
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
                                    '<h6></h6>' +
                                    '<div class="log-entry-refs"></div>' +
                                    '<span class="log-entry-date">' + self.author.date.toLocaleString() + '&nbsp;</span> ' +
                                    '<span class="badge">' + self.abbrevCommitHash() + '</span>' +
                                '</header>' +
                                '<p class="list-group-item-text"></p>' +
                             '</a>')[0];
            $('<a target="_blank" href="mailto:' + self.author.email + '">' + self.author.name + '</a>').appendTo($("h6", self.element));
            $(".list-group-item-text", self.element)[0].appendChild(document.createTextNode(self.abbrevMessage()));
            if (self.decoratedRefs.length > 0) {
                var refBox = $(".log-entry-refs", self.element);
                self.decoratedRefs.forEach(function(refInfo) {
                    var refType = "warning";
                    if (refInfo.kind == "remote") {
                        refType = "danger";
                    } else if (refInfo.kind == "local") {
                        refType = "success";
                    } else if (refInfo.kind == "tag") {
                        refType = "info";
                    }
                    var label = $('<button type="button" class="label label-' + refType + ' log-entry-ref">' + refInfo.displayName + '</button>');
                    label.click(function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        historyView.mainView.refActionMenu.show(label[0], refInfo, self);
                    });
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

    self.update = function(treeRef) {
        self.stack = [ { name: webui.repo, object: treeRef } ];
        self.showTree();
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
        $(  '<div id="tree-view-blob-content">' +
                '<iframe src="/git/cat-file/' + self.stack[self.stack.length - 1].object + '"></iframe>' +
            '</div>').appendTo(self.element);
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
        treeView.update(entry.tree);
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
        if (currentBranch && currentBranch.local_name) {
            subtitle += " • current: " + currentBranch.local_name;
        }
        $(".history-view-title", self.element).text(title);
        $(".history-view-subtitle", self.element).text(subtitle);
        $(".history-view-reset", self.element).prop("disabled", !webui.historyRef);
    }

    self.resetFilter = function() {
        webui.historyRef = null;
        if (mainView.repoChrome) {
            mainView.repoChrome.focusHistoryRef(null);
        } else {
            self.update(null);
        }
    }

    self.update = function(ref) {
        webui.historyRef = ref || null;
        self.show();
        self.refreshToolbar();
        self.logView.update(ref);
    };

    self.element = $('<div id="history-view"><div class="history-view-sidebar"><div class="history-view-toolbar"><div class="history-view-title"></div><div class="history-view-subtitle"></div><button type="button" class="btn btn-default btn-xs history-view-reset">All refs</button></div></div></div>')[0];
    $(".history-view-reset", self.element).click(self.resetFilter);
    self.logView = new webui.LogView(self);
    self.element.appendChild(self.logView.element);
    self.commitView = new webui.CommitView(self);
    self.element.appendChild(self.commitView.element);
    self.mainView = mainView;
    self.refreshToolbar();
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
        self.remoteActionsView.update();
        if (self.workingCopyView.getSelectedItemsCount() + self.stagingAreaView.getSelectedItemsCount() == 0) {
            self.diffView.update(undefined, undefined, undefined, mode);
        }
    };

    self.element = $(   '<div id="workspace-view">' +
                            '<div id="workspace-diff-view"></div>' +
                            '<div id="workspace-editor"></div>' +
                        '</div>')[0];
    var workspaceDiffView = $("#workspace-diff-view", self.element)[0];
    self.diffView = new webui.DiffView(true, true, self);
    workspaceDiffView.appendChild(self.diffView.element);
    var workspaceEditor = $("#workspace-editor", self.element)[0];
    self.workingCopyView = new webui.ChangedFilesView(self, "working-copy", "Working Copy");
    workspaceEditor.appendChild(self.workingCopyView.element);
    self.commitMessageView = new webui.CommitMessageView(self);
    workspaceEditor.appendChild(self.commitMessageView.element);
    self.remoteActionsView = new webui.RemoteActionsView(self);
    workspaceEditor.appendChild(self.remoteActionsView.element);
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
                    var item = $('<a class="list-group-item">').appendTo(fileList)[0];
                    item.status = status;
                    line = line.substr(3);
                    var splitted = line.split(" -> ");
                    if (splitted.length > 1) {
                        item.model = splitted[1];
                    } else {
                        item.model = line
                    }
                    item.appendChild(document.createTextNode(line));
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
    }

    self.element = $(   '<div id="commit-message-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5>Message</h5>' +
                                '<div class="btn-group btn-group-sm">' +
                                    '<button type="button" class="btn btn-default commit-message-amend" data-toggle="button">Amend</button>' +
                                    '<button type="button" class="btn btn-default commit-message-commit">Commit</button>' +
                                '</div>' +
                            '</div>' +
                            '<textarea></textarea>' +
                        '</div>')[0];
    var textArea = $("textarea", self.element)[0];
    var amend = $(".commit-message-amend", self.element);
    amend.click(self.onAmend);
    $(".commit-message-commit", self.element).click(self.onCommit);
};

/*
 * == RemoteActionsView =======================================================
 */
webui.RemoteActionsView = function(workspaceView) {

    var self = this;

    self.onPush = function() {
        webui.git("push", function(data) {
            webui.showResult("Push completed", data);
            workspaceView.update("stage");
        });
    }

    self.onPull = function() {
        webui.git("pull", function(data) {
            webui.showResult("Pull completed", data);
            workspaceView.update("stage");
        });
    }

    self.onFetch = function() {
        webui.git("fetch", function(data) {
            webui.showResult("Fetch completed", data);
            workspaceView.update("stage");
        });
    }

    self.update = function() {
    }

    self.element = $(   '<div id="remote-actions-view" class="panel panel-default">' +
                            '<div class="panel-heading">' +
                                '<h5>Remote Actions</h5>' +
                                '<div class="btn-group btn-group-sm">' +
                                    '<button type="button" class="btn btn-default remote-action-fetch">Fetch</button>' +
                                    '<button type="button" class="btn btn-default remote-action-pull">Pull</button>' +
                                    '<button type="button" class="btn btn-default remote-action-push">Push</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>')[0];
    $(".remote-action-fetch", self.element).click(self.onFetch);
    $(".remote-action-pull", self.element).click(self.onPull);
    $(".remote-action-push", self.element).click(self.onPush);
};

webui.RemoteView = function(mainView) {

    var self = this;

    self.show = function() {
        mainView.switchTo(self.element);
    };

    self.update = function() {
        self.show();
    };

    self.element = $(   '<div class="jumbotron">' +
                            '<h1>Remote access</h1>' +
                            '<p>Git webui allows other people to clone and pull from your repository.</p>' +
                            '<div class="git-access">' +
                                '<p>Other people can clone your repository:</p>' +
                                '<pre class="git-clone"></pre>' +
                                '<p>Or to pull from your repository:</p>' +
                                '<pre class="git-pull"></pre>' +
                            '</div>' +
                        '</div>')[0];
    $(".git-clone", self.element).text("git clone http://" + webui.hostname + ":" + document.location.port + "/ " + webui.repo);
    $(".git-pull", self.element).text("git pull http://" + webui.hostname + ":" + document.location.port + "/");
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
        webui.workspacePath = context.workspace_path;
        webui.recentWorkspaces = context.recent_workspaces || [];
        webui.workspaceRepos = context.workspace_repos || [];
        webui.viewonly = context.view_only;
        webui.hostname = context.hostname;

        var title = $("title")[0];
        title.textContent = context.has_repo ? "Git - " + webui.repo : "Git WebUI";

        var body = $("body")[0];
        $('<div id="message-box">').appendTo(body);

        self.repoPicker = new webui.RepoPicker();
        body.appendChild(self.repoPicker.element);
        self.refActionMenu = new webui.RefActionMenu(self);

        self.repoChrome = new webui.RepoChrome(self);
        body.appendChild(self.repoChrome.element);
        self.repoChrome.update();

        var globalContainer = $('<div id="global-container">').appendTo(body)[0];
        self.mainView = $('<div id="main-view">')[0];
        globalContainer.appendChild(self.mainView);

        if (context.has_repo) {
            self.sideBarView = new webui.SideBarView(self);
            globalContainer.insertBefore(self.sideBarView.element, self.mainView);

            self.historyView = new webui.HistoryView(self);
            self.remoteView = new webui.RemoteView(self);
            if (!webui.viewonly) {
                self.workspaceView = new webui.WorkspaceView(self);
            }
            if (postAction == "workspace" && self.workspaceView) {
                self.workspaceView.update("stage");
                self.sideBarView.activateSection("workspace");
            } else if (postAction == "history") {
                self.historyView.update(webui.historyRef);
                self.sideBarView.activateSection("history");
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
