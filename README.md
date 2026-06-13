# 데일리 영어회화 (Daily English Conversation)

매일 한 문장 또는 한 다이얼로그씩, 듣고 따라 말하며 꾸준히 이어가는 영어회화 습관 앱.
AI 없이 자가학습 방식, 무비용(기기 내장 TTS·녹음·로컬 데이터) 지향. 영어로 시작해 일본어·프랑스어로 확장 예정.

## 폴더 구조

```
conversation/
├─ 기획서_데일리영어회화앱.md   # 서비스 기획서
├─ content/
│  ├─ lessons_en.json           # 60일 회화 (정중/캐주얼/슬랭 표현 병기)
│  └─ vocabulary_en.json        # 60일 × 10단어 = 600단어
├─ web/                         # 웹 미리보기(데모)
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
└─ server.js                    # 의존성 없는 정적 미리보기 서버
```

## 웹 미리보기 실행

```bash
node server.js
# → http://localhost:5173
```

- **듣기(TTS)**: 브라우저 내장 Web Speech API (실제 앱에서는 기기 내장 TTS)
- **녹음(1차)**: 마이크 녹음 후 재생, 원음과 번갈아 듣기
- **회화**: 정중/캐주얼/슬랭 표현 병기 (미국 현지 표현 기반)
- **단어**: 플래시카드 + 4지선다 퀴즈

## 콘텐츠 스키마

- 회화: `day, level(beginner/intermediate/advanced), situation, target_expression, dialog_turns[], native_variations[]`
  - `native_variations.register`: `polite` | `casual` | `slang`
- 단어: `day, theme, words[]{ word, pos, meaning, example, example_translation, phonetic }`

언어 비종속 구조로, 새 언어는 동일 스키마의 JSON만 추가하면 됩니다.

## 로드맵

- 1차(MVP): 듣기 · 따라 말하기 · 녹음 · 단어 암기 · 스트릭 · 알림 (Android, Flutter)
- 2차: 원음-내녹음 비교 UI · 받아쓰기 자동채점 · iOS
- 3차+: 일본어 · 프랑스어 확장
