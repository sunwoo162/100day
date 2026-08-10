100일 동안 사용자의 일상과 성장을 자동으로 기록하고 분석해주는 웹 서비스 UI/UX를 디자인해줘.

서비스 이름은 임시로 **100 DAYS**이다.

이 서비스는 단순한 습관 체크 앱이 아니라 사용자의 **노트북, 스마트폰, 스마트워치, GitHub 등의 데이터를 연결하여 100일 동안 자신의 생활을 데이터로 기록하고 분석하는 서비스**이다.

사용자는 100일 챌린지를 시작하고, 매일 자신의 PC 사용시간, 스마트폰 사용시간, 앱/웹사이트별 사용시간, 수면시간, 걸음 수, 운동시간, 개발시간, 집중시간, GitHub 활동 등을 자동으로 기록한다.

자동으로 측정하기 어려운 집중도, 만족도, 하루 한 줄 기록 등은 사용자가 직접 입력할 수 있다.

100일이 끝나면 사용자가 지난 100일 동안 자신의 시간을 어떻게 사용했는지 전체 데이터를 시각적으로 확인할 수 있어야 한다.

전체적으로 **개인 데이터 대시보드 + 라이프로그 + 자기계발 서비스**가 합쳐진 느낌으로 디자인해줘.

---

## 전체 디자인 스타일

깔끔하고 현대적인 데이터 대시보드 스타일로 만들어줘.

너무 기업용 관리자 페이지처럼 보이지 않고, 개인이 매일 들어가고 싶을 정도로 감성적이고 세련된 느낌이었으면 좋겠다.

Apple Health, Arc Browser, Linear, Raycast, WHOOP 같은 서비스처럼 정보는 많지만 복잡해 보이지 않는 디자인을 참고해줘.

기본 테마는 다크 모드로 제작한다.

배경은 완전한 검정색보다는 아주 어두운 회색을 사용하고, 카드마다 미세한 명도 차이를 둔다.

Accent Color는 밝은 라임, 그린 또는 블루 계열을 하나만 사용한다.

과도한 그라데이션, 네온 효과, 화려한 3D 효과는 사용하지 않는다.

큰 숫자와 넓은 여백을 적극적으로 사용하고 데이터 자체가 디자인의 중심이 되게 한다.

폰트는 Pretendard 또는 Inter 스타일의 깔끔한 Sans-serif를 사용한다.

카드 radius는 약 16~20px.

Desktop 기준 1440px 화면을 우선 디자인하되 모바일 반응형도 고려한다.

---

# 1. Dashboard

가장 중요한 메인 화면이다.

상단에는 다음 정보를 표시한다.

100 DAYS

DAY 37 / 100

챌린지 시작일과 종료 예정일

전체 진행률 Progress Bar

예시:

DAY 37

37%

████████░░░░░░░░░░░

오늘 하루의 핵심 데이터를 한눈에 볼 수 있는 카드들을 배치한다.

PC 사용시간
6h 21m

Phone 사용시간
4h 13m

Focus Time
3h 17m

Sleep
6h 42m

Steps
8,421

Exercise
27m

Development
2h 31m

GitHub
7 commits

각 카드에는 아이콘, 큰 숫자, 전날 대비 증감 또는 최근 평균과의 비교를 작게 표시한다.

예:

Phone

4h 13m

↓ 32m from yesterday

---

그 아래에는 TODAY TIMELINE을 만든다.

사용자의 하루를 시간순으로 시각화한다.

예:

07:10 Wake up

08:00 School

16:21 VS Code

18:03 YouTube

19:32 Focus Session

22:14 GitHub Commit

01:12 Sleep

단순 리스트보다는 세로 Timeline 형태로 보여준다.

---

그 아래에는 오늘 사용한 기기 비율을 보여준다.

Laptop
Phone
Watch

그리고 Screen Time Breakdown을 보여준다.

예:

VS Code 2h 31m
YouTube 1h 21m
Chrome 57m
Instagram 48m
Discord 31m

Horizontal Bar Chart를 사용한다.

---

# 2. Timeline / 100 Days

100일 전체를 볼 수 있는 페이지.

DAY 1부터 DAY 100까지 시간 흐름이 느껴지는 디자인으로 만들어줘.

상단에는:

100 DAYS

37 DAYS COMPLETED

63 DAYS LEFT

을 표시한다.

달력처럼만 만들지 말고 **100일 여정이 쌓이는 느낌**을 표현한다.

DAY 1
DAY 2
DAY 3
...
DAY 37 TODAY
...
DAY 100

완료된 날짜는 활성 상태,
오늘은 Accent Color,
미래 날짜는 흐리게 표현한다.

특정 DAY를 선택하면 오른쪽 또는 Modal/Detail Panel에 그날 데이터가 표시된다.

DAY 23

PC 7h 12m
Phone 5h 03m
Focus 1h 44m
Sleep 5h 51m
Steps 4,231

Focus Score
5 / 10

Satisfaction
6 / 10

Daily Note

"오늘은 집중이 잘 안 됐다."

사진이나 짧은 영상 기록이 존재한다면 Thumbnail을 보여줄 수 있는 공간도 만든다.

---

# 3. Analytics

100일 동안 쌓인 데이터를 분석하는 페이지.

