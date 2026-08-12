// Native macOS desktop wrapper for TestSimulator.
// Shows the dashboard in its own window (WKWebView), starts the Node server as
// a child process on launch and stops it on quit. __WORKDIR__ is replaced by
// the installer with the absolute project path.
import Cocoa
import WebKit

let WORKDIR = "__WORKDIR__"
let appURL = URL(string: "http://localhost:3000/")!
let healthURL = URL(string: "http://localhost:3000/api/health")!

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var nodeProcess: Process?
    var startedServer = false
    var quitting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenu()
        setupWindow()
        checkHealth { up in
            if up {
                // A server is already running; attach without spawning a child.
                self.loadApp()
            } else {
                self.startServer()
                self.waitForServer()
            }
        }
    }

    func setupMenu() {
        let mainMenu = NSMenu()

        // Application menu
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Recargar", action: #selector(reload), keyEquivalent: "r")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Salir de TestSimulator",
                        action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        // Edit menu so Cmd+C/V/X/A/Z work inside the web view's fields
        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Editar")
        editMenu.addItem(withTitle: "Deshacer", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Rehacer", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cortar", action: Selector(("cut:")), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copiar", action: Selector(("copy:")), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Pegar", action: Selector(("paste:")), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Seleccionar todo", action: Selector(("selectAll:")), keyEquivalent: "a")
        editItem.submenu = editMenu

        NSApp.mainMenu = mainMenu
    }

    @objc func reload() { webView.reload() }

    // --- WKUIDelegate: make window.alert / confirm / prompt work ---
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancelar")
        alert.beginSheetModal(for: window) { resp in
            completionHandler(resp == .alertFirstButtonReturn)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        completionHandler(defaultText)
    }

    func setupWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1120, height: 740)
        window = NSWindow(contentRect: rect,
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "TestSimulator"
        window.center()
        window.setFrameAutosaveName("TestSimulatorMainWindow")

        webView = WKWebView(frame: rect, configuration: WKWebViewConfiguration())
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]
        window.contentView = webView

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        showLoading()
    }

    func showLoading() {
        let html = """
        <html><body style='background:#0f1226;color:#9aa0c7;font-family:-apple-system;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>
        <div style='text-align:center'><div style='font-size:34px'>🛰️</div>
        <div style='margin-top:10px'>Iniciando TestSimulator…</div></div></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    func startServer() {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // Login shell so `node` is on PATH even when launched from the Dock.
        p.arguments = ["-lc", "cd '\(WORKDIR)' && exec node dist/index.js"]

        let logPath = (NSHomeDirectory() as NSString)
            .appendingPathComponent("Library/Logs/TestSimulator.log")
        if !FileManager.default.fileExists(atPath: logPath) {
            FileManager.default.createFile(atPath: logPath, contents: nil)
        }
        if let fh = FileHandle(forWritingAtPath: logPath) {
            fh.seekToEndOfFile()
            p.standardOutput = fh
            p.standardError = fh
        }
        // If the server dies while the app is open (e.g. it was killed), bring
        // it back so the dashboard never ends up talking to a dead backend.
        p.terminationHandler = { [weak self] _ in
            guard let self = self else { return }
            DispatchQueue.main.async {
                if self.quitting { return }
                NSLog("TestSimulator: server exited unexpectedly, restarting...")
                self.startServer()
                self.showLoading()
                self.waitForServer()
            }
        }
        do {
            try p.run()
            nodeProcess = p
            startedServer = true
        } catch {
            NSLog("TestSimulator: failed to start server: \(error)")
        }
    }

    func checkHealth(_ completion: @escaping (Bool) -> Void) {
        var req = URLRequest(url: healthURL)
        req.timeoutInterval = 1.0
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            let ok = (resp as? HTTPURLResponse)?.statusCode == 200
            DispatchQueue.main.async { completion(ok) }
        }.resume()
    }

    func waitForServer(attempt: Int = 0) {
        if attempt > 60 { loadApp(); return }
        checkHealth { up in
            if up {
                self.loadApp()
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    self.waitForServer(attempt: attempt + 1)
                }
            }
        }
    }

    func loadApp() {
        webView.load(URLRequest(url: appURL))
    }

    // Quit the app (and stop the server) when the window is closed.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    // Re-show the window if the Dock icon is clicked again.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { window.makeKeyAndOrderFront(nil) }
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        quitting = true
        guard startedServer, let p = nodeProcess, p.isRunning else { return }
        p.terminate() // SIGTERM -> graceful shutdown in the Node process
        let deadline = Date().addingTimeInterval(3)
        while p.isRunning && Date() < deadline { usleep(100_000) }
        if p.isRunning { kill(p.processIdentifier, SIGKILL) } // last resort
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
