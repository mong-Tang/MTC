!include LogicLib.nsh

; =================================================================================
; 🌐 [글로벌 다국어 사전] 글로벌 스탠다드 대응 영어(1033) 및 한국어(1042) 언어팩 정의
; =================================================================================

; 1️⃣ [대화상자 경고문] MessageBox Text (시각적 황금 비율 유지를 위한 수동 개행 튜닝)
LangString ConflictMsg ${LANG_ENGLISH} "[Notice] This app is NOT a file extraction tool,$\r$\nbut a dedicated viewer for images inside archives.$\r$\n$\r$\n[Warning] It NEVER modifies individual image file associations (JPG, PNG, etc.)!$\r$\nIt only manages .zip and .cbz containers.$\r$\n$\r$\nAnother default program is already registered to open .zip / .cbz files.$\r$\nDo you want to associate them with 'ZIP Image Viewer' instead?"
LangString ConflictMsg ${LANG_KOREAN} "[중요 안내] 이 앱은 압축을 해제하는 프로그램이 아니라,$\r$\n압축 속에 든 이미지를 열어주는 '압축 이미지 전용 뷰어'입니다.$\r$\n$\r$\n[주의] JPG, PNG, WebP 등 개별 이미지의 연결은 전혀 건드리지 않습니다!$\r$\n오직 .zip / .cbz 압축파일에 대해서만 변경을 확인합니다.$\r$\n$\r$\n현재 시스템에 .zip / .cbz 파일을 여는 타사 기본 프로그램이 등록되어 있습니다.$\r$\n해당 압축파일들만 'ZIP 이미지 뷰어'에 새로 연결하시겠습니까?"

; 2️⃣ [로그 헤더] Log File Header
LangString LogHeader ${LANG_ENGLISH} "========================================================$\r$\n  [ZIP Image Viewer] Installation & File Association Guide$\r$\n========================================================$\r$\n$\r$\n"
LangString LogHeader ${LANG_KOREAN} "========================================================$\r$\n  [ZIP 이미지 뷰어] 설치 결과 및 파일 자동 연동 안내서$\r$\n========================================================$\r$\n$\r$\n"

; 3️⃣ [중요 안전 고지 타이틀] Safety Notice Title
LangString LogNoticeTitle ${LANG_ENGLISH} "[Important Safety Notice]$\r$\n"
LangString LogNoticeTitle ${LANG_KOREAN} "[중요 안전 고지]$\r$\n"

; 4️⃣ [안전 고지 1번 항] Safety Clause 1
LangString LogNotice1 ${LANG_ENGLISH} "1. This software is an image viewer, not a file decompression utility.$\r$\n"
LangString LogNotice1 ${LANG_KOREAN} "1. 본 프로그램은 압축 해제 소프트웨어가 아니며, 압축파일 전용 뷰어입니다.$\r$\n"

; 5️⃣ [안전 고지 2번 항] Safety Clause 2
LangString LogNotice2 ${LANG_ENGLISH} "2. This app NEVER modifies or hijacks individual image file associations (JPG, PNG, WebP, etc.)!$\r$\n"
LangString LogNotice2 ${LANG_KOREAN} "2. 본 앱은 JPG, PNG, WebP 등 개별 이미지 파일 연결을 절대 수정하거나 선점하지 않습니다!$\r$\n"

; 6️⃣ [안전 고지 3번 항] Safety Clause 3
LangString LogNotice3 ${LANG_ENGLISH} "3. Association processes target .zip and .cbz archive files ONLY.$\r$\n$\r$\n"
LangString LogNotice3 ${LANG_KOREAN} "3. 오직 .zip 및 .cbz 압축 뭉치 파일만을 대상으로 연동을 수행합니다.$\r$\n$\r$\n"

; 7️⃣ [진단 기록 타이틀] Diagnosis Title
LangString LogDiagTitle ${LANG_ENGLISH} "[Association Diagnostic Record]$\r$\n"
LangString LogDiagTitle ${LANG_KOREAN} "[연결 진단 기록]$\r$\n"

; 8️⃣ [대상 확장자 고지] Target Extensions
LangString LogDiagExt ${LANG_ENGLISH} "- Target Extensions: .zip and .cbz (Excluding raw image formats)$\r$\n"
LangString LogDiagExt ${LANG_KOREAN} "- 대상 확장자: .zip 및 .cbz (개별 사진 포맷 제외)$\r$\n"

; 9️⃣ [진단 결과] Diagnostic Result
LangString LogDiagResult ${LANG_ENGLISH} "- Result: No conflicting third-party default program was found (Empty slot).$\r$\n"
LangString LogDiagResult ${LANG_KOREAN} "- 진단 결과: 충돌하거나 선점 중인 타사 기본 프로그램이 탐색되지 않음 (공석)$\r$\n"

; 🔟 [최종 조치] Action Taken
LangString LogDiagAction ${LANG_ENGLISH} "- Action: Successfully auto-associated archive extensions without disrupting your current setup!$\r$\n"
LangString LogDiagAction ${LANG_KOREAN} "- 조치 사항: 사용자의 기존 환경을 훼손하지 않는 선에서 압축파일만 자동 연결 완료!$\r$\n"


; =================================================================================
; 🚀 [설치 마법사 핵심 루틴] 
; =================================================================================

