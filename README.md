[한국어](README.md) · [English](docs/README.en.md) · [日本語](docs/README.ja.md)

# IMPERIUM

<img src="build/icon-preview.png" width="96" alt="IMPERIUM terminal icon">

라틴어로 통솔권·지휘권을 뜻하는 **IMPERIUM**은 사용자가 본부장이 되어 Codex와 Claude Code에 부서별 업무를 지시하는 로컬 AI 운영 터미널입니다. 블룸버그 터미널을 떠올리는 화면에서 작업 대기열, 실행 상태, 도구 이벤트와 결과를 확인합니다.

v1.1은 로컬 웹 서버를 데스크톱 창이나 브라우저에서 사용하는 프로그램입니다. 여기서 시작한 작업을 추적하며, 기존 ChatGPT·Claude 앱의 대화나 다른 터미널의 세션을 관찰하지는 않습니다.

## 데스크톱 실행

Windows에서는 설치 마법사가 포함된 **`Imperium-Setup-1.1.0-x64.exe`**를 권장합니다.

1. 설치 파일을 실행하고 **다음(Next) → 설치(Install) → 마침(Finish)** 순서로 진행합니다. 설치 폴더를 변경할 수 있으며 현재 Windows 사용자용으로 설치됩니다.
2. 바탕 화면이나 시작 메뉴의 **IMPERIUM** 바로가기로 앱을 엽니다.
3. 제거할 때는 Windows 설정의 앱 목록에서 **IMPERIUM**을 선택합니다.

설치 없이 실행하려면 포터블 파일 `Imperium-1.1.0-win-x64.exe`를 사용하세요. 두 방식 모두 자체 창에서 열리며, 모델 연결에는 아래의 Codex·Claude Code 설치 및 구독 로그인이 필요합니다.

GitHub에 이 앱을 게시한 경우 Actions의 **Build Imperium desktop** 워크플로를 실행하고, 성공한 실행의 **Artifacts**에서 운영체제에 맞는 파일을 받으세요. Windows는 `imperium-windows-x64`, macOS는 `imperium-macos-intel-apple-silicon`, Linux는 `imperium-linux-x64`입니다. macOS용 DMG·ZIP은 macOS 러너의 빌드가 성공한 뒤 받을 수 있습니다. Apple Silicon 파일명은 `Imperium-1.1.0-mac-arm64.dmg`·`.zip`, Intel 파일명은 `Imperium-1.1.0-mac-x64.dmg`·`.zip`입니다.

제작자 메타데이터의 이름은 **Sato Junichiro**입니다. 이 이름을 넣는 것만으로 Windows가 게시자를 인증하지는 않습니다. 실제 Authenticode 인증서를 제공해 서명하기 전까지는 코드 서명이 없는 개발용 빌드이며, Windows에 확인되지 않은 게시자로 표시될 수 있습니다. Windows의 보안 안내에서는 출처를 확인한 앱만 개별 실행하세요. macOS에서 차단되면 시스템 설정의 개인정보 보호 및 보안에서 해당 앱에 한해 열기를 허용할 수 있습니다. 운영체제 전체의 보안 설정을 끌 필요는 없습니다.

데스크톱 앱의 기록은 운영체제별 앱 데이터 위치의 `hq-data/`에 저장됩니다. 기본 작업 폴더는 문서 폴더의 `Imperium Workspace`이며 설정에서 변경할 수 있습니다.

## Linux 설치

Linux x64용으로 Debian·Ubuntu에서 설치할 수 있는 `Imperium-1.1.0-linux-x64.deb`와 직접 실행하는 `Imperium-1.1.0-linux-x64.AppImage`를 제공합니다. 다운로드한 파일의 폴더에서 필요한 명령을 실행하세요.

Debian·Ubuntu에 설치하려면:

```sh
sudo apt install ./Imperium-1.1.0-linux-x64.deb
```

설치 후 앱 메뉴의 **IMPERIUM** 항목으로 실행할 수 있습니다. AppImage를 사용하려면:

