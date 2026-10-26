#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DotDay <-> KokioTalk 실시간 캘린더 브릿지 (dotday_calendar.py)
- PC의 DotDay 바탕화면 달력과 동일한 구글 캘린더(primary, 가족 캘린더) 및 대한민국 공휴일(holiday_cache.json)을
  실시간 조회(list), 추가(create), 수정(update), 삭제(delete)합니다.
"""

import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

VAULT_ROOT = Path.home()
KEY_PATH = VAULT_ROOT / "1. Projects" / "Agents" / "my_researcher" / "service_account.json"
TOKEN_PATH = VAULT_ROOT / "1. Projects" / "GoogleAPI_Integration" / "token.json"
DOTDAY_DIR = Path.home() / "AppData" / "Local" / "Packages" / "dragonsummer.dotday_z7nzhxe4n3a5m" / "LocalCache" / "Local" / "DotDay"
HOLIDAY_CACHE_PATH = DOTDAY_DIR / "holiday_cache.json"

KST = timezone(timedelta(hours=9))

CALENDARS = [
    {
        "id": "primary",
        "name": "Google Calendar (Primary)",
        "color": "#FB8C00",
        "writable": True
    },
    {
        "id": "family03283081236209642784@group.calendar.google.com",
        "name": "가족 캘린더",
        "color": "#33B679",
        "writable": True
    }
]

GOOGLE_COLOR_MAP = {
    "1": "#7986CB",
    "2": "#33B679",
    "3": "#8E24AA",
    "4": "#E67C73",
    "5": "#F6BF26",
    "6": "#F4511E",
    "7": "#039BE5",
    "8": "#616161",
    "9": "#3F51B5",
    "10": "#0B8043",
    "11": "#D50000",
}


def get_calendar_service():
    from googleapiclient.discovery import build
    if KEY_PATH.exists():
        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_file(
            str(KEY_PATH), scopes=["https://www.googleapis.com/auth/calendar"]
        )
        return build("calendar", "v3", credentials=creds)
    if TOKEN_PATH.exists():
        from google.oauth2.credentials import Credentials
        creds = Credentials.from_authorized_user_file(
            str(TOKEN_PATH), ["https://www.googleapis.com/auth/calendar"]
        )
        return build("calendar", "v3", credentials=creds)
    raise RuntimeError("Google Calendar 인증 파일(service_account.json)을 찾을 수 없습니다.")


def load_holidays(year: int) -> list[dict]:
    events = []
    if HOLIDAY_CACHE_PATH.exists():
        try:
            raw = json.loads(HOLIDAY_CACHE_PATH.read_text(encoding="utf-8"))
            for yr_str in [str(year - 1), str(year), str(year + 1)]:
                for item in raw.get(yr_str, []):
                    date_str = str(item.get("Date", ""))[:10]
                    if not date_str:
                        continue
                    events.append({
                        "id": f"holiday-{date_str}-{item.get('Name', '')}",
                        "calendarId": "holiday",
                        "calendarName": "대한민국 공휴일",
                        "title": item.get("Name", "공휴일"),
                        "description": item.get("Description", ""),
                        "startDate": date_str,
                        "endDate": date_str,
                        "startTime": "",
                        "endTime": "",
                        "allDay": True,
                        "isHoliday": True,
                        "color": "#E8453C",
                        "writable": False
                    })
        except Exception:
            pass
    return events


def list_events(year: int, month: int) -> dict:
    service = get_calendar_service()
    # 전월 20일부터 익월 15일까지 넉넉하게 조회 (달력 6주 그리드 전체 표시용)
    first_day = datetime(year, month, 1, 0, 0, 0, tzinfo=KST)
    time_min = (first_day - timedelta(days=12)).isoformat()
    time_max = (first_day + timedelta(days=45)).isoformat()

    all_events = load_holidays(year)

    for cal in CALENDARS:
        cal_id = cal["id"]
        try:
            resp = (
                service.events()
                .list(
                    calendarId=cal_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                    maxResults=250,
                )
                .execute()
            )
            items = resp.get("items", [])
            for ev in items:
                if ev.get("status") == "cancelled":
                    continue
                start_obj = ev.get("start", {})
                end_obj = ev.get("end", {})
                is_all_day = "date" in start_obj

                if is_all_day:
                    s_date = start_obj.get("date", "")
                    e_raw = end_obj.get("date", s_date)
                    # Google Calendar 종일 일정의 end.date는 exclusive(다음날)이므로 1일 차감
                    try:
                        e_dt = datetime.strptime(e_raw, "%Y-%m-%d") - timedelta(days=1)
                        e_date = max(s_date, e_dt.strftime("%Y-%m-%d"))
                    except Exception:
                        e_date = s_date
                    s_time = ""
                    e_time = ""
                else:
                    s_iso = start_obj.get("dateTime", "")
                    e_iso = end_obj.get("dateTime", s_iso)
                    try:
                        s_dt = datetime.fromisoformat(s_iso).astimezone(KST)
                        e_dt = datetime.fromisoformat(e_iso).astimezone(KST)
                        s_date = s_dt.strftime("%Y-%m-%d")
                        e_date = e_dt.strftime("%Y-%m-%d")
                        s_time = s_dt.strftime("%H:%M")
                        e_time = e_dt.strftime("%H:%M")
                    except Exception:
                        s_date = s_iso[:10]
                        e_date = e_iso[:10]
                        s_time = s_iso[11:16]
                        e_time = e_iso[11:16]

                cid = str(ev.get("colorId", ""))
                ev_color = GOOGLE_COLOR_MAP.get(cid, cal["color"])

                all_events.append({
                    "id": ev.get("id"),
                    "calendarId": cal_id,
                    "calendarName": cal["name"],
                    "title": ev.get("summary") or "(제목 없음)",
                    "description": ev.get("description") or "",
                    "location": ev.get("location") or "",
                    "startDate": s_date,
                    "endDate": e_date,
                    "startTime": s_time,
                    "endTime": e_time,
                    "allDay": is_all_day,
                    "isHoliday": False,
                    "color": ev_color,
                    "colorId": cid,
                    "writable": cal["writable"],
                    "htmlLink": ev.get("htmlLink")
                })
        except Exception:
            continue

    return {
        "ok": True,
        "year": year,
        "month": month,
        "calendars": CALENDARS,
        "events": all_events
    }


def create_event(payload: dict) -> dict:
    service = get_calendar_service()
    cal_id = payload.get("calendarId") or "primary"
    title = (payload.get("title") or "").strip()
    if not title:
        return {"ok": False, "error": "일정 제목을 입력해 주세요."}

    start_date = payload.get("startDate") or datetime.now(KST).strftime("%Y-%m-%d")
    end_date = payload.get("endDate") or start_date
    start_time = (payload.get("startTime") or "").strip()
    end_time = (payload.get("endTime") or "").strip()
    all_day = bool(payload.get("allDay")) or not start_time
    description = (payload.get("description") or "").strip()
    color_id = str(payload.get("colorId") or "")

    body: dict = {
        "summary": title,
        "description": description,
    }
    if color_id and color_id in GOOGLE_COLOR_MAP:
        body["colorId"] = color_id

    if all_day:
        try:
            e_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            end_exclusive = e_dt.strftime("%Y-%m-%d")
        except Exception:
            end_exclusive = end_date
        body["start"] = {"date": start_date}
        body["end"] = {"date": end_exclusive}
    else:
        if not end_time:
            try:
                st_dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
                et_dt = st_dt + timedelta(hours=1)
                end_date = et_dt.strftime("%Y-%m-%d")
                end_time = et_dt.strftime("%H:%M")
            except Exception:
                end_time = start_time
        body["start"] = {"dateTime": f"{start_date}T{start_time}:00+09:00", "timeZone": "Asia/Seoul"}
        body["end"] = {"dateTime": f"{end_date}T{end_time}:00+09:00", "timeZone": "Asia/Seoul"}

    created = service.events().insert(calendarId=cal_id, body=body).execute()
    return {"ok": True, "event": created}


def delete_event(payload: dict) -> dict:
    service = get_calendar_service()
    cal_id = payload.get("calendarId") or "primary"
    event_id = payload.get("eventId")
    if not event_id:
        return {"ok": False, "error": "삭제할 eventId가 필요합니다."}
    service.events().delete(calendarId=cal_id, eventId=event_id).execute()
    return {"ok": True, "deletedId": event_id}


def main():
    raw = sys.stdin.read().strip()
    req = json.loads(raw) if raw else {}
    action = req.get("action", "list")

    try:
        if action == "list":
            now = datetime.now(KST)
            yr = int(req.get("year") or now.year)
            mo = int(req.get("month") or now.month)
            out = list_events(yr, mo)
        elif action == "create":
            out = create_event(req)
        elif action == "delete":
            out = delete_event(req)
        else:
            out = {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        out = {"ok": False, "error": str(e)}

    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