!macro customInstall
  DetailPrint "Checking prior file associations..."
  
  ; 레지스트리 레지스터 매핑 전략:
  ; $R0 = 중복 발견 플래그 (0 = 없음, 1 = 발견됨)
  ; $R1 = 임시 데이터 리딩 버퍼
  
  StrCpy $R0 "0"
  
  ; 🔍 1. 현재 유저(HKCU) 레벨에서 .zip 점거 여부 조사
  ReadRegStr $R1 HKCU "Software\Classes\.zip" ""
  ${If} $R1 != ""
  ${AndIf} $R1 != "com.mongtang.zipbookviewer.zip"
    StrCpy $R0 "1"
  ${EndIf}
  
  ; 🔍 2. 현재 유저(HKCU) 레벨에서 .cbz 점거 여부 조사
  ReadRegStr $R1 HKCU "Software\Classes\.cbz" ""
  ${If} $R1 != ""
  ${AndIf} $R1 != "com.mongtang.zipbookviewer.cbz"
    StrCpy $R0 "1"
  ${EndIf}

  ; 🔍 3. 만약 유저 영역이 깨끗하다면, 시스템 공통 영역(HKLM) 2차 탐색 개시!
  ${If} $R0 == "0"
    ReadRegStr $R1 HKLM "Software\Classes\.zip" ""
    ${If} $R1 != ""
    ${AndIf} $R1 != "com.mongtang.zipbookviewer.zip"
      StrCpy $R0 "1"
    ${EndIf}
    
    ReadRegStr $R1 HKLM "Software\Classes\.cbz" ""
    ${If} $R1 != ""
    ${AndIf} $R1 != "com.mongtang.zipbookviewer.cbz"
      StrCpy $R0 "1"
    ${EndIf}
  ${EndIf}

  ; --- 🚥 분기 운용 개시 ---
  ${If} $R0 == "1"
    ; 🎭 [A분기: 충돌 감지] 🌐 다국어 사전을 렌더링하여 언어권별 메시지 자동 투사!
    ; MB_DEFBUTTON2 플래그 장착으로 '아니요'가 기본 포커스되어 실수 방어.
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(ConflictMsg)" IDYES do_install_assoc IDNO skip_install_assoc
    
    do_install_assoc:
      Goto perform_registry_writes
      
    skip_install_assoc:
      DetailPrint "File association bypassed due to user refusal."
      Goto end_assoc
      
  ${Else}
    ; 🎭 [B분기: 공석 감지] 🌐 생성되는 텍스트 안내장도 완벽한 다국어 버전으로 자동 타각!
    DetailPrint "No conflicting programs detected. Engaging auto-association."
    
    FileOpen $0 "$INSTDIR\association_log.txt" w
    FileWrite $0 "$(LogHeader)"
    FileWrite $0 "$(LogNoticeTitle)"
    FileWrite $0 "$(LogNotice1)"
    FileWrite $0 "$(LogNotice2)"
    FileWrite $0 "$(LogNotice3)"
    FileWrite $0 "$(LogDiagTitle)"
    FileWrite $0 "$(LogDiagExt)"
    FileWrite $0 "$(LogDiagResult)"
    FileWrite $0 "$(LogDiagAction)"
    FileClose $0
    
    Goto perform_registry_writes
  ${EndIf}

perform_registry_writes:
  DetailPrint "Deploying file association registry entries..."

  ; 📦 .zip 확장자 연결 구조 조각
  WriteRegStr SHCTX "Software\Classes\.zip" "" "com.mongtang.zipbookviewer.zip"
  WriteRegStr SHCTX "Software\Classes\com.mongtang.zipbookviewer.zip" "" "ZIP Archive Book"
  WriteRegStr SHCTX "Software\Classes\com.mongtang.zipbookviewer.zip\DefaultIcon" "" "$INSTDIR\resources\data-file-icon.ico"
  WriteRegStr SHCTX "Software\Classes\com.mongtang.zipbookviewer.zip\shell\open\command" "" '"$INSTDIR\ZIP 이미지 뷰어.exe" "%1"'

  ; 📦 .cbz 확장자 연결 구조 조각
  WriteRegStr SHCTX "Software\Classes\.cbz" "" "com.mongtang.zipbookviewer.cbz"
  WriteRegStr SHCTX "Software\Classes\com.mongtang.zipbookviewer.cbz" "" "Comic Book Archive"
  WriteRegStr SHCTX "Software\Classes\com.mongtang.zipbookviewer.cbz\DefaultIcon" "" "$INSTDIR\resources\data-file-icon.ico"
  WriteRegStr SHCTX "Software\Classes\com.mongtang.zipbookviewer.cbz\shell\open\command" "" '"$INSTDIR\ZIP 이미지 뷰어.exe" "%1"'

  ; 📡 변경된 전용 아이콘이 윈도우 탐색기에 즉각 투영되도록 쉘 갱신 선동!!
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  DetailPrint "File associations fully operational."
  
end_assoc:
!macroend

!macro customUnInstall
  DetailPrint "Beginning uninstallation purge of registry file associations..."
  
  ; 🧹 당사 앱을 아직 가리키고 있는 경우에만 안전하게 꼬리표 해소!
  ReadRegStr $R1 SHCTX "Software\Classes\.zip" ""
  ${If} $R1 == "com.mongtang.zipbookviewer.zip"
    DeleteRegValue SHCTX "Software\Classes\.zip" ""
  ${EndIf}
  
  ReadRegStr $R1 SHCTX "Software\Classes\.cbz" ""
  ${If} $R1 == "com.mongtang.zipbookviewer.cbz"
    DeleteRegValue SHCTX "Software\Classes\.cbz" ""
  ${EndIf}
  
  ; 당사 고유 고정키 파괴
  DeleteRegKey SHCTX "Software\Classes\com.mongtang.zipbookviewer.zip"
  DeleteRegKey SHCTX "Software\Classes\com.mongtang.zipbookviewer.cbz"
  
  ; 제거 후 윈도우 탐색기 완전 갱신
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  DetailPrint "Registry cleanup finished successfully."
!macroend
