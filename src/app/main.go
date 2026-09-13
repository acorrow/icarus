package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"github.com/nvsoft/win"
	"github.com/phayes/freeport"
	"github.com/rodolfoag/gow32"
	"github.com/sqweek/dialog"
	"github.com/webview/webview"
	"golang.org/x/sys/windows"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

var dirname = ""
var defaultPort = 3300 // Set to 0 to be assigned a free high numbered port
var port int           // Actual port we are running on
var webViewInstance webview.WebView

// Track main window size when switching to/from fullscreen
var windowWidth = defaultWindowWidth
var windowHeight = defaultWindowHeight
var url = fmt.Sprintf("http://localhost:%d", defaultPort)

type process struct {
	Pid    int
	Handle uintptr
}

var processGroup ProcessGroup

func main() {
	startTime := time.Now()

	_processGroup, err := NewProcessGroup()
	if err != nil {
		panic(err)
	}
	defer _processGroup.Dispose()
	processGroup = _processGroup

	// Set default port to be random high port
	if defaultPort == 0 {
		randomPort, portErr := freeport.GetFreePort()
		if portErr != nil {
			fmt.Println("Error getting port", portErr.Error())
		} else {
			defaultPort = randomPort
		}
	}

	// Parse arguments
	widthPtr := flag.Int("width", int(windowWidth), "Window width")
	heightPtr := flag.Int("height", int(windowHeight), "Window height")
	portPtr := flag.Int("port", defaultPort, "Port service should run on")
	terminalMode := flag.Bool("terminal", false, "Run in terminal only mode")
	installMode := flag.Bool("install", false, "First run after install")
	flag.Parse()

	windowWidth = int32(*widthPtr)
	windowHeight = int32(*heightPtr)
	port = int(*portPtr)
	url = fmt.Sprintf("http://localhost:%d", *portPtr)
	launcherUrl := fmt.Sprintf("http://localhost:%d/launcher", *portPtr)

	pathToExecutable, err := os.Executable()
	if err != nil {
		dialog.Message("%s", "Failed to start ICARUS Terminal Service\n\nUnable to determine current directory.").Title("Error").Error()
		exitApplication(1)
	}
	dirname = filepath.Dir(pathToExecutable)

	// Check if is first run after installing, in which case we restart without
	// elevated privilages to ensure we are not running as the installer, as that
	// causes problems for things like interacting with windows via SteamVR.
	if *installMode {
		runUnelevated(pathToExecutable)
		return
	}

	// Check if we are starting in Terminal mode
	if *terminalMode {
		createWindow(TERMINAL_WINDOW_TITLE, url, defaultWindowWidth, defaultWindowHeight, webview.HintNone)
		return
	}

	// If we get this far, we start in Launcher mode

	// Check not already running
	if checkProcessAlreadyExists(LAUNCHER_WINDOW_TITLE) {
		dialog.Message("%s", "ICARUS Terminal is already running.\n\nYou can only run one instance at a time.").Title("Information").Info()
		exitApplication(1)
	}

	// Check for an update before running main launcher code
	// updateAvailable, _ := CheckForUpdate()
	// if updateAvailable {
	// 	ok := dialog.Message("%s", "A new version of ICARUS Terminal is available.\n\nDo you want to install the update?").Title("New version available").YesNo()
	// 	if ok {
	// 		InstallUpdate()
	// 		return
	// 	}
	// }

	// Use Windows API to get Save Game dir
	saveGameDirPath, err := windows.KnownFolderPath(windows.FOLDERID_SavedGames, 0)

	// Run service
	cmdArg0 := fmt.Sprintf("%s%d", "--port=", *portPtr)
	cmdArg1 := fmt.Sprintf("%s%s", "--save-game-dir=", saveGameDirPath)
	serviceCmdInstance := exec.Command(filepath.Join(dirname, SERVICE_EXECUTABLE), cmdArg0, cmdArg1)
	serviceCmdInstance.Dir = dirname
	serviceCmdInstance.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	serviceCmdErr := serviceCmdInstance.Start()

	// Exit if service fails to start
	if serviceCmdErr != nil {
		fmt.Println("Error starting service", serviceCmdErr.Error())
		dialog.Message("%s%s", "Failed to start ICARUS Terminal Service.\n\n", serviceCmdErr.Error()).Title("Error").Error()
		exitApplication(1)
	}

	// Add service to process group so gets shutdown when main process ends
	processGroup.AddProcess(serviceCmdInstance.Process)

	// Exit if service stops running
	go func() {
		serviceCmdInstance.Wait()
		currentTime := time.Now()
		diff := currentTime.Sub(startTime)

		// If Window is visible, hide it to avoid showing a Window in a broken state
		if webViewInstance != nil {
			hwndPtr := webViewInstance.Window()
			hwnd := win.HWND(hwndPtr)
			win.ShowWindow(hwnd, win.SW_HIDE)
		}

		if diff.Seconds() < 10 {
			// Show alternate dialog message if fails within X seconds of startup
			dialog.Message("%s", "ICARUS Terminal Service failed to start.\n\nAntiVirus or Firewall software may have prevented it from starting or it may be conflicting with another application.").Title("Error").Error()
		} else {
			fmt.Println("Service stopped unexpectedly.")
			dialog.Message("%s", "ICARUS Terminal Service stopped unexpectedly.").Title("Error").Error()
		}
		exitApplication(1)
	}()

	// TODO Only open a window once service is ready
	time.Sleep(0 * time.Second)

	// Open main window (block rest of main until closed)
	createNativeWindow(LAUNCHER_WINDOW_TITLE, launcherUrl, defaultLauncherWindowWidth, defaultLauncherWindowHeight)

	// Ensure we terminate all processes cleanly when window closes
	exitApplication(0)
}

