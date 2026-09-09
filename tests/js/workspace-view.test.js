const { loadGitpar } = require("./helpers/load-gitpar");

describe("WorkspaceView discard", () => {
    test("discarding all changes resets staged files and removes untracked files", () => {
        const gitpar = loadGitpar();
        const workspace = new gitpar.WorkspaceView({
            switchTo() {},
            repoChrome: { showDiffControls() {} },
        });
        workspace.update = jest.fn();
        gitpar.showConfirm = (message, onConfirm) => onConfirm();
        gitpar.git = jest.fn((command, onSuccess) => onSuccess());

        workspace.discardChanges(false);

        expect(gitpar.git.mock.calls.map(call => call[0])).toEqual(["reset --hard", "clean -fd"]);
        expect(workspace.update).toHaveBeenCalledWith("stage");
    });
});
