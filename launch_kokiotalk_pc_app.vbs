Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

userProfile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")
ooyooVbs = userProfile & "\OneDrive\RyuVault\ooyoo-mobile-server\start_ooyoo_hidden.vbs"

' 1. 백그라운드 서버(8081/8082)가 꺼져 있으면 자동 기동
ret = WshShell.Run("cmd.exe /c netstat -ano | findstr "":8081 "" | findstr ""LISTENING""", 0, True)
If ret <> 0 Then
  If fso.FileExists(ooyooVbs) Then
    WshShell.Run "wscript.exe //B """ & ooyooVbs & """", 0, False
    WScript.Sleep 2200
  End If
End If

' 2. 주소창/탭 없는 독립형 카카오톡 PC 앱 모드(--app)로 실행
chromePath1 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
chromePath2 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
edgePath1 = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
edgePath2 = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"

appUrl = "http://localhost:8081/"

If fso.FileExists(chromePath1) Then
  WshShell.Run """" & chromePath1 & """ --app=" & appUrl & " --window-size=1120,800", 1, False
ElseIf fso.FileExists(chromePath2) Then
  WshShell.Run """" & chromePath2 & """ --app=" & appUrl & " --window-size=1120,800", 1, False
ElseIf fso.FileExists(edgePath1) Then
  WshShell.Run """" & edgePath1 & """ --app=" & appUrl & " --window-size=1120,800", 1, False
ElseIf fso.FileExists(edgePath2) Then
  WshShell.Run """" & edgePath2 & """ --app=" & appUrl & " --window-size=1120,800", 1, False
Else
  WshShell.Run appUrl, 1, False
End If