// createWindow() lets the webview library create a managed window for us
func createWindow(LAUNCHER_WINDOW_TITLE string, url string, width int32, height int32, hint webview.Hint) {
	// Passes the pointer to the window as an unsafe reference
	w := webview.New(DEBUGGER)
	defer w.Destroy()

	hwndPtr := w.Window()
	hwnd := win.HWND(hwndPtr)

	// Center window and force it to redraw
	screenWidth := int32(win.GetSystemMetrics(win.SM_CXSCREEN))
	screenHeight := int32(win.GetSystemMetrics(win.SM_CYSCREEN))
	windowX := int32((screenWidth / 2) - (width / 2))
	windowY := int32((screenHeight / 2) - (height / 2))
	win.MoveWindow(hwnd, windowX, windowY, width, height, false)

	// Set window icon
	hIconSm := win.HICON(win.LoadImage(0, syscall.StringToUTF16Ptr(ICON), win.IMAGE_ICON, 32, 32, win.LR_LOADFROMFILE|win.LR_SHARED|win.LR_LOADTRANSPARENT))
	hIcon := win.HICON(win.LoadImage(0, syscall.StringToUTF16Ptr(ICON), win.IMAGE_ICON, 64, 64, win.LR_LOADFROMFILE|win.LR_SHARED|win.LR_LOADTRANSPARENT))
	win.SendMessage(hwnd, win.WM_SETICON, 0, uintptr(hIconSm))
	win.SendMessage(hwnd, win.WM_SETICON, 1, uintptr(hIcon))

	bindFunctionsToWebView(w)

	w.SetTitle(LAUNCHER_WINDOW_TITLE)
	w.SetSize(int(width), int(height), hint)
	w.Navigate(LoadUrl(url))
	w.Run()
}

// createNativeWindow() explicitly creates a native window and passes the handle
// for it to the webview, this allows for greater customisation
func createNativeWindow(LAUNCHER_WINDOW_TITLE string, url string, width int32, height int32) {
	// Instance of this executable
	hInstance := win.GetModuleHandle(nil)
	if hInstance == 0 {
		fmt.Println("GetModuleHandle failed:", win.GetLastError())
	}

	// Register window class
	atom := RegisterClass(hInstance)
	if atom == 0 {
		fmt.Println("RegisterClass failed:", win.GetLastError())
	}

	// Create our own window
	// We do this manually and pass it to webview so that we can set the window
	// location (i.e. centered), style, etc before it is displayed.
	hwndPtr := CreateWin32Window(hInstance, LAUNCHER_WINDOW_TITLE, width, height)
	if hwndPtr == 0 {
		fmt.Println("CreateWin32Window failed:", win.GetLastError())
	}

	// Center window
	hwnd := win.HWND(hwndPtr)
	screenWidth := int32(win.GetSystemMetrics(win.SM_CXSCREEN))
	screenHeight := int32(win.GetSystemMetrics(win.SM_CYSCREEN))
	windowX := int32((screenWidth / 2) - (width / 2))
	windowY := int32((screenHeight / 2) - (height / 2))
	win.MoveWindow(hwnd, windowX, windowY, width, height, false)

	// Pass the pointer to the window as an unsafe reference
	webViewInstance = webview.NewWindow(DEBUGGER, unsafe.Pointer(&hwndPtr))
	defer webViewInstance.Destroy()
	bindFunctionsToWebView(webViewInstance)
	webViewInstance.Navigate(LoadUrl(url))
	webViewInstance.Run()
}

