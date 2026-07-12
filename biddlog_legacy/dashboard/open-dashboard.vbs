Option Explicit

Dim shell, fso, root, nodePath, vitePath, launchCmd

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
nodePath = "C:\laragon\bin\nodejs\node-v20.19.3-win-x64\node.exe"
vitePath = root & "\node_modules\vite\bin\vite.js"

If Not fso.FileExists(nodePath) Then
  MsgBox "Node.exe tidak ditemukan: " & nodePath, vbCritical, "Open Dashboard"
  WScript.Quit 1
End If

If Not fso.FileExists(vitePath) Then
  MsgBox "Vite tidak ditemukan: " & vitePath, vbCritical, "Open Dashboard"
  WScript.Quit 1
End If

launchCmd = """" & nodePath & """ """ & vitePath & """ --host 127.0.0.1 --port 5173"
shell.Run "cmd /c " & Chr(34) & launchCmd & Chr(34), 0, False
WScript.Sleep 2000
shell.Run "http://127.0.0.1:5173", 1, False
