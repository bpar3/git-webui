const { loadGitpar } = require("./helpers/load-gitpar");

describe("HistoryView repository state", () => {
    test("returns a newly selected repository to its commit list while preserving an expanded commit", () => {
        const gitpar = loadGitpar();
        const container = gitpar.__testDocument.createElement("div");
        const mainView = {
            switchTo(element) {
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
                container.appendChild(element);
            },
        };
        const historyView = new gitpar.HistoryView(mainView);
        const entry = { commit: "abc123" };

        mainView.switchTo(historyView.commitDetailView.element);
        historyView.commitDetailView.entry = entry;
        historyView.commitDetailView.selectedPath = "README.md";
        historyView.saveRepoState("/repo-one");

        mainView.switchTo(historyView.element);
        historyView.saveRepoState("/repo-two");

        historyView.expandCommit = jest.fn();
        historyView.show = jest.fn();
        historyView.restoreRepoState("/repo-two");
        expect(historyView.show).toHaveBeenCalledTimes(1);

        historyView.restoreRepoState("/repo-one");
        expect(historyView.expandCommit).toHaveBeenCalledWith(entry, "README.md");
    });
});
