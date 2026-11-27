// Fallback launcher (no title-bar styling). build.bat only compiles this if launcher.cs fails to compile.
// Compiled by build.bat with the C# compiler that ships with Windows. It does nothing else.
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

static class Launcher
{
    [STAThread]
    static void Main()
    {
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
        ProcessStartInfo psi = new ProcessStartInfo(mshta, "\"" + best + "\"");
        psi.UseShellExecute = false;
        Process.Start(psi);
    }
}
