// Desktop shell for GitPar: spawns the PyInstaller-frozen server
// (packaging/pyinstaller/gitpar.spec output, declared as a Tauri
// "sidecar" in tauri.conf.json) as a child process, waits for its
// loopback port to accept connections, then points the main window at
// it. The sidecar is killed when the window closes.
//
// This file is authored but NOT built/verified in this environment -
// there is no Rust/Cargo toolchain available here. See
// packaging/README.md for how to build and smoke-test it for real.

use std::net::TcpStream;
use std::sync::Mutex;
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct SidecarHandle(Mutex<Option<CommandChild>>);

fn pick_free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .expect("failed to bind an ephemeral port to pick one for the sidecar")
        .local_addr()
        .expect("failed to read the ephemeral port we just bound")
        .port()
}

fn wait_for_port(port: u16, attempts: u32, delay: Duration) -> bool {
    for _ in 0..attempts {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            // Give the HTTP server a brief moment to finish its own
            // startup after the socket accepts connections.
            std::thread::sleep(Duration::from_millis(150));
            return true;
        }
        std::thread::sleep(delay);
    }
    false
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let port = pick_free_port();
            let repo_root = std::env::var("GITPAR_REPO_ROOT").unwrap_or_else(|_| {
                std::env::current_dir()
                    .expect("failed to read the current directory")
                    .to_string_lossy()
                    .into_owned()
            });

            let shell = app.shell();
            let sidecar = shell
                .sidecar("gitpar-server")
                .expect(
                    "gitpar-server sidecar binary not found - build it with \
                     packaging/pyinstaller/gitpar.spec and place it under \
                     src-tauri/binaries/ (see packaging/README.md)",
                )
                .args([
                    "--no-browser",
                    "--port",
                    &port.to_string(),
                    "--repo-root",
                    &repo_root,
                ]);

            let (mut events, child) = sidecar.spawn().expect("failed to spawn the gitpar-server sidecar");
            app.manage(SidecarHandle(Mutex::new(Some(child))));

            // Forward the sidecar's own stdout/stderr into this
            // process's logs, and quit if it dies unexpectedly.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            print!("[gitpar-server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprint!("[gitpar-server] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("gitpar-server exited unexpectedly: {:?}", payload);
                            app_handle.exit(1);
                        }
                        _ => {}
                    }
                }
            });

            // Poll the sidecar's port on a background thread, then hand
            // the real URL to the (currently placeholder) main window.
            let window = app
                .get_webview_window("main")
                .expect("main window declared in tauri.conf.json not found");
            std::thread::spawn(move || {
                if wait_for_port(port, 100, Duration::from_millis(100)) {
                    let url = format!("http://127.0.0.1:{}/", port);
                    let script = format!("window.location.replace('{}')", url);
                    let _ = window.eval(&script);
                } else {
                    eprintln!("gitpar-server did not become ready within 10s");
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.try_state::<SidecarHandle>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the GitPar desktop app");
}
