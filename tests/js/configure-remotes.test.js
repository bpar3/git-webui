const { loadGitpar } = require("./helpers/load-gitpar");

describe("ConfigureRemotesView branch remote selector", () => {
    function createView(gitpar) {
        gitpar.__testJQuery.fn.modal = function() { return this; };
        return new gitpar.ConfigureRemotesView();
    }

    test("shows a branch's configured remote when multiple remotes exist", () => {
        const gitpar = loadGitpar();
        const view = createView(gitpar);
        const branch = { local_name: "main", upstream: "upstream/main" };
        gitpar.apiGet = (url, onSuccess) => onSuccess({
            remotes: [{ name: "origin" }, { name: "upstream" }],
        });

        view.show(branch);

        const select = gitpar.__testJQuery(".configure-remotes-branch-select", view.element);
        expect(gitpar.__testJQuery(".configure-remotes-branch-remote", view.element).css("display")).not.toBe("none");
        expect(select.val()).toBe("upstream");
    });

    test("updates the branch remote when a different remote is selected", () => {
        const gitpar = loadGitpar();
        const view = createView(gitpar);
        const branch = { local_name: "main", upstream: "origin/main" };
        const onChanged = jest.fn();
        gitpar.apiGet = (url, onSuccess) => onSuccess({
            remotes: [{ name: "origin" }, { name: "upstream" }],
        });
        gitpar.apiPost = jest.fn((url, payload, onSuccess) => onSuccess());

        view.show(branch, onChanged);
        gitpar.__testJQuery(".configure-remotes-branch-select", view.element).val("upstream").trigger("change");

        expect(gitpar.apiPost).toHaveBeenCalledWith(
            "/api/branches/remote",
            { branch: "main", remote: "upstream" },
            expect.any(Function),
            expect.any(Function)
        );
        expect(branch.upstream).toBe("upstream/main");
        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
