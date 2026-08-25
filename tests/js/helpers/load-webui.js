const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { JSDOM } = require("jsdom");

const SOURCE_PATH = path.join(__dirname, "../../../src/share/git-webui/webui/js/git-webui.js");

// Loads git-webui.js in an isolated vm context backed by its own fresh JSDOM
// window (not jest's global jsdom window, to avoid a jQuery/jsdom interop quirk
// where jQuery's factory resolves to a plain object instead of a callable),
// with the trailing `$(document).ready(() => new MainUi())` bootstrap stripped
// out so requiring the module doesn't try to hit the network.
function loadWebui() {
    let source = fs.readFileSync(SOURCE_PATH, "utf8");
    source = source.replace(/\$\(document\)\.ready\([\s\S]*?\}\);\s*$/, "");

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost/",
    });
    const win = dom.window;
    const $ = require("jquery")(win);
    win.$ = $;
    win.jQuery = $;

    const sandbox = {
        window: win,
        document: win.document,
        navigator: win.navigator,
        $,
        jQuery: $,
        sessionStorage: win.sessionStorage,
        localStorage: win.localStorage,
        console,
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: SOURCE_PATH });
    // Test-only handles so specs can assert on/reset storage and DOM state
    // without depending on Jest's own (unrelated) global environment.
    sandbox.webui.__testLocalStorage = win.localStorage;
    sandbox.webui.__testJQuery = $;
    sandbox.webui.__testDocument = win.document;
    return sandbox.webui;
}

module.exports = { loadWebui };