상단에서 기간을 변경할 수 있다.

7 Days

30 Days

100 Days

전체 데이터를 그래프 중심으로 표현한다.

다음 섹션들을 디자인한다.

Screen Time Trend

날짜별 스마트폰/PC 사용시간 Line Chart

Sleep Trend

날짜별 수면시간 Line Chart

Focus Time

날짜별 집중시간 Bar Chart

Steps

일별 걸음 수

Development Activity

개발시간 + GitHub Commit 데이터

App Usage

가장 많이 사용한 앱 Top 5

Website Usage

YouTube
ChatGPT
GitHub
Google
기타

시간 비율을 보여준다.

---

Correlation / Insight 영역도 만든다.

예:

INSIGHT

"You focus 24% better when sleeping more than 7 hours."

"Your most productive day is Tuesday."

"Your average phone usage decreased by 18%."

"VS Code usage increased 31% compared to your first 30 days."

단순한 AI 챗봇 UI보다 데이터에서 발견된 내용을 카드 형태로 보여준다.

---

# 4. Devices

사용자의 디바이스와 외부 서비스를 연결하는 페이지.

제목:

Connected Devices

현재 연결된 장치를 카드 형태로 표시한다.

예:

Laptop

Sunwoo Laptop

Windows

● Connected

Last Sync
2 minutes ago

Phone

Galaxy S25

Android

● Connected

Watch

Galaxy Watch

via Health Connect

● Connected

GitHub

@username

● Connected

각 카드에는 Disconnect, Settings 기능이 존재한다.

---

아직 연결하지 않은 장치는:

Connect a Device

Laptop
Install Desktop Tracker

Android
Install Companion App

Smart Watch
Connect Health Data

GitHub
Connect GitHub

형태로 보여준다.

휴대폰 연결 과정에서는 QR Code를 사용할 수 있도록 QR 연결 화면도 디자인한다.

예:

Connect Your Phone

1. Open the 100 DAYS mobile app
2. Scan this QR code
3. Allow required permissions

[ QR CODE ]

Waiting for device...

---

# 5. Focus

웹에서 사용자가 직접 집중시간을 측정하는 화면.

큰 타이머가 화면 중심에 위치한다.

예:

FOCUS

01:24:37

현재 활동:

Development

[ STOP ]

시작하기 전에는 Category를 선택한다.

Development

Coding Test

School Study

Certificate

Reading

Other

[ START FOCUS ]

오늘 집중한 세션도 아래 표시한다.

09:21 - 10:13
Development
52m

16:10 - 17:42
Development
1h 32m

22:03 - 22:41
Coding Test
38m

---

# 6. Daily Check-in

하루가 끝났을 때 사용자가 직접 입력하는 아주 간단한 화면.

입력 항목은 최소화한다.

How focused were you today?

1 2 3 4 5 6 7 8 9 10

How satisfied are you today?

1 2 3 4 5 6 7 8 9 10

One line about today

[________________________]

Save Day

약 30초 안에 기록할 수 있는 UI로 만들어줘.

---

# 7. 100 Days Result

이 프로젝트에서 시각적으로 가장 인상적이어야 하는 화면이다.

DAY 100을 완료하면 사용할 수 있는 결과 페이지.

상단:

100 DAYS

COMPLETE

100 / 100

그리고 지난 100일 동안 기록된 핵심 데이터를 거대한 Typography와 함께 보여준다.

예:

2,400 HOURS

100 DAYS OF MY LIFE

Sleep
642h

PC
481h

Phone
392h

Focus
247h

Development
181h

Exercise
41h

Steps
1,043,291

GitHub Commits
382

각 데이터가 하나씩 등장하는 Presentation 형태의 디자인으로 만들어도 좋다.

그 아래에는:

DAY 1 VS DAY 100

비교 영역을 만든다.

Phone Usage

DAY 1
6h 21m

DAY 100
3h 52m

↓ 39%

Focus Time

DAY 1
42m

DAY 100
3h 21m

↑ 379%

등의 비교를 보여준다.

마지막에는 사용자의 100일을 한 화면에서 볼 수 있는 Summary Dashboard를 배치한다.

이 화면은 사용자가 스크린샷을 찍거나 영상 마지막 장면으로 사용할 수 있을 정도로 시각적으로 완성도 높게 디자인한다.

---

# Navigation

Desktop에서는 왼쪽 Sidebar를 사용한다.

Logo
100 DAYS

Navigation:

Overview
Timeline
Analytics
Focus
Devices

하단:

Settings
Profile

Sidebar는 좁고 단순하게 만든다.

현재 선택된 메뉴만 Accent Color 또는 배경으로 구분한다.

---

전체 디자인에서 가장 중요하게 생각할 것은 **"100일 동안 내 삶의 데이터가 점점 쌓이고 있다"라는 느낌**이다.

일반적인 Todo 앱이나 습관 체크 앱처럼 만들지 말고, 여러 디바이스에서 자동 수집된 데이터를 하나의 개인 데이터 허브에서 확인하는 서비스처럼 디자인한다.

숫자, 시간, 그래프, Timeline을 적극적으로 사용한다.

사용자가 DAY 1에서 DAY 100으로 갈수록 데이터가 누적되고 자신의 변화가 시각적으로 드러나는 경험을 만들어줘.