```sh
chmod +x Imperium-1.1.0-linux-x64.AppImage
./Imperium-1.1.0-linux-x64.AppImage
```

AppImage는 앱 메뉴나 바탕 화면에 바로가기를 자동으로 만들지 않습니다. Linux에서도 Codex·Claude Code 설치와 구독 계정 로그인이 필요합니다. CI의 Linux 빌드 성공은 패키지 생성과 자동 검사 결과를 의미하며, Linux 데스크톱의 수동 실행 검증을 의미하지 않습니다.

## 소스에서 웹 모드 실행

[Node.js](https://nodejs.org/) 22 이상이 필요합니다. 이 폴더에서 실행하세요. 웹 서버는 Node.js 표준 라이브러리만 사용하므로 이 실행에는 `npm install`이 필요하지 않습니다. Electron 개발·패키징에는 별도로 `npm install`이 필요합니다.

```sh
npm start
```

[http://127.0.0.1:4310](http://127.0.0.1:4310)을 여세요. Windows에서는 `start-headquarters.cmd`를 실행해도 됩니다. 종료는 서버 터미널에서 `Ctrl+C`를 누르세요.

서버를 켠 상태에서 다른 터미널에 아래 명령을 실행하면 키보드로 사용하는 ANSI 터미널 뷰도 열 수 있습니다.

```sh
npm run terminal
```

`HQ_PORT` 환경 변수로 기본 포트 4310을 변경할 수 있습니다.

## 구독 계정 연결

사용할 CLI만 설치하고, 구독 중인 계정으로 로그인하세요. 아래 명령은 별도 도구를 설치하는 명령이며 앱 실행에 필요한 패키지 설치와는 구분됩니다.

```sh
npm install -g @openai/codex
codex login
```

```sh
npm install -g @anthropic-ai/claude-code
claude auth login
```

Codex에서는 ChatGPT 계정을, Claude Code에서는 Claude 구독 계정을 선택하세요. 앱의 연결 화면에서 설치·로그인 상태를 새로고침할 수 있습니다. 한쪽만 준비되어 있다면 지시할 때 준비된 모델을 선택하면 됩니다.

이 연결 방식은 별도 API 키를 요구하지 않으며 구독에 포함된 사용 한도를 적용받습니다. 남은 구독량과 적용 조건은 [OpenAI 공식 안내](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)와 [Claude 공식 안내](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan)를 확인하세요. 실제 모델은 각 CLI의 기본 모델 설정을 따릅니다. 구독 이름에 맞춰 특정 모델이나 추론 강도를 강제하지 않습니다.

## 사용 흐름

첫 화면은 **AI 조직도(F1)**입니다. 본부장 아래에 ChatGPT/Codex와 Claude가 배치되고, 각 모델 아래에서 부서의 역할·연결 상태·현재 작업을 확인할 수 있습니다. 모델과 부서의 상태는 실제 연결과 작업 기록을 반영합니다.

1. 조직도에서 전략기획실·개발본부·리서치센터·품질관리실의 **업무 지시**를 누르면 해당 부서가 선택된 작업 관리 화면으로 이동합니다. 이 동작만으로 모델이 실행되지는 않습니다. **F2**로 작업 관리 화면을 바로 열 수도 있습니다. 부서 이름, 역할과 기본 모델은 편집할 수 있습니다.
2. 지시를 입력하고 Codex 또는 Claude를 선택합니다. 작업마다 부서의 기본 모델을 바꿔 지정할 수 있습니다.
3. 읽기 전용 또는 파일 수정 권한과 우선순위를 정해 지시합니다.
4. 실시간 로그·결과·상태를 확인하고 필요하면 작업을 취소합니다. 기록은 JSON으로 내보낼 수 있습니다.

작업은 모델별 한 번에 1개, 전체 최대 2개까지 실행합니다. 같은 부서의 작업도 순서대로 실행하며, 파일 수정 작업은 충돌을 줄이기 위해 다른 작업과 겹치지 않게 실행합니다. 전체 동시 실행 수는 1 또는 2로 설정할 수 있습니다.

**DEMO**는 모델을 호출하지 않는 예시입니다. 화면의 데모 실행·삭제 기능으로 스트리밍과 상태 변화를 확인할 수 있습니다. 실제 모델은 사용자가 실제 작업을 지시한 경우에 호출됩니다.

## 언어와 권한

화면의 언어 선택에서 한국어·English·日本語를 전환할 수 있으며 선택은 앱 설정과 해당 브라우저에 저장됩니다. 이 설정은 화면의 설명과 표시 문구에 적용됩니다. 모델 응답은 지시 내용과 서버의 기본 한국어 안내를 따르므로 다른 언어의 결과를 원하면 지시에 명시하세요. 부서에 직접 입력한 이름·역할도 자동 번역되지 않습니다.

| 권한 | Codex | Claude Code v1 |
| --- | --- | --- |
| 읽기 전용 | CLI `read-only` 샌드박스 | `Read`, `Glob`, `Grep` |
| 파일 수정 | CLI `workspace-write` 샌드박스 | 위 도구와 `Edit`, `Write` |

Claude 연결에는 `Bash`를 허용하지 않으므로 현재 버전의 Claude 작업은 셸 명령이나 테스트를 실행할 수 없습니다. Codex도 CLI의 샌드박스와 승인 제한을 유지합니다. 작업 폴더는 연결·설정 화면에서 지정합니다.

## 기록과 현재 범위

- 웹 모드의 작업·결과·이벤트·설정은 Git에서 제외되는 `.hq/`에 저장됩니다. 데스크톱 모드는 위의 앱 데이터 위치를 사용합니다. 작업 기록은 최대 200개입니다.
- 서버 재시작 시 실행 중·대기 중 작업은 중단 상태가 되며 자동으로 재개하지 않습니다.
- 작업에서 CLI가 보고한 입력·출력 토큰 수를 표시합니다. 계정 전체의 남은 구독량이나 정확한 잔여 사용률은 제공하지 않습니다.
- 기존 대화 동기화, 다른 세션 감시, 백그라운드 자동 모델 실행은 현재 범위에 포함되지 않습니다.
- 이 폴더는 독립 앱입니다. 다른 프로젝트의 하위 폴더로 두어도 상위 Git 저장소나 코드를 앱이 가져와 관리하지 않습니다. 선택한 작업 폴더의 작업은 별개입니다.

Pretendard·Pretendard JP·JetBrains Mono 글꼴은 `public/fonts/`에 포함되어 외부 글꼴 CDN 없이 사용합니다. SIL Open Font License 1.1의 라이선스와 출처는 [서드파티 고지](THIRD_PARTY_NOTICES.md)에 정리되어 있습니다.

## 데스크톱 개발·빌드

```sh
npm install
npm run desktop
```

Windows에서 `npm run build:win`을 실행하면 설치 마법사와 포터블 파일을 함께 생성합니다. 설치 파일만 필요하면 `npm run build:installer`를 실행하세요. macOS의 DMG·ZIP은 Mac에서 `npm run build:mac`을 실행하거나 GitHub Actions의 macOS 빌드를 사용하세요. Linux의 DEB·AppImage는 Linux에서 `npm run build:linux`를 실행하거나 GitHub Actions의 Ubuntu 빌드를 사용하세요. 빌드 결과는 `dist/`에 생성됩니다. 플랫폼별 빌드 성공 여부는 해당 워크플로의 실행 결과에서 확인할 수 있습니다.

## 검증

```sh
npm ci --ignore-scripts
npm test
npm run check
```

테스트는 모의 CLI를 사용하며 실제 모델을 호출하지 않습니다. 포함된 GitHub Actions 설정은 이 앱 폴더를 저장소 루트로 게시할 때 Ubuntu·Windows와 Node.js 22·24에서 두 명령을 실행합니다.
