!macro customInstall
  ExecWait 'schtasks /Create /TN "VR Radar Lite Daily Refresh" /TR "\"$INSTDIR\VR Radar Lite.exe\" --refresh-only" /SC DAILY /ST 09:00 /F'
!macroend

!macro customUnInstall
  ExecWait 'schtasks /Delete /TN "VR Radar Lite Daily Refresh" /F'
!macroend
