// Launcher: opens the newest CoD-Configurator*.hta next to this exe with Windows' own HTA host (mshta.exe),
// then gives the app window a dark title bar that matches the app (instead of the plain white Windows one).
//   CoD-Configurator.exe              start the app
//   CoD-Configurator.exe --titlebar   only restyle an app window that is already open (the app calls this itself)
// Compiled by build.bat with the C# compiler that ships with Windows (C# 5 / .NET 4). Nothing is installed.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

static class Launcher
{
    delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    const string HostClass = "HTML Application Host Window Class";
    const string AppTitle = "CoD Configurator";

    // Window colours, as 0x00BBGGRR. Same as the app: sidebar #0b0d11, text #e8ebf0, border #1a1e25.
    const int CaptionColor = 0x00110D0B;
    const int TextColor = 0x00F0EBE8;
    const int BorderColor = 0x00251E1A;

    [STAThread]
    static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--titlebar")
        {
            StyleWhenReady(0, 4000);
            return;
        }

        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string best = null;
        DateTime bestTime = DateTime.MinValue;
        foreach (string f in Directory.GetFiles(dir, "CoD-Configurator*.hta"))
        {
            DateTime t = File.GetLastWriteTime(f);
            if (best == null || t > bestTime) { best = f; bestTime = t; }
        }
        if (best == null)
        {
            MessageBox.Show("CoD-Configurator.hta was not found next to this program.\n\nRun build.bat again, or keep both files in the same folder.", "CoD Configurator");
            return;
        }
        string mshta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "mshta.exe");
        if (!File.Exists(mshta))
        {
            MessageBox.Show("Windows' built-in HTA host (mshta.exe) is missing on this PC, so the app cannot start.", "CoD Configurator");
            return;
        }
        // "--styled" tells the app this launcher already handles the title bar
        ProcessStartInfo psi = new ProcessStartInfo(mshta, "\"" + best + "\" --styled");
        psi.UseShellExecute = false;
        Process p = Process.Start(psi);
        try { StyleWhenReady((uint)p.Id, 15000); } catch (Exception) { }
    }

    // Waits for the app window (checking every 10 ms, so it is styled before or right as it appears), then styles it.
    static void StyleWhenReady(uint pid, int timeoutMs)
    {
        Stopwatch sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            List<IntPtr> found = FindAppWindows(pid);
            if (found.Count > 0)
            {
                foreach (IntPtr h in found) Style(h);
                // style once more a moment later in case the window was re-created while loading
                Thread.Sleep(400);
                foreach (IntPtr h in FindAppWindows(pid)) Style(h);
                return;
            }
            Thread.Sleep(10);
        }
    }

    // pid > 0: every HTA window of that process. pid == 0: every HTA window titled "CoD Configurator".
    static List<IntPtr> FindAppWindows(uint pid)
    {
        List<IntPtr> list = new List<IntPtr>();
        EnumWindows(delegate (IntPtr hwnd, IntPtr lParam)
        {
            StringBuilder cls = new StringBuilder(256);
            GetClassName(hwnd, cls, cls.Capacity);
            if (cls.ToString() != HostClass) return true;
            if (pid != 0)
            {
                uint owner;
                GetWindowThreadProcessId(hwnd, out owner);
                if (owner == pid) list.Add(hwnd);
            }
            else
            {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(hwnd, title, title.Capacity);
                if (title.ToString().StartsWith(AppTitle)) list.Add(hwnd);
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    static void Style(IntPtr hwnd)
    {
        int on = 1;
        // Dark title bar: attribute 20 on Windows 10 20H1+ and Windows 11, 19 on older Windows 10 builds.
        if (DwmSetWindowAttribute(hwnd, 20, ref on, 4) != 0) DwmSetWindowAttribute(hwnd, 19, ref on, 4);
        // Windows 11 only (ignored elsewhere): exact caption, caption text and border colours.
        int caption = CaptionColor, text = TextColor, border = BorderColor;
        DwmSetWindowAttribute(hwnd, 35, ref caption, 4);
        DwmSetWindowAttribute(hwnd, 36, ref text, 4);
        DwmSetWindowAttribute(hwnd, 34, ref border, 4);
        // redraw the frame so the change shows immediately
        const uint SWP_NOSIZE = 0x0001, SWP_NOMOVE = 0x0002, SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010, SWP_FRAMECHANGED = 0x0020;
        SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
    }
}
