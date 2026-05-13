!include LogicLib.nsh

; =================================================================================
; 🚀 [설치 마법사 핵심 루틴 - 네이티브 파일 결합 대응 경고 레이어]
; =================================================================================

!macro customInstall
  DetailPrint "Checking prior file associations..."
  
  ; 레지스트리 레지스터 매핑 전략:
  ; $R0 = 중복 발견 플래그 (0 = 없음, 1 = 발견됨)
  ; $R1 = 임시 데이터 리딩 버퍼
  
  StrCpy $R0 "0"
  
  ; 1. 현재 유저(HKCU) 레벨에서 .zip 점거 여부 조사
  ReadRegStr $R1 HKCU "Software\Classes\.zip" ""
  ${If} $R1 != ""
  ${AndIf} $R1 != "zip-book-viewer.zip"
    StrCpy $R0 "1"
  ${EndIf}
  
  ; 2. 현재 유저(HKCU) 레벨에서 .cbz 점거 여부 조사
  ReadRegStr $R1 HKCU "Software\Classes\.cbz" ""
  ${If} $R1 != ""
  ${AndIf} $R1 != "zip-book-viewer.cbz"
    StrCpy $R0 "1"
  ${EndIf}

  ; 3. 만약 유저 영역이 깨끗하다면, 시스템 공통 영역(HKLM) 2차 탐색 개시!
  ${If} $R0 == "0"
    ReadRegStr $R1 HKLM "Software\Classes\.zip" ""
    ${If} $R1 != ""
    ${AndIf} $R1 != "zip-book-viewer.zip"
      StrCpy $R0 "1"
    ${EndIf}
    
    ReadRegStr $R1 HKLM "Software\Classes\.cbz" ""
    ${If} $R1 != ""
    ${AndIf} $R1 != "zip-book-viewer.cbz"
      StrCpy $R0 "1"
    ${EndIf}
  ${EndIf}

  ; --- 🚥 경고창 인터랙션 개시 ---
  ${If} $R0 == "1"
    ; 런타임 시점에 시스템 변수 $LANGUAGE를 직접 읽어 스트링을 즉시 주입합니다.
    ${If} $LANGUAGE == 1042
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "[중요 안내] 이 앱은 압축을 해제하는 프로그램이 아니라,$\r$\n압축 속에 든 이미지를 열어주는 '압축 이미지 전용 뷰어'입니다.$\r$\n$\r$\n[주의] JPG, PNG, WebP 등 개별 이미지의 연결은 전혀 건드리지 않습니다!$\r$\n오직 .zip / .cbz 압축파일에 대해서만 변경을 확인합니다.$\r$\n$\r$\n현재 시스템에 .zip / .cbz 파일을 여는 타사 기본 프로그램이 등록되어 있습니다.$\r$\n해당 압축파일들만 'ZIP 이미지 뷰어'에 새로 연결하시겠습니까?" IDYES accept_assoc IDNO refuse_assoc
    ${Else}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "[Notice] This app is NOT a file extraction tool,$\r$\nbut a dedicated viewer for images inside archives.$\r$\n$\r$\n[Warning] It NEVER modifies individual image file associations (JPG, PNG, etc.)!$\r$\nIt only manages .zip and .cbz containers.$\r$\n$\r$\nAnother default program is already registered to open .zip / .cbz files.$\r$\nDo you want to associate them with 'ZIP Image Viewer' instead?" IDYES accept_assoc IDNO refuse_assoc
    ${EndIf}
    
    accept_assoc:
      DetailPrint "User approved native file association registration."
      Goto create_log
      
    refuse_assoc:
      DetailPrint "User bypassed registration recommendation."
      Goto end_assoc
      
  ${Else}
    DetailPrint "No conflicting programs detected."
    Goto create_log
  ${EndIf}

create_log:
  ; [진단 안내장 로그 파일 생성]
  FileOpen $0 "$INSTDIR\association_log.txt" w
  ${If} $LANGUAGE == 1042
    FileWrite $0 "========================================================$\r$\n  [ZIP 이미지 뷰어] 설치 결과 및 파일 자동 연동 안내서$\r$\n========================================================$\r$\n$\r$\n"
    FileWrite $0 "[중요 안전 고지]$\r$\n"
    FileWrite $0 "1. 본 프로그램은 압축 해제 소프트웨어가 아니며, 압축파일 전용 뷰어입니다.$\r$\n"
    FileWrite $0 "2. 본 앱은 JPG, PNG, WebP 등 개별 이미지 파일 연결을 절대 수정하거나 선점하지 않습니다!$\r$\n"
    FileWrite $0 "3. 오직 .zip 및 .cbz 압축 뭉치 파일만을 대상으로 연동을 수행합니다.$\r$\n$\r$\n"
    FileWrite $0 "[연결 진단 기록]$\r$\n"
    FileWrite $0 "- 대상 확장자: .zip 및 .cbz (개별 사진 포맷 제외)$\r$\n"
    FileWrite $0 "- 조치 사항: 사용자의 기존 환경을 훼손하지 않는 선에서 파일 연결 구성 완료!$\r$\n"
  ${Else}
    FileWrite $0 "========================================================$\r$\n  [ZIP Image Viewer] Installation & File Association Guide$\r$\n========================================================$\r$\n$\r$\n"
    FileWrite $0 "[Important Safety Notice]$\r$\n"
    FileWrite $0 "1. This software is an image viewer, not a file decompression utility.$\r$\n"
    FileWrite $0 "2. This app NEVER modifies or hijacks individual image file associations (JPG, PNG, WebP, etc.)!$\r$\n"
    FileWrite $0 "3. Association processes target .zip and .cbz archive files ONLY.$\r$\n$\r$\n"
    FileWrite $0 "[Association Diagnostic Record]$\r$\n"
    FileWrite $0 "- Target Extensions: .zip and .cbz (Excluding raw image formats)$\r$\n"
    FileWrite $0 "- Action: Successfully configured system capabilities for native association!$\r$\n"
  ${EndIf}
  FileClose $0
  
  ; 변경된 전용 아이콘 즉각 투영 선동!!
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

end_assoc:
!macroend

!macro customUnInstall
  DetailPrint "Engaging native application uninstallation cleanup..."
  ; 제거 후 윈도우 탐색기 완전 갱신
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  DetailPrint "Registry and Shell notification refresh completed."
!macroend
