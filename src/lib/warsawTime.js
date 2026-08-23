const WARSAW_TIME_ZONE = "Europe/Warsaw";

export function warsawDateOnly(value) {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: WARSAW_TIME_ZONE });
}

export function warsawToday() {
  return warsawDateOnly(new Date());
}

export function warsawNowMinutes() {
  const warsawTime = new Date(new Date().toLocaleString("en-US", { timeZone: WARSAW_TIME_ZONE }));
  return warsawTime.getHours() * 60 + warsawTime.getMinutes();
}