var (
	modUser32             = windows.NewLazySystemDLL("user32.dll")
	procMonitorFromWindow = modUser32.NewProc("MonitorFromWindow")
	procGetMonitorInfoW   = modUser32.NewProc("GetMonitorInfoW")
)

type monitorInfoStruct struct {
	cbSize    uint32
	rcMonitor win.RECT
	rcWork    win.RECT
	dwFlags   uint32
}

func bindFunctionsToWebView(w webview.WebView) {
	hwndPtr := w.Window()
	hwnd := win.HWND(hwndPtr)

	var isFullScreen = false
	var isPinned = false
	var savedWindowRect win.RECT
	var savedWindowStyle int32
	defaultWindowStyle := win.GetWindowLong(hwnd, win.GWL_STYLE)

	w.Bind("icarusTerminal_version", func() string {
		return GetCurrentAppVersion()
	})

	w.Bind("icarusTerminal_checkForUpdate", func() string {
		latestRelease, latestReleaseErr := GetLatestRelease()
		if latestReleaseErr != nil {
			return ""
		}

		response, jsonErr := json.Marshal(latestRelease)
		if jsonErr != nil {
			return ""
		}

		return string(response)
	})

	w.Bind("icarusTerminal_installUpdate", func() {
		InstallUpdate()
	})

	w.Bind("icarusTerminal_isFullScreen", func() bool {
		return isFullScreen
	})

	w.Bind("icarusTerminal_isPinned", func() bool {
		return isPinned
	})

	w.Bind("icarusTerminal_togglePinWindow", func() bool {
		if isFullScreen {
			// Do nothing if in fullscreen mode (option in UI should be disabled)
			return false
		}

		var rc win.RECT
		win.GetWindowRect(hwnd, &rc)

		if isPinned {
			win.SetWindowLong(hwnd, win.GWL_STYLE, defaultWindowStyle)
			win.GetWindowRect(hwnd, &rc)
			currentWindowWidth := rc.Right - rc.Left
			currentWindowHeight := rc.Bottom - rc.Top
			win.SetWindowPos(hwnd, win.HWND_NOTOPMOST, rc.Left, rc.Top, currentWindowWidth, currentWindowHeight, win.SWP_FRAMECHANGED)
			isPinned = false
		} else {
			newWindowStyle := defaultWindowStyle &^ (win.WS_BORDER | win.WS_CAPTION | win.WS_THICKFRAME | win.WS_MINIMIZEBOX | win.WS_MAXIMIZEBOX | win.WS_SYSMENU)
			win.SetWindowLong(hwnd, win.GWL_STYLE, newWindowStyle)
			win.GetWindowRect(hwnd, &rc)
			currentWindowWidth := rc.Right - rc.Left
			currentWindowHeight := rc.Bottom - rc.Top
			win.SetWindowPos(hwnd, win.HWND_TOPMOST, rc.Left, rc.Top, currentWindowWidth, currentWindowHeight, win.SWP_FRAMECHANGED)
			isPinned = true
		}

		return isPinned
	})

	w.Bind("icarusTerminal_toggleFullScreen", func() bool {
		if isFullScreen {
			// Restore default/saved window style and position
			targetStyle := defaultWindowStyle
			if savedWindowStyle != 0 {
				targetStyle = savedWindowStyle
			}
			win.SetWindowLong(hwnd, win.GWL_STYLE, targetStyle)

			if savedWindowRect.Right > savedWindowRect.Left && savedWindowRect.Bottom > savedWindowRect.Top {
				prevWidth := savedWindowRect.Right - savedWindowRect.Left
				prevHeight := savedWindowRect.Bottom - savedWindowRect.Top
				win.SetWindowPos(hwnd, win.HWND_NOTOPMOST, savedWindowRect.Left, savedWindowRect.Top, prevWidth, prevHeight, win.SWP_FRAMECHANGED|win.SWP_SHOWWINDOW)
			} else {
				screenWidth := int32(win.GetSystemMetrics(win.SM_CXSCREEN))
				screenHeight := int32(win.GetSystemMetrics(win.SM_CYSCREEN))
				windowX := int32((screenWidth / 2) - (windowWidth / 2))
				windowY := int32((screenHeight / 2) - (windowHeight / 2))
				win.MoveWindow(hwnd, windowX, windowY, windowWidth, windowHeight, true)
			}
			isFullScreen = false
		} else {
			// Save current rect & style before entering fullscreen
			win.GetWindowRect(hwnd, &savedWindowRect)
			savedWindowStyle = win.GetWindowLong(hwnd, win.GWL_STYLE)

			// Get current monitor info where window is located
			var mi monitorInfoStruct
			mi.cbSize = uint32(unsafe.Sizeof(mi))
			const MONITOR_DEFAULTTONEAREST = 2

			hMonitor, _, _ := procMonitorFromWindow.Call(uintptr(hwnd), uintptr(MONITOR_DEFAULTTONEAREST))
			var monitorRect win.RECT
			gotMonitor := false

			if hMonitor != 0 {
				ret, _, _ := procGetMonitorInfoW.Call(hMonitor, uintptr(unsafe.Pointer(&mi)))
				if ret != 0 {
					monitorRect = mi.rcMonitor
					gotMonitor = true
				}
			}

			if !gotMonitor {
				// Fallback to primary screen
				monitorRect.Left = 0
				monitorRect.Top = 0
				monitorRect.Right = int32(win.GetSystemMetrics(win.SM_CXSCREEN))
				monitorRect.Bottom = int32(win.GetSystemMetrics(win.SM_CYSCREEN))
			}

			// Set borderless fullscreen style
			newWindowStyle := defaultWindowStyle &^ (win.WS_CAPTION | win.WS_THICKFRAME | win.WS_MINIMIZEBOX | win.WS_MAXIMIZEBOX | win.WS_SYSMENU)
			win.SetWindowLong(hwnd, win.GWL_STYLE, newWindowStyle)

			targetX := monitorRect.Left
			targetY := monitorRect.Top
			targetWidth := monitorRect.Right - monitorRect.Left
			targetHeight := monitorRect.Bottom - monitorRect.Top

			win.SetWindowPos(hwnd, win.HWND_TOP, targetX, targetY, targetWidth, targetHeight, win.SWP_FRAMECHANGED|win.SWP_SHOWWINDOW)

			isPinned = false
			isFullScreen = true
		}
		return isFullScreen
	})

	w.Bind("icarusTerminal_newWindow", func() int {
		terminalCmdInstance := exec.Command(filepath.Join(dirname, TERMINAL_EXECUTABLE), "--terminal=true", fmt.Sprintf("--port=%d", port))
		terminalCmdInstance.Dir = dirname
		terminalCmdErr := terminalCmdInstance.Start()

		// Exit if service fails to start
		if terminalCmdErr != nil {
			fmt.Println("Opening new terminal failed", terminalCmdErr.Error())
		}

		// Add process to process group so all windows close when main process ends
		processGroup.AddProcess(terminalCmdInstance.Process)

		go func() {
			terminalCmdInstance.Wait()
			// Code here will execute when window closes
		}()

		return 0
	})

	w.Bind("icarusTerminal_openReleaseNotes", func() {
		runUnelevated(RELEASE_NOTES_URL)
	})

	w.Bind("icarusTerminal_openTerminalInBrowser", func() {
		runUnelevated(url)
	})

	// FIXME Broken and sometimes causes crashes on child Windows. Don't know why.
	// To replicate, open a new window (A), then a second window (B), then close
	// A using this method then try and close B using this method. B will stop
	// responding and if repeatedly triggered will crash the entire app.
	// I have tried multiple approaches to resolve this but I think it's a bug
	// in the webview library this app imports.
	/*
		w.Bind("icarusTerminal_closeWindow", func() int {
			w.Terminate()
			return 0
		})
	*/

	w.Bind("icarusTerminal_quit", func() int {
		exitApplication(0)
		return 0
	})
}

func exitApplication(exitCode int) {
	// Placeholder for future logic
	os.Exit(exitCode)
}

func checkProcessAlreadyExists(windowTitle string) bool {
	_, err := gow32.CreateMutex(windowTitle)
	if err != nil {
		return true
	}

	return false
}
