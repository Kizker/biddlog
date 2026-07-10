Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c C:\laragon\www\biddlog\scripts\start-vite.cmd > C:\laragon\www\biddlog\vite-start.log 2>&1", 0, False
