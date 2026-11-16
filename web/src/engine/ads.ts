// 리워드 광고 자리표시(stub).
// 지금은 1.5초짜리 가짜 광고 화면을 보여주고 보상을 준다.
// 실제 SDK(예: Capacitor AdMob 플러그인)를 붙일 때 showRewarded() 안만 바꾸면 된다.

const FAKE_AD_SECONDS = 1.5;

let busy = false;

export function showRewarded(placement: string, onReward: () => void): void {
  if (busy) return;
  busy = true;
  const root = document.querySelector(".ui-root") ?? document.body;
  const bg = document.createElement("div");
  bg.className = "overlay";
  bg.style.background = "rgba(0,0,0,0.88)";
  bg.style.zIndex = "100";
  bg.style.display = "flex";
  bg.style.alignItems = "center";
  bg.style.justifyContent = "center";
  const lbl = document.createElement("div");
  lbl.className = "lbl";
  lbl.style.fontSize = "44px";
  lbl.style.color = "#fff";
  lbl.style.textAlign = "center";
  lbl.style.whiteSpace = "pre";
  lbl.textContent = `광고 시청 중…\n(테스트용 가짜 광고: ${placement})`;
  bg.appendChild(lbl);
  root.appendChild(bg);
  setTimeout(() => {
    bg.remove();
    busy = false;
    onReward();
  }, FAKE_AD_SECONDS * 1000);
}
